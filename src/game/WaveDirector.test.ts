import { describe, expect, it } from 'vitest';
import { WAVES } from '../data/waves';
import { makeWorld, tick, ticksUntil } from './testUtils';
import { maxAlive, waveComposition } from './WaveDirector';

describe('Oleadas', () => {
  it('composición: 3 + 2 × oleada, brutos (oleada − 1) / 2', () => {
    expect(waveComposition(1)).toEqual({ total: 5, brutes: 0 });
    expect(waveComposition(2)).toEqual({ total: 7, brutes: 0 });
    expect(waveComposition(3)).toEqual({ total: 9, brutes: 1 });
    expect(waveComposition(5)).toEqual({ total: 13, brutes: 2 });
    expect(maxAlive(1)).toBe(5);
    expect(maxAlive(6)).toBe(10);
  });

  it('la primera oleada arranca a los 1,2 s y respeta el máximo de vivos', () => {
    const { world } = makeWorld();
    world.waves.reset();
    const starts: number[] = [];
    world.events.on('wave:start', ({ wave }) => starts.push(wave));
    const n = ticksUntil(world, () => starts.length > 0);
    expect(Math.abs(n - Math.ceil(WAVES.initialDelay * 60))).toBeLessThanOrEqual(1);
    tick(world, 600);
    expect(world.enemies.aliveCount).toBe(maxAlive(1));
    expect(world.waves.toSpawn).toBe(waveComposition(1).total - maxAlive(1));
  });

  it('spawnea todos los brutos de la oleada', () => {
    const { world } = makeWorld(7);
    world.waves.reset();
    world.waves.wave = 4;
    world.waves.between = 0;
    let brutes = 0;
    world.events.on('enemy:spawned', ({ enemy }) => {
      if (enemy.arch.kind === 'brute') brutes++;
    });
    tick(world, 1);
    expect(world.waves.wave).toBe(5);
    for (let i = 0; i < 3000 && world.waves.toSpawn > 0; i++) {
      tick(world, 1);
      for (const e of [...world.enemies.active]) if (e.alive) world.enemies.kill(e);
    }
    expect(brutes).toBe(waveComposition(5).brutes);
  });

  it('al limpiar una oleada cura 20 y da 3 s de respiro', () => {
    const { world } = makeWorld();
    world.waves.reset();
    world.player.hp = 50;
    const cleared: number[] = [];
    world.events.on('wave:cleared', ({ wave }) => cleared.push(wave));
    ticksUntil(world, () => world.waves.wave === 1);
    // Mata a cada uno apenas aparece hasta vaciar la oleada.
    for (let i = 0; i < 3000 && cleared.length === 0; i++) {
      tick(world, 1);
      for (const e of [...world.enemies.active]) if (e.alive) world.enemies.kill(e);
    }
    expect(cleared).toEqual([1]);
    expect(world.player.hp).toBe(50 + WAVES.clearHeal);
    const n = ticksUntil(world, () => world.waves.wave === 2);
    expect(Math.abs(n - WAVES.breather * 60)).toBeLessThanOrEqual(2);
  });
});
