import { Scene } from 'three';
import { AudioManager } from './audio/AudioManager';
import { AudioDirector } from './audio/AudioDirector';
import { AUDIO_URLS } from './assets';
import { Input } from './core/Input';
import { Loop } from './core/Loop';
import { Time } from './core/Time';
import { CAMERA } from './data/camera';
import { BOSS } from './data/boss';
import { CINEMATIC, LOCK_ON } from './data/bossView';
import { NO_INPUT } from './entities/Player';
import { FxDirector } from './fx/FxDirector';
import { World } from './game/World';
import { PhysicsWorld } from './physics/PhysicsWorld';
import type { Rapier } from './physics/rapier';
import type { CharacterTemplate } from './render/characters';
import type { EnemyKind } from './data/enemies';
import { AxeView } from './render/AxeView';
import { BossView } from './render/BossView';
import { DecalViews } from './render/DecalViews';
import { TargetLock, lockPoint } from './render/TargetLock';
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
import { SettingsScreen } from './ui/SettingsScreen';
import { Tips } from './ui/Tips';
import { renderControls } from './ui/controls';
import { QUALITY } from './data/graphics';

type Mode = 'menu' | 'play' | 'paused' | 'over';

export interface GameAssets {
  rapier: Rapier;
  player: CharacterTemplate;
  enemies: Record<EnemyKind, CharacterTemplate>;
}

