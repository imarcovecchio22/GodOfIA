import { BOSS } from '../data/boss';
import { PLAYER } from '../data/player';
import { isBossWave } from '../game/WaveDirector';
import type { World } from '../game/World';

const CROSS_ICE_MS = 250;
const GHOST_DRAIN = 30;
const HURT_FLASH_DECAY = 2.5;
/** La barra fantasma del jefe baja a esta fracción por segundo. */
const BOSS_GHOST_DRAIN = 0.25;

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Falta #${id} en index.html`);
  return e;
}

/** Restarta una animación CSS sacando y poniendo la clase. */
function replay(e: HTMLElement, cls: string): void {
  e.classList.remove(cls);
  e.getBoundingClientRect(); // fuerza un reflow para reiniciar la animación
  e.classList.add(cls);
}

/** HUD en DOM liviano. Solo escribe en el DOM cuando cambia algo. */
export class Hud {
  private readonly hpFill = el('hpFill');
  private readonly hpGhost = el('hpGhost');
  private readonly axeStatus = el('axeStatus');
  private readonly waveTxt = el('waveTxt');
  private readonly killsTxt = el('killsTxt');
  private readonly combo = el('combo');
  private readonly comboNum = el('comboNum');
  private readonly cross = el('cross');
  private readonly banner = el('banner');
  private readonly vig = el('vig');
  private readonly lowhp = el('lowhp');
  private readonly letterbox = el('letterbox');
  private readonly bossBar = el('bossBar');
  private readonly bossFill = el('bossFill');
  private readonly bossGhost = el('bossGhost');
  private readonly bossTitle = el('bossTitle');
  private readonly skipHint = el('skipHint');
  private readonly lockMark = el('lockMark');
  private bossGhostHp = 1;

  private ghost: number = PLAYER.maxHp;
  private hurtFlash = 0;
  private readonly cache = new Map<HTMLElement, string>();

  constructor(private readonly world: World) {
    const ev = world.events;
    ev.on('combo:changed', () => {
      replay(this.combo, 'pop');
    });
    ev.on('axe:caught', () => {
      this.cross.classList.add('ice');
      setTimeout(() => {
        this.cross.classList.remove('ice');
      }, CROSS_ICE_MS);
    });
    ev.on('player:hurt', () => {
      this.hurtFlash = 1;
    });
    ev.on('wave:start', ({ wave, boss }) => {
      // En la oleada de jefe el cartel es su nombre, durante la entrada.
      if (!boss) this.showBanner(`Oleada ${wave}`);
    });
    ev.on('wave:cleared', ({ wave }) => {
      if (!isBossWave(wave)) this.showBanner('Oleada superada');
    });
    ev.on('boss:intro', () => {
      this.bossGhostHp = 1;
      replay(this.bossTitle, 'show');
    });
    ev.on('boss:defeated', () => {
      this.showBanner('Victoria');
    });

    el('bossName').textContent = BOSS.name;
    el('bossTitleName').textContent = BOSS.name;
    // Marcas donde empiezan las fases 2 y 3.
    const track = el('bossTrack');
    for (const f of BOSS.phaseThresholds) {
      const mark = document.createElement('i');
      mark.style.left = `${(f * 100).toFixed(1)}%`;
      track.appendChild(mark);
    }
  }

  private set(e: HTMLElement, text: string): void {
    if (this.cache.get(e) === text) return;
    this.cache.set(e, text);
    e.textContent = text;
  }

  private setStyle(e: HTMLElement, prop: 'transform' | 'opacity', value: string): void {
    const key = `${prop}:${value}`;
    if (e.dataset.last === key) return;
    e.dataset.last = key;
    e.style[prop] = value;
  }

  showBanner(text: string): void {
    this.banner.textContent = text;
    replay(this.banner, 'show');
  }

  reset(): void {
    this.ghost = PLAYER.maxHp;
    this.hurtFlash = 0;
    this.bossTitle.classList.remove('show');
    this.setLock(false, 0, 0);
    this.setSkipHint(false);
  }

  /** Marcador del objetivo fijado, en píxeles de pantalla. */
  setLock(on: boolean, x: number, y: number): void {
    this.lockMark.classList.toggle('on', on);
    if (on)
      this.lockMark.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(45deg)`;
  }

  setSkipHint(on: boolean): void {
    this.skipHint.classList.toggle('hidden', !on);
  }

  /** Corre en tiempo real (el prototipo actualiza el HUD también en pausa). */
  update(realDt: number): void {
    const w = this.world;
    const p = w.player;
    const max = PLAYER.maxHp;
    this.ghost = this.ghost > p.hp ? Math.max(p.hp, this.ghost - realDt * GHOST_DRAIN) : p.hp;
    this.setStyle(this.hpFill, 'transform', `scaleX(${(p.hp / max).toFixed(4)})`);
    this.setStyle(this.hpGhost, 'transform', `scaleX(${(this.ghost / max).toFixed(4)})`);

    this.set(this.waveTxt, `Oleada ${Math.max(1, w.waves.wave)}`);
    const k = w.stats.kills;
    this.set(this.killsTxt, `${k} ${k === 1 ? 'baja' : 'bajas'}`);

    const s = w.stats;
    this.setStyle(this.combo, 'opacity', s.combo > 1 ? Math.min(1, s.comboTimer).toFixed(3) : '0');
    this.set(this.comboNum, String(s.combo));

    const axe = w.axe;
    const msg = axe.inHand
      ? 'Hacha en mano. Q para lanzarla'
      : axe.state === 'recall'
        ? 'Vuelve…'
        : 'Hacha afuera. Q o E para llamarla, mientras tanto pegás a puño';
    this.set(this.axeStatus, msg);
    this.axeStatus.classList.toggle('out', !axe.inHand);

    this.hurtFlash = Math.max(0, this.hurtFlash - realDt * HURT_FLASH_DECAY);
    this.setStyle(this.vig, 'opacity', this.hurtFlash.toFixed(3));
    this.lowhp.classList.toggle('on', p.hp > 0 && p.hp < PLAYER.lowHpThreshold);

    const b = w.boss;
    this.letterbox.classList.toggle('on', w.cinematic);
    const showBoss = b.active && !w.cinematic;
    this.bossBar.classList.toggle('hidden', !showBoss);
    if (showBoss) {
      const f = b.hpFraction;
      this.bossGhostHp =
        this.bossGhostHp > f ? Math.max(f, this.bossGhostHp - realDt * BOSS_GHOST_DRAIN) : f;
      this.setStyle(this.bossFill, 'transform', `scaleX(${f.toFixed(4)})`);
      this.setStyle(this.bossGhost, 'transform', `scaleX(${this.bossGhostHp.toFixed(4)})`);
      this.bossBar.classList.toggle('broken', b.state === 'broken');
    }
  }
}
