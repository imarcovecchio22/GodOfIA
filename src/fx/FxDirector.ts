import type { Scene } from 'three';
import { BURSTS, FX } from '../data/fx';
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
    this.particles.update(dt);
    this.rings.update(dt);
  }

  clear(): void {
    this.particles.clear();
    this.rings.clear();
  }
}
