import { Rng } from '../core/Rng';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { rapier } from '../physics/rapier';
import type { EnemyKind } from '../data/enemies';
import type { EnemySim } from '../entities/Enemy';
import { NO_INPUT, type PlayerInput } from '../entities/Player';
import type { Feedback } from './events';
import { World } from './World';

/** Solo para tests: mundo con semilla fija y un registro del feedback pedido. */
export const STEP = 1 / 60;

export class RecordingFeedback implements Feedback {
  hitStops: number[] = [];
  shakes: number[] = [];
  hitStop(s: number): void {
    this.hitStops.push(s);
  }
  shake(a: number): void {
    this.shakes.push(a);
  }
}

export function makeWorld(seed = 1): {
  world: World;
  feedback: RecordingFeedback;
  physics: PhysicsWorld;
} {
  const feedback = new RecordingFeedback();
  const physics = new PhysicsWorld(rapier());
  const world = new World(feedback, physics, new Rng(seed));
  world.reset();
  // Jugador en el origen mirando a +Z; la cámara detrás (yaw = π → adelante es +Z).
  world.player.pos.set(0, 0, 0);
  world.player.facing = 0;
  world.player.handPos.set(0, 1.3, 0);
  world.camYaw = Math.PI;
  // Sin oleadas automáticas: cada test pone sus enemigos.
  world.waves.between = Number.POSITIVE_INFINITY;
  return { world, feedback, physics };
}

export function input(over: Partial<PlayerInput> = {}): PlayerInput {
  return { ...NO_INPUT, ...over };
}

export function tick(world: World, n = 1, inp: PlayerInput = NO_INPUT): void {
  for (let i = 0; i < n; i++) world.step(STEP, inp);
}

/** Avanza hasta que se cumpla la condición; devuelve la cantidad de ticks o -1. */
export function ticksUntil(world: World, cond: () => boolean, max = 600): number {
  for (let i = 1; i <= max; i++) {
    world.step(STEP, NO_INPUT);
    if (cond()) return i;
  }
  return -1;
}

/** Enemigo ya activo (sin animación de aparición), quieto y sin ganas de atacar. */
export function placeEnemy(world: World, kind: EnemyKind, x: number, z: number): EnemySim {
  const e = world.enemies.spawn(kind, 1);
  e.pos.set(x, 0, z);
  e.prevPos.copy(e.pos);
  e.fsm.reset('chase');
  e.cooldown = 999;
  e.speed = 0;
  return e;
}
