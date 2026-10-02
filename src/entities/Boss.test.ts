import { describe, expect, it } from 'vitest';
import { pillarPositions, ARENA } from '../data/arena';
import { HEAVY } from '../data/attacks';
import { BOSS, BOSS_ATTACKS, type BossAttackId } from '../data/boss';
import { PLAYER } from '../data/player';
import { makeWorld, tick, ticksUntil } from '../game/testUtils';
import type { World } from '../game/World';
import { chooseBossAttack, effectiveWindup, phaseFor, type BossSim } from './Boss';

const tickOf = (seconds: number) => Math.ceil(Math.round(seconds * 60 * 1e6) / 1e6);

const attack = (id: BossAttackId) => {
  const a = BOSS_ATTACKS.find((x) => x.id === id);
  if (!a) throw new Error(`sin ataque ${id}`);
  return a;
};

/** Jefe ya activo en (x, z), quieto, con el ataque `id` elegido de antemano. */
function placeBoss(world: World, x: number, z: number, id?: BossAttackId): BossSim {
  const b = world.boss;
  b.spawn(1);
  b.pos.set(x, 0, z);
  b.prevPos.copy(b.pos);
  b.facing = b.prevFacing = Math.atan2(world.player.pos.x - x, world.player.pos.z - z);
  world.player.kb.set(0, 0, 0);
  b.fsm.reset('idle');
  if (id) b.attack = attack(id);
  return b;
}

describe('Jefe: reglas', () => {
  it('fases por vida: 100-60 %, 60-30 %, menos de 30 %', () => {
    expect(phaseFor(1)).toBe(1);
    expect(phaseFor(0.61)).toBe(1);
    expect(phaseFor(0.6)).toBe(2);
    expect(phaseFor(0.31)).toBe(2);
    expect(phaseFor(0.3)).toBe(3);
  });

  it('regla de oro: ningún golpe se anuncia con menos de 0,6 s en ninguna fase', () => {
    for (const a of BOSS_ATTACKS) {
      for (const s of a.strikes) {
        for (const phase of [1, 2, 3] as const) {
          expect(effectiveWindup(s, phase), a.id).toBeGreaterThanOrEqual(BOSS.minWindup);
        }
      }
    }
    // Fase 2: 15 % menos de carga; fase 3: 20 % más rápido.
    const hammer = attack('hammer').strikes[0];
    if (!hammer) throw new Error('sin golpe');
    expect(effectiveWindup(hammer, 2)).toBeCloseTo(1.1 * 0.85);
    expect(effectiveWindup(hammer, 3)).toBeCloseTo(1.1 * 0.8);
  });
});

describe('Jefe: selección de ataques', () => {
  const none = new Map<BossAttackId, number>();
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length] ?? 0;
  };

  it('en la fase 1 solo usa tajo, martillazo y embestida', () => {
    const random = seq([0.01, 0.2, 0.4, 0.6, 0.8, 0.99]);
    for (let i = 0; i < 60; i++) {
      const a = chooseBossAttack(1, i % 15, none, [], random);
      expect(['sweep', 'hammer', 'charge']).toContain(a?.id);
    }
  });

  it('no repite el mismo ataque más de dos veces seguidas', () => {
    for (let r = 0; r < 1; r += 0.01) {
      const a = chooseBossAttack(1, 2, none, ['hammer', 'sweep', 'sweep'], () => r);
      expect(a?.id).not.toBe('sweep');
    }
    // Dos seguidos del mismo y uno distinto en el medio no cuentan.
    const ids = new Set<string | undefined>();
    for (let r = 0; r < 1; r += 0.01) {
      ids.add(chooseBossAttack(1, 2, none, ['sweep', 'hammer', 'sweep'], () => r)?.id);
    }
    expect(ids.has('sweep')).toBe(true);
  });

  it('respeta los enfriamientos', () => {
    const cds = new Map<BossAttackId, number>([['summon', 10]]);
    for (let r = 0; r < 1; r += 0.01) {
      expect(chooseBossAttack(2, 8, cds, [], () => r)?.id).not.toBe('summon');
    }
  });

  it('prefiere los ataques de su rango de distancia', () => {
    const count = (dist: number, id: BossAttackId) => {
      let n = 0;
      for (let r = 0; r < 1; r += 0.001)
        if (chooseBossAttack(1, dist, none, [], () => r)?.id === id) n++;
      return n;
    };
    expect(count(15, 'charge')).toBeGreaterThan(count(15, 'sweep') * 3);
    expect(count(2, 'sweep')).toBeGreaterThan(count(2, 'charge') * 3);
  });
});

