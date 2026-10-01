import { Scene } from 'three';
import { AudioManager } from './audio/AudioManager';
import { AudioDirector } from './audio/AudioDirector';
import { AUDIO_URLS } from './assets';
import { Input } from './core/Input';
import { Loop } from './core/Loop';
import { Time } from './core/Time';
import { CAMERA } from './data/camera';
import { NO_INPUT } from './entities/Player';
import { FxDirector } from './fx/FxDirector';
import { World } from './game/World';
import { PhysicsWorld } from './physics/PhysicsWorld';
import type { Rapier } from './physics/rapier';
import type { CharacterTemplate } from './render/characters';
import type { EnemyKind } from './data/enemies';
import { AxeView } from './render/AxeView';
import { CameraRig } from './render/CameraRig';
import type { DebugOverlay } from './render/DebugOverlay';
import { EnemyViews } from './render/EnemyViews';
import { OrbViews } from './render/OrbViews';
import { PlayerView } from './render/PlayerView';
import { Renderer } from './render/Renderer';
import { ArenaView } from './scenes/ArenaView';
import { Hud } from './ui/Hud';
import { isNewBest, loadBest, saveBest, type BestRecord } from './ui/records';
import { loadSettings, saveSettings, type Settings } from './ui/settings';
import { QUALITY } from './data/graphics';

type Mode = 'menu' | 'play' | 'paused' | 'over';

export interface GameAssets {
  rapier: Rapier;
  player: CharacterTemplate;
  enemies: Record<EnemyKind, CharacterTemplate>;
}

const LOCK_FALLBACK_MS = 500;

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Falta #${id} en index.html`);
  return e;
}

/** Raíz de composición: une simulación, vistas, audio, HUD y el flujo de la partida. */
export class Game {
  readonly time = new Time();
  readonly scene = new Scene();
  readonly cameraRig = new CameraRig();
  readonly world: World;
  readonly physics: PhysicsWorld;
  readonly renderer: Renderer;
  readonly audio = new AudioManager();
  readonly input: Input;
  readonly loop: Loop;
  overlay: DebugOverlay | null = null;

  private readonly arena: ArenaView;
  private readonly playerView: PlayerView;
  private readonly axeView: AxeView;
  private readonly enemyViews: EnemyViews;
  private readonly orbViews: OrbViews;
  private readonly fx: FxDirector;
  private readonly hud: Hud;
  private readonly audioDirector: AudioDirector;
  private audioLoading = false;

  private mode: Mode = 'menu';
  private locked = false;
  private everLocked = false;
  /** Sin pointer lock (iframes, navegadores que lo bloquean): mouse libre y Esc para pausar. */
  private fallback = false;
  private best: BestRecord = loadBest();
  settings: Settings = loadSettings();

  constructor(app: HTMLElement, assets: GameAssets) {
    this.physics = new PhysicsWorld(assets.rapier);
    this.cameraRig.obstacles = this.physics;
    this.world = new World(
      {
        hitStop: (s) => {
          this.time.hitStop(s);
        },
        shake: (a) => {
          this.cameraRig.addTrauma(a);
        },
      },
      this.physics,
    );
    this.renderer = new Renderer(app, this.scene, this.cameraRig.camera, this.settings.quality);
    this.arena = new ArenaView(this.scene);
    this.playerView = new PlayerView(this.scene, assets.player);
    this.axeView = new AxeView(this.scene, this.playerView);
    this.enemyViews = new EnemyViews(this.scene, assets.enemies);
    this.orbViews = new OrbViews(this.scene);
    this.fx = new FxDirector(this.scene, this.world);
    this.hud = new Hud(this.world);
    const rig = this.cameraRig;
    this.audioDirector = new AudioDirector(this.audio, this.world, {
      position: rig.camera.position,
      get yaw() {
        return rig.yaw;
      },
    });

    this.world.events.on('enemy:spawned', ({ enemy }) => {
      this.enemyViews.acquire(enemy);
    });
    this.world.events.on('enemy:removed', ({ enemy }) => {
      this.enemyViews.release(enemy);
    });

    this.input = new Input(() => this.mode === 'play' && (this.locked || this.fallback));
    this.input.onKeyDown = (code) => {
      this.onKey(code);
    };
    this.bindScreens();

    this.loop = new Loop(this.time, {
      preUpdate: (realDt) => {
        this.preUpdate(realDt);
      },
      update: (step) => {
        this.update(step);
      },
      render: (alpha, realDt) => {
        this.render(alpha, realDt);
      },
    });

    this.applySettings(this.settings);
    this.restart();
    this.setMode('menu');
    this.updateBestText();
  }

  start(): void {
    this.loop.start();
  }

  // ───────────────────────── Loop ─────────────────────────

  private preUpdate(realDt: number): void {
    const cam = this.cameraRig;
    if (this.mode === 'menu') {
      cam.yaw += realDt * CAMERA.menuOrbitSpeed;
    } else if (this.mode === 'play') {
      const { dx, dy } = this.input.consumeLook();
      cam.look(dx, dy);
    }
    this.world.camYaw = cam.yaw;
  }

  private update(step: number): void {
    const input = this.mode === 'play' ? this.input.consumeStep() : NO_INPUT;
    this.world.step(step, input);
    if (this.mode === 'play' && this.world.gameOver) this.gameOver();
  }

