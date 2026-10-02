import { areaContains, type AreaShape } from '../combat/areas';
import type { World } from './World';

export type HazardKind = 'burn' | 'cold';

/** Zona que hace daño por segundo mientras el jugador está adentro (grieta de hielo, frío). */
export interface Hazard {
  active: boolean;
  kind: HazardKind;
  shape: AreaShape;
  x: number;
  z: number;
  dps: number;
  /** Segundos de vida restantes (Infinity = hasta que se quite). */
  life: number;
  /** Tiempo desde que apareció (para la vista). */
  t: number;
}

export class Hazards {
  readonly pool: Hazard[] = [];

  constructor(private readonly world: World) {}

  add(kind: HazardKind, shape: AreaShape, x: number, z: number, dps: number, life: number): Hazard {
    let h = this.pool.find((p) => !p.active);
    if (!h) {
      h = { active: false, kind, shape, x: 0, z: 0, dps: 0, life: 0, t: 0 };
      this.pool.push(h);
    }
    Object.assign(h, { active: true, kind, shape, x, z, dps, life, t: 0 });
    return h;
  }

  remove(kind: HazardKind): void {
    for (const h of this.pool) if (h.kind === kind) h.active = false;
  }

  clear(): void {
    for (const h of this.pool) h.active = false;
  }

  step(dt: number): void {
    const p = this.world.player;
    for (const h of this.pool) {
      if (!h.active) continue;
      h.t += dt;
      h.life -= dt;
      if (h.life <= 0) {
        h.active = false;
        continue;
      }
      if (p.alive && areaContains(h.shape, h.x, h.z, 0, p.pos.x, p.pos.z)) {
        p.damageOverTime(h.dps * dt);
      }
    }
  }
}