describe('Jefe: ataques', () => {
  it('martillazo: aviso en el piso donde estaba el jugador, carga 1,1 s y pega 35', () => {
    const { world } = makeWorld();
    world.player.pos.set(0, 0, 0);
    const b = placeBoss(world, 0, 6, 'hammer');
    const hp = world.player.hp;
    const n = ticksUntil(world, () => b.state === 'windup');
    expect(n).toBe(tickOf(BOSS.thinkTime));
    const tg = world.telegraphs.pool.find((t) => t.active);
    expect(tg?.shape).toEqual({ kind: 'circle', radius: 3 });
    expect(Math.hypot(tg?.x ?? 99, tg?.z ?? 99)).toBeLessThan(1e-6);
    expect(ticksUntil(world, () => b.state === 'active')).toBe(tickOf(1.1));
    // La grieta ya quema en el mismo paso del golpe.
    expect(world.player.hp).toBeCloseTo(hp - 35, 0);
    expect(world.hazards.pool.some((h) => h.active && h.kind === 'burn')).toBe(true);
  });

  it('martillazo: alejarse del círculo lo esquiva, y la grieta quema 5 por segundo', () => {
    const { world } = makeWorld();
    world.player.pos.set(0, 0, 0);
    const b = placeBoss(world, 0, 6, 'hammer');
    ticksUntil(world, () => b.state === 'windup');
    world.player.pos.set(-5, 0, 0);
    const hp = world.player.hp;
    ticksUntil(world, () => b.state === 'active');
    expect(world.player.hp).toBe(hp);
    world.player.pos.set(0, 0, 0);
    tick(world, 60);
    expect(hp - world.player.hp).toBeCloseTo(BOSS.burn.dps, 0);
  });

  it('embestida contra una columna: queda aturdido 2 s', () => {
    const pillar = pillarPositions()[0];
    if (!pillar) throw new Error('sin columnas');
    const { world } = makeWorld();
    const ux = pillar.x / ARENA.pillarRing;
    const uz = pillar.z / ARENA.pillarRing;
    // Jugador detrás de la columna, el jefe del otro lado.
    world.player.pos.set(ux * (ARENA.pillarRing + 3), 0, uz * (ARENA.pillarRing + 3));
    const b = placeBoss(world, ux * 1, uz * 1, 'charge');
    const n = ticksUntil(world, () => b.state === 'stunned', 240);
    expect(n).toBeGreaterThan(0);
    expect(Math.hypot(b.pos.x - pillar.x, b.pos.z - pillar.z)).toBeGreaterThanOrEqual(
      pillar.r + BOSS.radius - 0.05,
    );
    expect(b.canBeHit).toBe(true);
    expect(ticksUntil(world, () => b.state !== 'stunned')).toBe(tickOf(BOSS.stunnedDuration));
  });

  it('embestida sin columna en el camino: no se aturde', () => {
    const { world } = makeWorld();
    world.player.pos.set(0, 0, 8);
    const b = placeBoss(world, 0, -4, 'charge');
    const states = new Set<string>();
    for (let i = 0; i < 180; i++) {
      tick(world, 1);
      states.add(b.state);
    }
    expect(states.has('active')).toBe(true);
    expect(states.has('stunned')).toBe(false);
  });

  it('el garfio engancha al jugador, lo trae y encadena un tajo con aviso', () => {
    const { world } = makeWorld();
    world.player.pos.set(0, 0, 0);
    const b = placeBoss(world, 0, 8, 'hook');
    b.phase = 2;
    let hooked = false;
    world.events.on('boss:hooked', () => (hooked = true));
    ticksUntil(world, () => b.state === 'active', 200);
    expect(hooked).toBe(true);
    expect(world.player.state).toBe('pulled');
    ticksUntil(world, () => b.state === 'windup', 200);
    expect(Math.hypot(world.player.pos.x - b.pos.x, world.player.pos.z - b.pos.z)).toBeLessThan(
      BOSS.radius + BOSS.hook.pullDistance + 0.1,
    );
    expect(world.telegraphs.pool.some((t) => t.active && t.shape.kind === 'arc')).toBe(true);
  });

  it('rodando, el garfio no engancha', () => {
    const { world } = makeWorld();
    world.player.pos.set(0, 0, 0);
    const b = placeBoss(world, 0, 8, 'hook');
    b.phase = 2;
    ticksUntil(world, () => b.state === 'windup');
    const hookStrike = attack('hook').strikes[0];
    if (!hookStrike) throw new Error('sin golpe');
    const windup = effectiveWindup(hookStrike, 2);
    // Rueda justo para que la ventana del garfio caiga dentro de la rodada.
    tick(world, tickOf(windup) - 3);
    world.player.fsm.go('dodge', world.player);
    tick(world, 4);
    expect(world.player.state).not.toBe('pulled');
  });
});

