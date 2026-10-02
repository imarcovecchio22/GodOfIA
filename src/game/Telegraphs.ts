import type { AreaShape } from '../combat/areas';

/**
 * Aviso de un golpe: el área exacta que va a pegar y cuánto falta. Lo dibuja `render/Decals`.
 * Sistema genérico: cualquier enemigo puede pedir uno (el jefe hoy, el arquero en la fase 6).
 */
export interface Telegraph {
  active: boolean;
  id: number;
  shape: AreaShape;
  x: number;
  z: number;
  dir: number;
  /** Tiempo transcurrido y duración de la carga: el decal se llena a medida que se acerca. */
  t: number;
  duration: number;
}

export class Telegraphs {
  readonly pool: Telegraph[] = [];
  private nextId = 1;

  show(shape: AreaShape, x: number, z: number, dir: number, duration: number): Telegraph {
    let tg = this.pool.find((p) => !p.active);
    if (!tg) {
      tg = { active: false, id: 0, shape, x: 0, z: 0, dir: 0, t: 0, duration: 0 };
      this.pool.push(tg);
    }
    tg.active = true;
    tg.id = this.nextId++;
    tg.shape = shape;
    tg.x = x;
    tg.z = z;
    tg.dir = dir;
    tg.t = 0;
    tg.duration = duration;
    return tg;
  }

  hide(tg: Telegraph | null): void {
    if (tg) tg.active = false;
  }

  step(dt: number): void {
    for (const tg of this.pool) if (tg.active) tg.t += dt;
  }

  clear(): void {
    for (const tg of this.pool) tg.active = false;
  }
}
