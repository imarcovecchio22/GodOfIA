import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three';

interface Layer {
  action: AnimationAction;
  weight: number;
  target: number;
  /** Peso por segundo al subir o bajar. */
  rate: number;
}

export interface PlayOptions {
  fade: number;
  /** Repetir en loop (por defecto se reproduce una vez y queda en el último cuadro). */
  loop?: boolean;
  timeScale?: number;
  /** Reiniciar aunque ya sea la acción actual (un golpe nuevo con el mismo clip). */
  restart?: boolean;
}

/**
 * Mezcla de animaciones en dos capas:
 * - Base: locomoción con pesos por velocidad (quieto, caminar, correr).
 * - Acción: un clip encima de la base, con fundido de entrada y salida. Puede reproducirse solo o
 *   con el tiempo manejado desde afuera (`drive`), para sincronizarlo con la simulación.
 * Los pesos siempre suman 1, así nunca se mezcla con la pose de bind.
 */
export class Animator {
  readonly mixer: AnimationMixer;
  private readonly clips = new Map<string, AnimationClip>();
  private readonly actions = new Map<string, AnimationAction>();
  private readonly base = new Map<string, Layer>();
  private readonly overlays: Layer[] = [];
  private current: Layer | null = null;

  constructor(root: Object3D, clips: AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    for (const c of clips) this.clips.set(c.name, c);
  }

  private action(name: string): AnimationAction {
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.clips.get(name);
      if (!clip) throw new Error(`No existe el clip ${name}`);
      a = this.mixer.clipAction(clip);
      this.actions.set(name, a);
    }
    return a;
  }

  duration(name: string): number {
    return this.clips.get(name)?.duration ?? 0;
  }

  /** Peso objetivo y velocidad de un clip de la capa base (en loop). */
  setBase(name: string, weight: number, timeScale: number, fade: number): void {
    let layer = this.base.get(name);
    if (!layer) {
      const action = this.action(name);
      action.setLoop(LoopRepeat, Infinity);
      action.play();
      action.setEffectiveWeight(0);
      layer = { action, weight: 0, target: 0, rate: 1 };
      this.base.set(name, layer);
    }
    layer.target = weight;
    layer.rate = fade > 0 ? 1 / fade : Infinity;
    layer.action.timeScale = timeScale;
  }

  get currentAction(): string | null {
    return this.current?.action.getClip().name ?? null;
  }

  private startOverlay(name: string, opts: PlayOptions): Layer {
    const rate = opts.fade > 0 ? 1 / opts.fade : Infinity;
    if (this.current && this.current.action.getClip().name === name && !opts.restart) {
      return this.current;
    }
    // La acción anterior se desvanece.
    if (this.current) {
      this.current.target = 0;
      this.current.rate = rate;
    }
    const action = this.action(name);
    let layer = this.overlays.find((o) => o.action === action);
    if (!layer) {
      layer = { action, weight: 0, target: 1, rate };
      this.overlays.push(layer);
    }
    layer.target = 1;
    layer.rate = rate;
    action.reset();
    action.setLoop(opts.loop ? LoopRepeat : LoopOnce, opts.loop ? Infinity : 1);
    action.clampWhenFinished = !opts.loop;
    action.timeScale = opts.timeScale ?? 1;
    action.play();
    this.current = layer;
    return layer;
  }

  /** Reproduce un clip encima de la base. */
  play(name: string, opts: PlayOptions): void {
    this.startOverlay(name, opts);
  }

  /** Muestra el clip en un tiempo dado (lo calcula quien llama a partir de la simulación). */
  drive(name: string, clipTime: number, opts: PlayOptions): void {
    const layer = this.startOverlay(name, opts);
    layer.action.timeScale = 0;
    layer.action.time = Math.min(clipTime, layer.action.getClip().duration);
  }

  /** Vuelve a la capa base. */
  stop(fade: number): void {
    if (!this.current) return;
    this.current.target = 0;
    this.current.rate = fade > 0 ? 1 / fade : Infinity;
    this.current = null;
  }

  update(dt: number): void {
    const step = (l: Layer): void => {
      const d = l.rate * dt;
      if (!Number.isFinite(d) || Math.abs(l.target - l.weight) <= d) l.weight = l.target;
      else l.weight += Math.sign(l.target - l.weight) * d;
    };
    let overlaySum = 0;
    for (let i = this.overlays.length - 1; i >= 0; i--) {
      const l = this.overlays[i];
      if (!l) continue;
      step(l);
      if (l.weight <= 0 && l !== this.current) {
        l.action.stop();
        this.overlays.splice(i, 1);
        continue;
      }
      overlaySum += l.weight;
    }
    // Si hay más de una acción en transición, se normalizan para no pasar de 1.
    const overlayScale = overlaySum > 1 ? 1 / overlaySum : 1;
    for (const l of this.overlays) l.action.setEffectiveWeight(l.weight * overlayScale);

    let baseSum = 0;
    for (const l of this.base.values()) {
      step(l);
      baseSum += l.weight;
    }
    const baseShare = Math.max(0, 1 - Math.min(overlaySum, 1));
    for (const l of this.base.values()) {
      l.action.setEffectiveWeight(baseSum > 0 ? (l.weight / baseSum) * baseShare : 0);
    }
    this.mixer.update(dt);
  }
}
