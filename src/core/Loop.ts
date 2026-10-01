import type { Time } from './Time';

export interface LoopHandlers {
  /** Un paso de simulación de duración fija `step`. */
  update(step: number): void;
  /** Un frame de render. `alpha` interpola entre pasos; `realDt` es para cámara, HUD y ambiente. */
  render(alpha: number, realDt: number): void;
}

/** Game loop sobre requestAnimationFrame con simulación de paso fijo. */
export class Loop {
  private last = 0;
  private rafId = 0;
  private running = false;

  /** Pasos simulados en el último frame (para el overlay de debug). */
  lastSteps = 0;

  constructor(
    private readonly time: Time,
    private readonly handlers: LoopHandlers,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);
    const realDt = this.time.beginFrame((now - this.last) / 1000);
    this.last = now;

    let steps = 0;
    while (this.time.consumeStep()) {
      this.handlers.update(this.time.step);
      steps++;
    }
    this.lastSteps = steps;
    this.handlers.render(this.time.alpha, realDt);
  };
}
