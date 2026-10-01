import type { World } from '../game/World';

/**
 * Ayudas contextuales para quien nunca jugó: cada una aparece una sola vez (se recuerda en
 * localStorage), en el momento en que hace falta, y no interrumpe el juego.
 */
type TipId = 'start' | 'combo' | 'throw' | 'recall' | 'dodge' | 'heavy' | 'orb';

const TIPS: Record<TipId, string> = {
  start: 'Movete con <kbd>W A S D</kbd> y atacá con <kbd>click izquierdo</kbd>.',
  combo: 'Seguí haciendo click: son <b>tres hachazos</b> seguidos, el tercero pega más fuerte.',
  throw: 'Apretá <kbd>Q</kbd> para lanzar el hacha: congela al que toca.',
  recall:
    'Sin hacha pegás a puño. <kbd>Q</kbd> o <kbd>E</kbd> la llaman de vuelta, y corta a todo lo que cruza.',
  dodge: 'Ojos rojos: está por atacar. Rodá con <kbd>Espacio</kbd> para esquivarlo.',
  heavy: 'Los brutos aguantan los golpes livianos. El <kbd>click derecho</kbd> los tumba.',
  orb: 'Los orbes verdes te curan. Pasá por encima.',
};

const KEY = 'furia-tips';
const SHOW_SECONDS = 5.5;
/** Pausa entre ayudas para que no se encimen. */
const GAP_SECONDS = 1.5;
/** Bajas sin haber lanzado el hacha antes de sugerirlo. */
const KILLS_BEFORE_THROW_TIP = 3;
/** Segundos con el hacha afuera antes de recordar cómo llamarla. */
const AXE_OUT_BEFORE_RECALL_TIP = 3;
/** Distancia a la que una carga enemiga merece el aviso de la rodada. */
const DODGE_TIP_DISTANCE = 4;

function loadSeen(): Set<TipId> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as TipId[]);
  } catch {
    return new Set();
  }
}

export class Tips {
  private readonly el: HTMLElement;
  private readonly seen = loadSeen();
  private readonly queue: TipId[] = [];
  private showing = 0;
  private gap = 0;
  private throws = 0;
  private axeOut = 0;
  private active = false;

  constructor(private readonly world: World) {
    const e = document.getElementById('tip');
    if (!e) throw new Error('Falta #tip en index.html');
    this.el = e;
    const ev = world.events;
    ev.on('axe:thrown', () => this.throws++);
    ev.on('player:hit-landed', () => {
      this.request('combo');
    });
    ev.on('enemy:killed', () => {
      if (this.throws === 0 && world.stats.kills >= KILLS_BEFORE_THROW_TIP) this.request('throw');
    });
    ev.on('enemy:windup', ({ enemy }) => {
      if (enemy.distToPlayer < DODGE_TIP_DISTANCE) this.request('dodge');
    });
    ev.on('enemy:spawned', ({ enemy }) => {
      if (enemy.arch.armored) this.request('heavy');
    });
  }

  /** Al empezar una partida. */
  start(): void {
    this.active = true;
    this.request('start');
  }

  stop(): void {
    this.active = false;
    this.queue.length = 0;
    this.hide();
  }

  private request(id: TipId): void {
    if (!this.active || this.seen.has(id) || this.queue.includes(id)) return;
    this.queue.push(id);
  }

  private markSeen(id: TipId): void {
    this.seen.add(id);
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.seen]));
    } catch {
      // Sin almacenamiento: las ayudas pueden repetirse en otra sesión.
    }
  }

  /** Mensaje suelto (por ejemplo, el aviso de silencio). */
  toast(html: string): void {
    this.el.innerHTML = html;
    this.el.classList.add('show');
    this.showing = 2;
  }

  private hide(): void {
    this.el.classList.remove('show');
    this.showing = 0;
  }

  update(realDt: number): void {
    const w = this.world;
    if (this.active) {
      this.axeOut = w.axe.inHand ? 0 : this.axeOut + realDt;
      if (this.axeOut > AXE_OUT_BEFORE_RECALL_TIP) this.request('recall');
      if (w.orbs.pool.some((o) => o.active)) this.request('orb');
    }

    if (this.showing > 0) {
      this.showing -= realDt;
      if (this.showing <= 0) {
        this.hide();
        this.gap = GAP_SECONDS;
      }
      return;
    }
    this.gap -= realDt;
    const next = this.queue.shift();
    if (!next || this.gap > 0) {
      if (next) this.queue.unshift(next);
      return;
    }
    this.markSeen(next);
    this.el.innerHTML = TIPS[next];
    this.el.classList.add('show');
    this.showing = SHOW_SECONDS;
  }
}
