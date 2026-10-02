import type { Scene } from 'three';
import { BOSS_FX, BURSTS, FX } from '../data/fx';
import { BOSS } from '../data/boss';
import { HEAVY } from '../data/attacks';
import type { World } from '../game/World';
import { Particles } from './Particles';
import { Rings } from './Rings';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/** Traduce eventos de la simulación a partículas y anillos. No conoce el combate. */
export class FxDirector {
  readonly particles: Particles;
  readonly rings: Rings;

  constructor(
    scene: Scene,
    private readonly world: World,
  ) {
    this.particles = new Particles(scene);
    this.rings = new Rings(scene);
    const ev = world.events;
    const P = this.particles;

    ev.on('enemy:hit', ({ x, y, z }) => {
      P.burst(x, y, z, BURSTS.ichor);
      P.burst(x, y, z, BURSTS.sparks);
    });
    ev.on('enemy:killed', ({ enemy }) => {
      P.burst(enemy.pos.x, 1, enemy.pos.z, BURSTS.deathIchor);
      P.burst(enemy.pos.x, 1.6, enemy.pos.z, BURSTS.deathSoul);
    });
    ev.on('enemy:spawned', ({ enemy }) => {
      P.burst(enemy.pos.x, 0.2, enemy.pos.z, BURSTS.spawnDirt);
      this.rings.spawn(
        enemy.pos.x,
        enemy.pos.z,
        FX.spawnRingColor,
        FX.spawnRingRadius,
        FX.spawnRingDuration,
      );
    });
    ev.on('enemy:frozen', ({ x, y, z }) => P.burst(x, y, z, BURSTS.freeze));
    ev.on('axe:embedded', ({ x, y, z, surface }) => {
      if (surface === 'obstacle') P.burst(x, y, z, BURSTS.clinkObstacle);
      else if (surface === 'floor') P.burst(x, y, z, BURSTS.clinkFloor);
    });
    ev.on('axe:caught', ({ x, y, z }) => P.burst(x, y, z, BURSTS.catch));
    ev.on('player:dodge', ({ x, y, z }) => P.burst(x, y, z, BURSTS.dodgeDust));
    ev.on('player:hurt', ({ x, y, z }) => P.burst(x, y, z, BURSTS.playerBlood));
    ev.on('player:healed', ({ x, y, z }) => P.burst(x, y, z, BURSTS.heal));
    this.bindBoss();
    ev.on('player:slam', ({ x, z, armed }) => {
      const impact = HEAVY.impact;
      if (impact) {
        this.rings.spawn(
          x,
          z,
          armed ? FX.slamRingArmed : FX.slamRingUnarmed,
          impact.ringRadius,
          impact.ringDuration,
        );
      }
      P.burst(x, 0.1, z, BURSTS.slamDust);
    });
  }

  private ring(x: number, z: number, r: { color: number; radius: number; duration: number }): void {
    this.rings.spawn(x, z, r.color, r.radius, r.duration);
  }

  private bindBoss(): void {
    const ev = this.world.events;
    const P = this.particles;
    const boss = this.world.boss;
    ev.on('boss:intro', () => {
      this.ring(boss.pos.x, boss.pos.z, BOSS_FX.emergeRing);
      P.burst(boss.pos.x, 0.2, boss.pos.z, BURSTS.bossDust);
    });
    ev.on('boss:hit', ({ x, y, z }) => {
      P.burst(x, y, z, BURSTS.bossHit);
      P.burst(x, y, z, BURSTS.sparks);
    });
    ev.on('boss:strike', ({ attack, x, z }) => {
      if (attack !== 'hammer') return;
      this.ring(x, z, BOSS_FX.hammerRing);
      P.burst(x, 0.2, z, BURSTS.bossIce);
      P.burst(x, 0.2, z, BURSTS.slamDust);
    });
    ev.on('boss:stunned', ({ x, z }) => P.burst(x, 2.5, z, BURSTS.bossBreak));
    ev.on('boss:broken', () => P.burst(boss.pos.x, BOSS.hitHeight, boss.pos.z, BURSTS.bossBreak));
    ev.on('boss:phase', () => {
      this.ring(boss.pos.x, boss.pos.z, BOSS_FX.phaseRing);
      P.burst(boss.pos.x, BOSS.hitHeight, boss.pos.z, BURSTS.bossFire);
    });
    ev.on('boss:landed', ({ x, z }) => {
      this.ring(x, z, BOSS_FX.landRing);
      P.burst(x, 0.2, z, BURSTS.bossDust);
      P.burst(x, 0.2, z, BURSTS.bossIce);
    });
    ev.on('boss:died', ({ x, y, z }) => {
      P.burst(x, y, z, BURSTS.bossIce);
      P.burst(x, y, z, BURSTS.bossFire);
    });
  }

  /** `dt` de simulación del frame (0 durante el hit-stop). */
  update(dt: number): void {
    const w = this.world;
    const axe = w.axe;
    // Estela del hacha en vuelo y volviendo.
    const rate =
      axe.state === 'flying' ? FX.axeTrailRate : axe.state === 'recall' ? FX.axeRecallTrailRate : 0;
    if (rate > 0 && Math.random() < dt * rate) {
      this.particles.burst(axe.pos.x, axe.pos.y, axe.pos.z, BURSTS.axeTrail);
    }
    // Tierra que salta mientras un enemigo sale del piso.
    for (const e of w.enemies.active) {
      if (e.state !== 'spawn' || Math.random() >= dt * FX.spawnTrickleRate) continue;
      const sp = FX.spawnTrickleSpread;
      this.particles.burst(
        e.pos.x + rand(-sp, sp),
        0.1,
        e.pos.z + rand(-sp, sp),
        BURSTS.spawnTrickle,
      );
    }
    // El piso se rompe mientras emerge el jefe; al morir se desarma en hielo y fuego azul.
    const b = w.boss;
    if (b.state === 'emerge' && Math.random() < dt * BOSS_FX.emergeRate) {
      const sp = BOSS_FX.emergeSpread;
      const preset = Math.random() < 0.5 ? BURSTS.spawnTrickle : BURSTS.bossHit;
      this.particles.burst(b.pos.x + rand(-sp, sp), 0.1, b.pos.z + rand(-sp, sp), preset);
    } else if (b.state === 'dying' && Math.random() < dt * BOSS_FX.deathRate) {
      const y = rand(0.5, BOSS.height) * Math.max(0, 1 - b.fsm.t / BOSS.death.duration);
      const preset = Math.random() < 0.5 ? BURSTS.bossFire : BURSTS.freeze;
      this.particles.burst(b.pos.x + rand(-1, 1), y, b.pos.z + rand(-1, 1), preset);
    }
    this.particles.update(dt);
    this.rings.update(dt);
  }

  clear(): void {
    this.particles.clear();
    this.rings.clear();
  }
}
