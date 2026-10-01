import { ORBS } from '../data/waves';
import type { World } from '../game/World';

export interface Orb {
  active: boolean;
  x: number;
  z: number;
  t: number;
}

/** Orbes de vida que sueltan los enemigos. Pool fijo que crece si hace falta. */
export class Orbs {
  readonly pool: Orb[] = [];

  constructor(private readonly world: World) {}

  spawn(x: number, z: number): void {
    let o = this.pool.find((p) => !p.active);
    if (!o) {
      o = { active: false, x: 0, z: 0, t: 0 };
      this.pool.push(o);
    }
    o.active = true;
    o.x = x;
    o.z = z;
    o.t = 0;
  }

  clear(): void {
    for (const o of this.pool) o.active = false;
  }

  step(dt: number): void {
    const player = this.world.player;
    for (const o of this.pool) {
      if (!o.active) continue;
      o.t += dt;
      const d = Math.hypot(o.x - player.pos.x, o.z - player.pos.z);
      if (d < ORBS.pickupRadius && player.hp < player.maxHp && player.alive) {
        player.heal(ORBS.heal);
        this.world.events.emit('player:healed', { x: o.x, y: this.heightAt(o), z: o.z });
        o.active = false;
        continue;
      }
      if (o.t > ORBS.lifetime) o.active = false;
    }
  }

  heightAt(o: Orb): number {
    return ORBS.height + Math.sin(o.t * ORBS.bobSpeed) * ORBS.bobAmplitude;
  }
}