describe('Jefe: vida, fases y quiebre', () => {
  it('al bajar del 60 % pasa a la fase 2: invulnerable 2 s y empuja al jugador', () => {
    const { world } = makeWorld();
    world.player.pos.set(0, 0, 0);
    const b = placeBoss(world, 0, 3);
    const phases: number[] = [];
    world.events.on('boss:phase', ({ phase }) => phases.push(phase));
    b.hp = b.maxHp * 0.61;
    b.takeDamage(b.maxHp * 0.02, 0);
    expect(b.phase).toBe(2);
    expect(b.state).toBe('transition');
    expect(phases).toEqual([2]);
    expect(b.canBeHit).toBe(false);
    expect(b.takeDamage(100, 0)).toBe(false);
    expect(world.player.kb.length()).toBeGreaterThan(0);
    expect(ticksUntil(world, () => b.state !== 'transition')).toBe(
      tickOf(BOSS.transition.duration),
    );
    expect(b.canBeHit).toBe(true);
  });

  it('fase 3: el borde se congela y hace daño fuera de 16 u', () => {
    const { world } = makeWorld();
    const b = placeBoss(world, 0, 3);
    b.hp = b.maxHp * 0.31;
    b.takeDamage(b.maxHp * 0.02, 0);
    expect(b.phase).toBe(3);
    world.player.pos.set(10, 0, 0);
    world.player.kb.set(0, 0, 0);
    let hp = world.player.hp;
    tick(world, 30);
    expect(world.player.hp).toBe(hp);
    world.player.pos.set(18, 0, 0);
    hp = world.player.hp;
    tick(world, 60);
    expect(hp - world.player.hp).toBeCloseTo(BOSS.cold.dps, 0);
  });

  it('el quiebre lo tira de rodillas 3 s y recibe 50 % más de daño', () => {
    const { world } = makeWorld();
    const b = placeBoss(world, 0, 6);
    let broke = 0;
    world.events.on('boss:broken', () => broke++);
    const hits = Math.ceil(BOSS.breakMax / HEAVY.breakDamage);
    for (let i = 0; i < hits; i++) b.takeDamage(1, HEAVY.breakDamage);
    expect(b.state).toBe('broken');
    expect(broke).toBe(1);
    const hp = b.hp;
    b.takeDamage(10, 0);
    expect(hp - b.hp).toBeCloseTo(10 * BOSS.brokenDamageMult);
    expect(ticksUntil(world, () => b.state !== 'broken', 400)).toBe(tickOf(BOSS.brokenDuration));
    expect(b.breakMeter).toBe(0);
  });

  it('el quiebre baja si pasa un rato sin recibir golpes', () => {
    const { world } = makeWorld();
    const b = placeBoss(world, 0, 6);
    b.takeDamage(1, 50);
    tick(world, tickOf(BOSS.breakDecayDelay) - 1);
    expect(b.breakMeter).toBe(50);
    tick(world, 60);
    expect(b.breakMeter).toBeLessThan(50);
  });

  it('el hacha no lo congela: lo ralentiza 40 % durante 1,5 s', () => {
    const { world } = makeWorld();
    world.player.pos.set(0, 0, 0);
    const b = placeBoss(world, 0, 6, 'hammer');
    ticksUntil(world, () => b.state === 'windup');
    b.takeDamage(1, 0, true);
    expect(b.slowTimer).toBe(BOSS.axeSlowDuration);
    tick(world, 60);
    expect(b.fsm.t).toBeCloseTo(1 * (1 - BOSS.axeSlow), 2);
  });

  it('muere: cámara lenta, cura todo, tres orbes y la oleada cierra al terminar', () => {
    const { world } = makeWorld();
    world.waves.jumpTo(5);
    world.waves.between = 0;
    tick(world, 1);
    const b = world.boss;
    expect(b.active).toBe(true);
    expect(world.waves.wave).toBe(5);
    b.fsm.reset('idle');
    world.enemies.spawn('draugr', 5);
    world.player.hp = 20;
    const cleared: number[] = [];
    world.events.on('wave:cleared', ({ wave }) => cleared.push(wave));
    b.takeDamage(b.maxHp + 1, 0);
    expect(b.state).toBe('dying');
    expect(world.player.hp).toBe(PLAYER.maxHp);
    expect(world.orbs.pool.filter((o) => o.active).length).toBe(BOSS.death.orbs);
    expect(world.enemies.active.every((e) => !e.alive)).toBe(true);
    tick(world, 60);
    expect(cleared).toEqual([]);
    ticksUntil(world, () => cleared.length > 0, 400);
    expect(b.state).toBe('dead');
    expect(cleared).toEqual([5]);
  });

  it('cada aparición tiene 400 de vida más', () => {
    const { world } = makeWorld();
    world.boss.spawn(1);
    expect(world.boss.maxHp).toBe(1200);
    world.boss.spawn(3);
    expect(world.boss.maxHp).toBe(2000);
  });
});
