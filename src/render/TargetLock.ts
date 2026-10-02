import { Vector3 } from 'three';
import { BOSS } from '../data/boss';
import { LOCK_ON } from '../data/bossView';
import type { BossSim } from '../entities/Boss';
import type { EnemySim } from '../entities/Enemy';
import type { World } from '../game/World';

type Target = EnemySim | BossSim;

/**
 * Fijación de objetivo (click del medio o Tab): elige al enemigo o al jefe más cerca del centro de
 * la cámara y la cámara lo mantiene en cuadro. Es solo de cámara: no toca la simulación.
 */
export class TargetLock {
  private target: Target | null = null;

  get active(): boolean {
    return this.target !== null;
  }

  clear(): void {
    this.target = null;
  }

  /** Fija el mejor objetivo o suelta el actual. `camYaw`: adelante es (−sin, −cos). */
  toggle(world: World, camYaw: number): void {
    if (this.target) {
      this.target = null;
      return;
    }
    const p = world.player.pos;
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    let best: Target | null = null;
    let bestScore = Infinity;
    const consider = (t: Target, x: number, z: number) => {
      const dx = x - p.x;
      const dz = z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > LOCK_ON.range) return;
      const angle = dist > 0.01 ? Math.acos(Math.min(1, (dx * fx + dz * fz) / dist)) : 0;
      if (angle > LOCK_ON.maxAngle) return;
      const score = angle + dist * LOCK_ON.distanceWeight;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    };
    if (world.boss.alive) consider(world.boss, world.boss.pos.x, world.boss.pos.z);
    for (const e of world.enemies.active) if (e.alive) consider(e, e.pos.x, e.pos.z);
    this.target = best;
  }

  /** Suelta el objetivo si murió o quedó lejos. */
  validate(world: World): void {
    const t = this.target;
    if (!t) return;
    const p = world.player.pos;
    const far = Math.hypot(t.pos.x - p.x, t.pos.z - p.z) > LOCK_ON.keepRange;
    if (!t.alive || far) this.target = null;
  }

  /** Punto a mantener en cuadro (interpolado). Devuelve false si no hay objetivo. */
  focus(out: Vector3, alpha: number): boolean {
    const t = this.target;
    if (!t) return false;
    out.lerpVectors(t.prevPos, t.pos, alpha);
    out.y = this.height(t) * LOCK_ON.markerHeight;
    return true;
  }

  private height(t: Target): number {
    return 'arch' in t ? t.arch.hitHeight * 1.4 : BOSS.height;
  }
}

/** Para posicionar el marcador en pantalla sin allocations. */
export const lockPoint = new Vector3();