const LOCK_FALLBACK_MS = 500;

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function saveFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Sin storage (modo privado): la entrada simplemente no se puede saltear.
  }
}

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
  private readonly bossView: BossView;
  private readonly decals: DecalViews;
  readonly lock = new TargetLock();
  private readonly fx: FxDirector;
  private readonly hud: Hud;
  private readonly audioDirector: AudioDirector;
  private readonly tips: Tips;
  private readonly settingsScreen: SettingsScreen;
  private audioLoading = false;
  /** Segundos reales que quedan de la cámara lenta de la muerte del jefe. */
  private slowMo = 0;
  /** La entrada del jefe se puede saltear si ya se vio alguna vez. */
  private introSkippable = false;

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
    this.bossView = new BossView(this.scene);
    this.decals = new DecalViews(this.scene);
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
    this.world.events.on('boss:intro', () => {
      this.lock.clear();
      this.introSkippable = loadFlag(CINEMATIC.seenKey);
      saveFlag(CINEMATIC.seenKey);
    });
    this.world.events.on('boss:died', () => {
      this.slowMo = BOSS.death.slowDuration;
    });

    this.input = new Input(() => this.mode === 'play' && (this.locked || this.fallback));
    this.input.onKeyDown = (code) => this.onKey(code);
    this.input.onLockToggle = () => {
      if (!this.world.cinematic) this.lock.toggle(this.world, this.cameraRig.yaw);
    };
    this.tips = new Tips(this.world);
    this.settingsScreen = new SettingsScreen(
      () => this.settings,
      (s) => {
        this.applySettings(s);
      },
    );
    renderControls(document);
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
      // Con un objetivo fijado (o en la cinemática), el giro horizontal lo maneja la cámara.
      cam.look(this.lock.active || this.world.cinematic ? 0 : dx, dy);
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
    this.playerView.update(w.player, w.axe, alpha, this.mode === 'menu' ? realDt : simDt);
    this.playerView.handWorldPosition(w.player.handPos);
    this.axeView.update(w.axe, alpha, now);
    this.enemyViews.update(alpha, simDt, this.playerView.root.position);
    this.orbViews.update(w.orbs, simDt);
    this.bossView.update(w.boss, alpha, simDt, now);
    this.decals.update(w.telegraphs, w.hazards, now);
    this.fx.update(simDt);
    this.arena.update(realDt, now);

    this.updateSlowMo(realDt);
    this.aimCamera(alpha);
    this.cameraRig.update(realDt, this.playerView.root.position);
    this.cameraRig.writeAim(w.aimOrigin, w.aimDir);
    this.updateLockMarker();
    this.hud.update(realDt);
    this.tips.update(realDt);
    this.audioDirector.update();
    w.stats.tickRealTime(realDt);

    this.renderer.render(realDt);
    this.overlay?.update(realDt, this.renderer.gl, this.loop.lastSteps);
  }

  /** Cinemática del jefe o fijación de objetivo: la cámara mantiene el punto en cuadro. */
  private aimCamera(alpha: number): void {
    const w = this.world;
    const cam = this.cameraRig;
    this.lock.validate(w);
    if (w.cinematic && this.mode === 'play') {
      cam.focusing = true;
      cam.focusPoint.copy(w.boss.pos);
      cam.focusDamp = CINEMATIC.turnDamp;
      cam.focusPitch = CINEMATIC.pitch;
      cam.pullBack = CINEMATIC.pullBack;
      cam.trauma = Math.max(cam.trauma, CINEMATIC.rumble);
    } else {
      cam.focusing = this.lock.focus(cam.focusPoint, alpha);
      cam.focusDamp = LOCK_ON.turnDamp;
      cam.focusPitch = null;
      cam.pullBack = 0;
    }
    this.hud.setSkipHint(w.cinematic && this.introSkippable);
  }

  private updateLockMarker(): void {
    if (!this.lock.active) {
      this.hud.setLock(false, 0, 0);
      return;
    }
    lockPoint.copy(this.cameraRig.focusPoint).project(this.cameraRig.camera);
    const canvas = this.renderer.canvas;
    const visible = lockPoint.z < 1;
    this.hud.setLock(
      visible,
      ((lockPoint.x + 1) / 2) * canvas.clientWidth,
      ((1 - lockPoint.y) / 2) * canvas.clientHeight,
    );
  }

  /** La cámara lenta corre en tiempo real: la muerte del jefe se ve a 0,3 durante 1,5 s. */
  private updateSlowMo(realDt: number): void {
    if (this.slowMo <= 0) return;
    this.slowMo -= realDt;
    this.time.timeScale = this.slowMo > 0 ? BOSS.death.timeScale : 1;
  }

  /** Atajo de desarrollo: la próxima oleada es la del jefe. */
  devJumpToBoss(): void {
    this.world.waves.jumpTo(BOSS.waveInterval);
    this.tips.toast('Saltando a la oleada del jefe');
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
    this.lock.clear();
    this.slowMo = 0;
    this.input.clearPressed();
    this.time.reset();
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    // En game over la simulación sigue corriendo detrás del cartel, como en el prototipo.
    this.time.paused = mode === 'menu' || mode === 'paused';
    this.input.enabled = mode === 'play';
    if (mode !== 'play') this.input.clearPressed();
    if (this.settingsScreen.isOpen) this.settingsScreen.close();
    this.showScreens();
  }

  private showScreens(): void {
    this.show('menu', this.mode === 'menu');
    this.show('pause', this.mode === 'paused');
    this.show('over', this.mode === 'over');
  }

  private enterPlay(): void {
    const fresh = this.mode === 'menu' || this.mode === 'over';
    if (fresh) this.restart();
    this.setMode('play');
    if (fresh) this.tips.start();
  }

  private gameOver(): void {
    const w = this.world;
    const run = { wave: w.waves.wave, kills: w.stats.kills };
    const record = isNewBest(this.best, run);
    if (record) {
      this.best = run;
      saveBest(run);
    }
    this.tips.stop();
    this.setMode('over');
    this.show('newBest', record);
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
    for (const btn of document.querySelectorAll('[data-open-settings]')) {
      btn.addEventListener('click', () => {
        this.show('menu', false);
        this.show('pause', false);
        this.settingsScreen.open(() => {
          this.showScreens();
        });
      });
    }
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

  /** Devuelve true si la tecla quedó consumida. */
  private onKey(code: string): boolean {
    if (this.mode === 'play' && this.world.cinematic && this.introSkippable) {
      this.world.boss.skipIntro();
      return true;
    }
    if (code === 'KeyM') {
      this.audio.toggleMute();
      this.tips.toast(this.audio.muted ? 'Sonido apagado (<kbd>M</kbd>)' : 'Sonido encendido');
      return false;
    }
    if (code === 'Escape' && this.settingsScreen.isOpen) {
      this.settingsScreen.close();
      return false;
    }
    if (code === 'Escape' && this.fallback) {
      if (this.mode === 'play') this.setMode('paused');
      else if (this.mode === 'paused') this.enterPlay();
    }
    return false;
  }
}
