import { describe, expect, it } from 'vitest';
import { AXE } from '../data/axe';
import { BRUTE, DRAUGR } from '../data/enemies';
import { THROW } from '../data/attacks';
import { damageEnemy } from '../combat/damage';
import { input, makeWorld, placeEnemy, tick, ticksUntil } from '../game/testUtils';
import { Vector3 } from 'three';
import type { World } from '../game/World';

const tickOf = (seconds: number) => Math.ceil(Math.round(seconds * 60 * 1e6) / 1e6);

function aimForward(world: World): void {
  world.aimOrigin.set(0, 1.3, 0);
  world.aimDir.set(0, 0, 1);
}

describe('Hacha: lanzamiento', () => {
  it('sale de la mano a los 0,12 s y se clava en el piso', () => {
    const { world } = makeWorld();
    world.aimOrigin.set(0, 3, 0);
    world.aimDir.set(0, -1, 1).normalize();
    const surfaces: string[] = [];
    world.events.on('axe:embedded', (e) => surfaces.push(e.surface));

    tick(world, 1, input({ axe: true }));
    expect(world.player.state).toBe('throw');
    const n = ticksUntil(world, () => world.axe.state === 'flying');
    expect(n + 1).toBe(tickOf(THROW.releaseAt));
    ticksUntil(world, () => world.axe.state === 'ground');
    expect(surfaces).toEqual(['floor']);
    expect(world.axe.pos.y).toBeCloseTo(AXE.floorHeight);
  });

  it('solo se lanza estando libre', () => {
    const { world } = makeWorld();
    world.player.startAttack(0);
    tick(world, 1, input({ axe: true }));
    expect(world.player.state).toBe('attack');
    expect(world.axe.inHand).toBe(true);
  });

  it('al tocar un draugr hace 28, se clava y lo congela 2,8 s', () => {
    const { world, feedback } = makeWorld();
    aimForward(world);
    const e = placeEnemy(world, 'draugr', 0, 5);
    e.hp = 100;
    world.axe.throwFrom(world.player.handPos, world.aimOrigin, world.aimDir);
    ticksUntil(world, () => world.axe.state !== 'flying');
    expect(world.axe.state).toBe('stuck');
    expect(e.hp).toBe(100 - AXE.flightDamage);
    expect(e.state).toBe('frozen');
    expect(feedback.hitStops).toContain(AXE.flightHitStop);
    const n = ticksUntil(world, () => e.state !== 'frozen');
    expect(Math.abs(n - tickOf(DRAUGR.freezeDuration))).toBeLessThanOrEqual(1);
  });

  it('a los brutos los congela 1,5 s', () => {
    const { world } = makeWorld();
    aimForward(world);
    const e = placeEnemy(world, 'brute', 0, 5);
    world.axe.throwFrom(world.player.handPos, world.aimOrigin, world.aimDir);
    ticksUntil(world, () => world.axe.state !== 'flying');
    const n = ticksUntil(world, () => e.state !== 'frozen');
    expect(Math.abs(n - tickOf(BRUTE.freezeDuration))).toBeLessThanOrEqual(1);
  });

  it('si el enemigo muere con el hacha clavada, el hacha cae al piso', () => {
    const { world } = makeWorld();
    aimForward(world);
    const e = placeEnemy(world, 'draugr', 0, 5);
    e.hp = 100;
    world.axe.throwFrom(world.player.handPos, world.aimOrigin, world.aimDir);
    ticksUntil(world, () => world.axe.state !== 'flying');
    damageEnemy(world, e, 999, new Vector3(), 0);
    expect(world.axe.state).toBe('ground');
    expect(world.axe.pos.y).toBeLessThanOrEqual(AXE.dropMaxY);
  });

  it('se clava en una columna', () => {
    const { world } = makeWorld();
    world.player.handPos.set(0, 1.3, 0);
    world.aimOrigin.set(0, 1.3, 0);
    // Columna en (sin π/4, cos π/4) × 9.
    world.aimDir.set(1, 0, 1).normalize();
    const surfaces: string[] = [];
    world.events.on('axe:embedded', (e) => surfaces.push(e.surface));
    world.axe.throwFrom(world.player.handPos, world.aimOrigin, world.aimDir);
    ticksUntil(world, () => world.axe.state !== 'flying');
    expect(surfaces).toEqual(['obstacle']);
  });
});

describe('Hacha: llamado', () => {
  function recallFrom(world: World, z: number): number {
    world.axe.pos.set(0, AXE.floorHeight, z);
    world.axe.fsm.reset('ground');
    world.axe.recall();
    return ticksUntil(world, () => world.axe.inHand);
  }

  it('la duración es distancia / 26, entre 0,25 y 0,95 s', () => {
    for (const z of [2, 13, 40]) {
      const { world } = makeWorld();
      const dist = new Vector3(0, AXE.floorHeight, z).distanceTo(world.player.handPos);
      const expected = Math.min(Math.max(dist / AXE.recallSpeed, 0.25), 0.95);
      expect(Math.abs(recallFrom(world, z) - tickOf(expected))).toBeLessThanOrEqual(1);
    }
  });

  it('al atraparla hay hit-stop 0,035 y temblor 0,28', () => {
    const { world, feedback } = makeWorld();
    recallFrom(world, 10);
    expect(feedback.hitStops).toEqual([AXE.catchHitStop]);
    expect(feedback.shakes).toEqual([AXE.catchShake]);
  });

  it('pega 16 una sola vez a cada enemigo que cruza', () => {
    const { world } = makeWorld();
    // La curva se desvía hacia −X: desde z = 12 pasa por (−1,5; 3,5) camino a la mano.
    const e = placeEnemy(world, 'brute', -1.4, 3.5);
    e.hp = 500;
    recallFrom(world, 12);
    expect(e.hp).toBe(500 - AXE.recallDamage);
  });

  it('llamarla desde un enemigo congelado lo aturde y le hace 8', () => {
    const { world } = makeWorld();
    aimForward(world);
    const e = placeEnemy(world, 'draugr', 0, 5);
    e.hp = 100;
    world.axe.throwFrom(world.player.handPos, world.aimOrigin, world.aimDir);
    ticksUntil(world, () => world.axe.state !== 'flying');
    tick(world, 1, input({ recall: true }));
    expect(e.state).toBe('stagger');
    // Como en el prototipo, el hacha arranca dentro del enemigo y el recall también le pega.
    expect(e.hp).toBe(100 - AXE.flightDamage - AXE.unfreezeDamage - AXE.recallDamage);
    expect(world.axe.state).toBe('recall');
  });

  it('Q llama al hacha si no está en la mano', () => {
    const { world } = makeWorld();
    world.axe.pos.set(0, AXE.floorHeight, 5);
    world.axe.fsm.reset('ground');
    tick(world, 1, input({ axe: true }));
    expect(world.axe.state).toBe('recall');
  });
});
