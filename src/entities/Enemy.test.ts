import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { damageEnemy } from '../combat/damage';
import { BRUTE, DRAUGR, ENEMY } from '../data/enemies';
import { makeWorld, placeEnemy, tick, ticksUntil } from '../game/testUtils';

const tickOf = (seconds: number) => Math.ceil(Math.round(seconds * 60 * 1e6) / 1e6);

describe('Enemigos', () => {
  it('aparecen a más de 8 u del jugador y salen del piso en 1,1 s', () => {
    const { world } = makeWorld();
    for (let i = 0; i < 20; i++) {
      const e = world.enemies.spawn('draugr', 1);
      expect(Math.hypot(e.pos.x, e.pos.z)).toBeGreaterThanOrEqual(ENEMY.spawnMinDistFromPlayer);
    }
    const e = world.enemies.active[0];
    if (!e) throw new Error('sin enemigos');
    expect(e.state).toBe('spawn');
    expect(e.canBeHit).toBe(false);
    const n = ticksUntil(world, () => e.state !== 'spawn');
    expect(n).toBe(tickOf(ENEMY.spawnDuration));
  });

  it('escalan con la oleada', () => {
    const { world } = makeWorld();
    const d = world.enemies.spawn('draugr', 4);
    expect(d.hp).toBe(DRAUGR.hpBase + 4 * DRAUGR.hpPerWave);
    expect(d.speed).toBeCloseTo(2.6 + 4 * 0.13);
    const late = world.enemies.spawn('draugr', 30);
    expect(late.speed).toBeCloseTo(2.6 + 1.6);
    const b = world.enemies.spawn('brute', 3);
    expect(b.hp).toBe(BRUTE.hpBase + 3 * BRUTE.hpPerWave);
  });

  it('cargan 0,55 s, golpean una vez por 10 y se recuperan', () => {
    const { world } = makeWorld();
    const e = placeEnemy(world, 'draugr', 0, 1.6);
    e.cooldown = 0;
    tick(world, 1);
    expect(e.state).toBe('windup');
    const wind = ticksUntil(world, () => e.state === 'attack');
    expect(wind).toBe(tickOf(DRAUGR.windup));
    ticksUntil(world, () => e.state === 'recover');
    expect(world.player.hp).toBe(100 - DRAUGR.damage);
    const rec = ticksUntil(world, () => e.state === 'chase');
    expect(Math.abs(rec - tickOf(DRAUGR.recover))).toBeLessThanOrEqual(1);
  });

  it('un golpe aturde al draugr', () => {
    const { world } = makeWorld();
    const e = placeEnemy(world, 'draugr', 0, 3);
    e.hp = 100;
    damageEnemy(world, e, 5, new Vector3(0, 0, 1), 5);
    expect(e.state).toBe('stagger');
    const n = ticksUntil(world, () => e.state === 'chase');
    expect(n).toBe(tickOf(ENEMY.staggerDuration));
  });

  it('el bruto tiene súper armadura contra golpes livianos', () => {
    const { world } = makeWorld();
    const e = placeEnemy(world, 'brute', 0, 3);
    damageEnemy(world, e, 5, new Vector3(0, 0, 1), 5);
    expect(e.state).toBe('chase');
    damageEnemy(world, e, 5, new Vector3(0, 0, 1), 5, { heavy: true });
    expect(e.state).toBe('stagger');
  });

  it('el tercer golpe del combo aturde al bruto (como en el prototipo)', () => {
    const { world } = makeWorld();
    const e = placeEnemy(world, 'brute', 0, 2);
    world.player.startAttack(2);
    ticksUntil(world, () => e.state === 'stagger', 30);
    expect(e.state).toBe('stagger');
  });

  it('al morir suman una baja y desaparecen a los 2,6 s', () => {
    const { world } = makeWorld();
    const e = placeEnemy(world, 'draugr', 0, 3);
    let removed = 0;
    world.events.on('enemy:removed', () => removed++);
    damageEnemy(world, e, 999, new Vector3(), 0);
    expect(e.state).toBe('dead');
    expect(world.stats.kills).toBe(1);
    expect(world.enemies.aliveCount).toBe(0);
    tick(world, tickOf(ENEMY.deathRemoveAfter) + 1);
    expect(removed).toBe(1);
    expect(world.enemies.active).toHaveLength(0);
  });

  it('no se apilan', () => {
    const { world } = makeWorld();
    const a = placeEnemy(world, 'draugr', 5, 5);
    const b = placeEnemy(world, 'draugr', 5.1, 5);
    tick(world, 1);
    expect(a.pos.distanceTo(b.pos)).toBeGreaterThanOrEqual(DRAUGR.radius * 2 - 1e-6);
  });
});
