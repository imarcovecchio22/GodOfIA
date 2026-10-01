import { COMBO } from '../data/waves';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from './events';

/** Bajas y contador de combo de la partida. */
export class Stats {
  kills = 0;
  combo = 0;
  /** Segundos que le quedan al combo antes de reiniciarse. */
  comboTimer = 0;
  bestCombo = 0;

  constructor(private readonly events: EventBus<GameEvents>) {}

  registerHit(): void {
    this.combo++;
    this.comboTimer = COMBO.window;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.events.emit('combo:changed', { combo: this.combo });
  }

  resetCombo(): void {
    this.combo = 0;
  }

  /**
   * El prototipo descuenta el combo en tiempo real (sigue corriendo en pausa y durante el
   * hit-stop), así que se llama desde el render y no desde la simulación.
   */
  tickRealTime(realDt: number): void {
    this.comboTimer -= realDt;
    if (this.comboTimer <= 0) this.combo = 0;
  }

  reset(): void {
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
  }
}