  private render(alpha: number, realDt: number): void {
    const w = this.world;
    const simDt = this.loop.lastSteps * this.time.step;
    const now = this.time.realTime;

    // En el menú el guerrero respira aunque la simulación esté quieta.
    this.playerView.update(w.player, alpha, this.mode === 'menu' ? realDt : simDt);
    this.playerView.handWorldPosition(w.player.handPos);
    this.axeView.update(w.axe, alpha, now);
    this.enemyViews.update(alpha, simDt, this.playerView.root.position);
    this.orbViews.update(w.orbs, simDt);
    this.fx.update(simDt);
    this.arena.update(realDt, now);

    this.cameraRig.update(realDt, this.playerView.root.position);
    this.cameraRig.writeAim(w.aimOrigin, w.aimDir);
    this.hud.update(realDt);
    this.audioDirector.update();
    w.stats.tickRealTime(realDt);

    this.renderer.render(realDt);
    this.overlay?.update(realDt, this.renderer.gl, this.loop.lastSteps);
  }

  /** Aplica y guarda las preferencias del jugador. */
  applySettings(s: Settings): void {
    this.settings = s;
    saveSettings(s);
    this.cameraRig.sensitivity = s.sensitivity;
    this.cameraRig.invertY = s.invertY;
    this.audio.setVolumes(s);
    this.renderer.setQuality(s.quality);
    this.arena.setShadowMapSize(QUALITY[s.quality].shadowMapSize);
  }

  // ─────────────────────── Partida ───────────────────────

  private restart(): void {
    this.world.reset();
    this.fx.clear();
    this.playerView.reset();
    this.cameraRig.reset(this.world.player.pos);
    this.hud.reset();
    this.input.clearPressed();
    this.time.reset();
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    // En game over la simulación sigue corriendo detrás del cartel, como en el prototipo.
    this.time.paused = mode === 'menu' || mode === 'paused';
    this.input.enabled = mode === 'play';
    if (mode !== 'play') this.input.clearPressed();
    this.show('menu', mode === 'menu');
    this.show('pause', mode === 'paused');
    this.show('over', mode === 'over');
  }

  private enterPlay(): void {
    if (this.mode === 'menu' || this.mode === 'over') this.restart();
    this.setMode('play');
  }

  private gameOver(): void {
    const w = this.world;
    const run = { wave: w.waves.wave, kills: w.stats.kills };
    if (isNewBest(this.best, run)) {
      this.best = run;
      saveBest(run);
    }
    this.setMode('over');
    el('oWave').textContent = String(run.wave);
    el('oKills').textContent = String(run.kills);
    el('oCombo').textContent = String(w.stats.bestCombo);
    el('oBest').textContent = `Récord: oleada ${this.best.wave} con ${this.best.kills} bajas`;
    this.updateBestText();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private updateBestText(): void {
    el('bestTxt').textContent =
      this.best.wave > 0
        ? `oleada ${this.best.wave} con ${this.best.kills} bajas`
        : 'ninguno todavía';
  }

  // ──────────────────── Pantallas e input ────────────────────

  private show(id: string, on: boolean): void {
    el(id).classList.toggle('hidden', !on);
  }

  private bindScreens(): void {
    const start = el('startBtn') as HTMLButtonElement;
    start.textContent = 'Entrar a la arena';
    start.disabled = false;
    for (const id of ['startBtn', 'resumeBtn', 'againBtn']) {
      el(id).addEventListener('click', () => {
        this.requestLock();
      });
    }
    const canvas = this.renderer.canvas;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) {
        this.everLocked = true;
        el('pauseMsg').textContent = '';
        this.enterPlay();
      } else if (this.mode === 'play') {
        this.setMode('paused');
      }
    });
    document.addEventListener('pointerlockerror', () => {
      this.lockFailed();
    });
  }

  /** El audio necesita un gesto del usuario: se inicia (y se descarga) con el primer click. */
  private startAudio(): void {
    this.audio.init();
    if (this.audioLoading) return;
    this.audioLoading = true;
    void this.audio.loadSamples(AUDIO_URLS).then(() => {
      this.audio.startAmbient();
    });
  }

  private requestLock(): void {
    this.startAudio();
    const canvas = this.renderer.canvas;
    if (this.fallback) {
      this.enterPlay();
      return;
    }
    try {
      const r = canvas.requestPointerLock() as Promise<void> | undefined;
      r?.catch(() => {
        this.lockFailed();
      });
    } catch {
      this.lockFailed();
    }
    if (!this.everLocked) {
      setTimeout(() => {
        if (!this.locked && !this.everLocked) {
          this.fallback = true;
          this.enterPlay();
        }
      }, LOCK_FALLBACK_MS);
    }
  }

  private lockFailed(): void {
    if (!this.everLocked) {
      this.fallback = true;
      this.enterPlay();
    } else {
      el('pauseMsg').textContent =
        'El navegador pide esperar un segundo antes de volver a capturar el mouse. Probá de nuevo.';
    }
  }

  private onKey(code: string): void {
    if (code === 'KeyM') {
      this.audio.toggleMute();
      return;
    }
    if (code === 'Escape' && this.fallback) {
      if (this.mode === 'play') this.setMode('paused');
      else if (this.mode === 'paused') this.enterPlay();
    }
  }
}
