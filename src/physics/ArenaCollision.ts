import type { Vector3 } from 'three';
import { ARENA, pillarPositions, torchPositions, type CircleObstacle } from '../data/arena';

/**
 * Colisión analítica del prototipo: obstáculos circulares y borde de la arena.
 * Es el puente hasta la fase 2, donde la reemplazan los colliders de Rapier.
 */
export class ArenaCollision {
  readonly obstacles: CircleObstacle[] = [...pillarPositions(), ...torchPositions()];

  /** Empuja `pos` fuera de los obstáculos y la mantiene dentro de la arena. */
  collide(pos: Vector3, radius: number): void {
    for (const o of this.obstacles) {
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + radius;
      if (d < min && d > 1e-4) {
        pos.x = o.x + (dx / d) * min;
        pos.z = o.z + (dz / d) * min;
      }
    }
    const d = Math.hypot(pos.x, pos.z);
    const limit = ARENA.radius - ARENA.edgePadding - radius;
    if (d > limit) {
      pos.x *= limit / d;
      pos.z *= limit / d;
    }
  }

  /** Obstáculo que contiene el punto (con margen) por debajo de `maxY`, o null. */
  obstacleAt(pos: Vector3, padding: number, maxY: number): CircleObstacle | null {
    if (pos.y >= maxY) return null;
    for (const o of this.obstacles) {
      if (Math.hypot(pos.x - o.x, pos.z - o.z) < o.r + padding) return o;
    }
    return null;
  }
}
