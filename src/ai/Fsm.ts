/**
 * Máquina de estados finita genérica.
 *
 * Cada estado define `enter`, `update` y `exit` opcionales. `update` devuelve el estado siguiente
 * (o nada para quedarse). `t` es el tiempo en el estado actual; se incrementa antes de `update`.
 */
export interface StateDef<S extends string, C> {
  enter?(ctx: C): void;
  update?(ctx: C, dt: number): S | undefined;
  exit?(ctx: C): void;
}

export type StateTable<S extends string, C> = Record<S, StateDef<S, C>>;

export class Fsm<S extends string, C> {
  private current: S;
  /** Tiempo en el estado actual. */
  t = 0;

  constructor(
    private readonly table: StateTable<S, C>,
    initial: S,
  ) {
    this.current = initial;
  }

  get state(): S {
    return this.current;
  }

  is(state: S): boolean {
    return this.current === state;
  }

  /** Cambia de estado (aunque sea el mismo: reinicia `t` y vuelve a llamar `enter`). */
  go(next: S, ctx: C): void {
    this.table[this.current].exit?.(ctx);
    this.current = next;
    this.t = 0;
    this.table[next].enter?.(ctx);
  }

  update(ctx: C, dt: number): void {
    // Redondeo a 1e-9 para que 6 pasos de 1/60 den exactamente 0,1 y las ventanas de la tabla
    // caigan en el tick esperado.
    this.t = Math.round((this.t + dt) * 1e9) / 1e9;
    const next = this.table[this.current].update?.(ctx, dt);
    if (next !== undefined && next !== this.current) this.go(next, ctx);
  }

  /** Fuerza un estado sin llamar `exit`/`enter` (para reiniciar una partida). */
  reset(state: S): void {
    this.current = state;
    this.t = 0;
  }
}
