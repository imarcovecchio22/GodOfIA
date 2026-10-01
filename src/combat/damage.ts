import type { Vector3 } from 'three';
import type { EnemySim } from '../entities/Enemy';
import type { World } from '../game/World';

export interface DamageOptions {
  /** Punto de impacto para los FX. Por defecto, el centro del enemigo a su altura de impacto. */
  x?: number;
  y?: number;
  z?: number;
  /** Rompe la súper armadura. */
  heavy?: boolean;
}

/**
 * Aplica daño a un enemigo: vida, destello, empuje, aturdimiento y muerte.
 * Devuelve false si el enemigo no podía recibir daño (muerto o saliendo del piso).
 */
export function damageEnemy(
  world: World,
  e: EnemySim,
  amount: number,
  dir: Vector3,
  knockback: number,
  opts: DamageOptions = {},
): boolean {
  if (!e.canBeHit) return false;
  e.hp -= amount;
  e.flash = 1;
  const frozen = e.fsm.is('frozen');
  if (!frozen) e.kb.addScaledVector(dir, knockback * e.arch.knockbackTaken);

  world.events.emit('enemy:hit', {
    enemy: e,
    x: opts.x ?? e.pos.x,
    y: opts.y ?? e.arch.hitHeight,
    z: opts.z ?? e.pos.z,
  });
  world.stats.registerHit();

  if (e.hp <= 0) {
    world.enemies.kill(e);
    return true;
  }
  if (!frozen && (!e.arch.armored || opts.heavy === true)) e.fsm.go('stagger', e);
  return true;
}
