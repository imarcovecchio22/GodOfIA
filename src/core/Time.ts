import { ENGINE } from '../data/engine';

/**
 * Reloj de la simulación con paso fijo.
 *
 * Por frame: `beginFrame(dtReal)` y después `while (time.consumeStep()) simular(time.step)`.
 * El render usa `alpha` para interpolar entre el estado anterior y el actual.
 *
 * - El hit-stop se descuenta en tiempo real y congela la simulación, no el render.
 * - `timeScale` escala el tiempo que entra a la simulación (cámara lenta).
 */
export class Time {
  readonly step: number;
  private readonly maxFrameDelta: number;

  private accumulator = 0;
  private stopRemaining = 0;

  /** Escala aplicada al tiempo de simulación. 1 = normal. */
  timeScale = 1;
  paused = false;

  /** Tiempo de simulación acumulado, en segundos. */
  simTime = 0;
  /** Cantidad de pasos simulados desde el inicio. */
  tick = 0;
  /** Tiempo real acumulado (para efectos que no se congelan). */
  realTime = 0;

  constructor(simHz: number = ENGINE.simHz, maxFrameDelta: number = ENGINE.maxFrameDelta) {
    this.step = 1 / simHz;
    this.maxFrameDelta = maxFrameDelta;
  }

  /** Congela la simulación `seconds` segundos reales. No se acumula: gana el más largo. */
  hitStop(seconds: number): void {
    this.stopRemaining = Math.max(this.stopRemaining, seconds);
  }

  get frozen(): boolean {
    return this.stopRemaining > 0;
  }

  /** Devuelve el delta real ya limitado, para cámara, HUD y ambiente. */
  beginFrame(realDelta: number): number {
    const dt = Math.min(Math.max(realDelta, 0), this.maxFrameDelta);
    this.realTime += dt;
    if (this.paused) return dt;

    let simDelta = dt;
    if (this.stopRemaining > 0) {
      const used = Math.min(this.stopRemaining, simDelta);
      this.stopRemaining -= used;
      // Evita que un residuo de punto flotante deje la simulación congelada un frame de más.
      if (this.stopRemaining < 1e-9) this.stopRemaining = 0;
      simDelta -= used;
    }
    this.accumulator += simDelta * this.timeScale;
    return dt;
  }

  /** Consume un paso si hay tiempo acumulado y la simulación no está congelada. */
  consumeStep(): boolean {
    if (this.paused || this.stopRemaining > 0 || this.accumulator < this.step) return false;
    this.accumulator -= this.step;
    this.simTime += this.step;
    this.tick++;
    return true;
  }

  /** Fracción del próximo paso ya transcurrida, en [0, 1). */
  get alpha(): number {
    return Math.min(this.accumulator / this.step, 1);
  }

  reset(): void {
    this.accumulator = 0;
    this.stopRemaining = 0;
    this.timeScale = 1;
    this.paused = false;
    this.simTime = 0;
    this.tick = 0;
  }
}
