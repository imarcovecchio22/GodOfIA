import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { HEAVY, LIGHT_COMBO } from '../data/attacks';
import { PLAYER } from '../data/player';
import { input, makeWorld, placeEnemy, tick, ticksUntil } from '../game/testUtils';

/** Tick (1-based) en que un tiempo de la tabla cae con simulación a 60 Hz. */
const tickOf = (seconds: number) => Math.ceil(Math.round(seconds * 60 * 1e6) / 1e6);

describe('Jugador: combo liviano', () => {
  it('cada golpe pega en el primer tick de su ventana activa', () => {
    for (const [i, def] of LIGHT_COMBO.entries()) {
      const { world } = makeWorld();
      const e = placeEnemy(world, 'brute', 0, 2);
      e.hp = 9999;
      world.player.startAttack(i);
      const hp0 = e.hp;
      const n = ticksUntil(world, () => e.hp < hp0, 60);
      expect(n, def.id).toBe(tickOf(def.active[0]));
    }
  });

  it('un click después de 0,05 s encadena el golpe siguiente al cerrar la ventana + 0,04 s', () => {
    const { world } = makeWorld();
    tick(world, 1, input({ attack: true }));
    tick(world, 3); // t = 0,05 + 1 tick
    tick(world, 1, input({ attack: true }));
    expect(world.player.queued).toBe(true);
    const def = LIGHT_COMBO[0];
    if (!def) throw new Error('falta el primer golpe');
    // Ya pasaron 5 ticks; el segundo golpe arranca en active[1] + chainDelay.
    const chainTick = tickOf(def.active[1] + PLAYER.comboChainDelay);
    tick(world, chainTick - 5 - 1);
    expect(world.player.combo).toBe(0);
    tick(world, 1);
    expect(world.player.state).toBe('attack');
    expect(world.player.combo).toBe(1);
  });

  it('un click antes de 0,05 s no se encola', () => {
    const { world } = makeWorld();
    tick(world, 1, input({ attack: true }));
    tick(world, 1, input({ attack: true }));
    expect(world.player.queued).toBe(false);
    tick(world, 30);
    expect(world.player.state).toBe('idle');
  });

  it('un click durante el tercer golpe se pierde', () => {
    const { world } = makeWorld();
    world.player.startAttack(2);
    tick(world, 5);
    tick(world, 1, input({ attack: true }));
    tick(world, 40);
    expect(world.player.state).toBe('idle');
    expect(world.player.combo).toBe(0);
  });

  it('click derecho durante un golpe encadena el pesado', () => {
    const { world } = makeWorld();
    tick(world, 1, input({ attack: true }));
    tick(world, 1, input({ heavy: true }));
    tick(world, 20);
    expect(world.player.state).toBe('heavy');
  });
});

describe('Jugador: golpe pesado', () => {
  it('impacta una sola vez a los 0,43 s con daño 34 en área', () => {
    const { world, feedback } = makeWorld();
    const a = placeEnemy(world, 'draugr', 1.5, 1.3);
    const b = placeEnemy(world, 'draugr', -1.5, 1.3);
    a.hp = b.hp = 100;
    world.player.startHeavy();
    const n = ticksUntil(world, () => a.hp < 100, 60);
    expect(n).toBe(tickOf(HEAVY.impact?.at ?? 0));
    expect(a.hp).toBe(100 - HEAVY.damage);
    expect(b.hp).toBe(100 - HEAVY.damage);
    tick(world, 20);
    expect(a.hp).toBe(100 - HEAVY.damage);
    // Temblor del impacto en el piso + temblor del golpe; un solo hit-stop.
    expect(feedback.shakes).toEqual([HEAVY.impact?.shake, HEAVY.shake]);
    expect(feedback.hitStops).toEqual([HEAVY.hitStop]);
  });
});

describe('Jugador: sin hacha', () => {
  it('pega la mitad de daño con 72% del alcance', () => {
    const { world } = makeWorld();
    const near = placeEnemy(world, 'draugr', 0, 1.5);
    // Con el avance del golpe (0,4 u) queda a 2,5: dentro del alcance armado (2,77), fuera del desarmado (2,07).
    const far = placeEnemy(world, 'draugr', 0, 2.9);
    near.hp = far.hp = 100;
    world.axe.fsm.reset('ground');
    world.player.startAttack(0);
    tick(world, 12);
    expect(near.hp).toBe(100 - 14 * PLAYER.unarmedDamageMult);
    expect(far.hp).toBe(100);
  });
});

describe('Jugador: esquive', () => {
  it('no cancela la ventana activa pero sí la recuperación', () => {
    const { world } = makeWorld();
    world.player.startAttack(0);
    tick(world, 8);
    tick(world, 1, input({ dodge: true }));
    expect(world.player.state).toBe('attack');
    tick(world, 4); // t > 0,20
    tick(world, 1, input({ dodge: true }));
    expect(world.player.state).toBe('dodge');
  });

  it('dura 0,38 s, tiene enfriamiento y hace invulnerable', () => {
    const { world } = makeWorld();
    tick(world, 1, input({ dodge: true }));
    expect(world.player.state).toBe('dodge');
    world.player.hurt(10, new Vector3(1, 0, 0), false);
    expect(world.player.hp).toBe(PLAYER.maxHp);
    const n = ticksUntil(world, () => world.player.state !== 'dodge');
    expect(n).toBe(tickOf(PLAYER.dodge.duration) - 1);
    // Sale con velocidad (exitSpeed): el paso siguiente ya está en 'move'.
    expect(world.player.vel.length()).toBeCloseTo(PLAYER.dodge.exitSpeed);
    // El enfriamiento (0,55 s) arranca con la rodada: quedan ~0,17 s.
    tick(world, 1, input({ dodge: true }));
    expect(world.player.state).not.toBe('dodge');
    tick(world, 12);
    tick(world, 1, input({ dodge: true }));
    expect(world.player.state).toBe('dodge');
  });

  it('sin dirección rueda hacia atrás', () => {
    const { world } = makeWorld();
    tick(world, 1, input({ dodge: true }));
    tick(world, 10);
    expect(world.player.pos.z).toBeLessThan(0);
  });
});

describe('Jugador: daño recibido', () => {
  it('invulnerabilidad de 0,55 s tras un golpe y reinicio del combo', () => {
    const { world, feedback } = makeWorld();
    world.stats.combo = 5;
    world.player.hurt(10, new Vector3(1, 0, 0), false);
    expect(world.player.hp).toBe(90);
    expect(world.player.state).toBe('hurt');
    expect(world.stats.combo).toBe(0);
    expect(feedback.hitStops).toEqual([PLAYER.hurtHitStop]);
    world.player.hurt(10, new Vector3(1, 0, 0), false);
    expect(world.player.hp).toBe(90);
    tick(world, tickOf(PLAYER.invulnAfterHit) + 1);
    world.player.hurt(10, new Vector3(1, 0, 0), false);
    expect(world.player.hp).toBe(80);
  });

  it('al morir espera 1,8 s antes del game over', () => {
    const { world } = makeWorld();
    world.player.hurt(200, new Vector3(1, 0, 0), true);
    expect(world.player.state).toBe('dead');
    const n = ticksUntil(world, () => world.gameOver);
    // Temporizador que se descuenta por paso: ±1 tick por redondeo.
    expect(Math.abs(n - tickOf(PLAYER.deathDelay))).toBeLessThanOrEqual(1);
  });
});
