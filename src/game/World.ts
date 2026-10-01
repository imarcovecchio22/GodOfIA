import { Vector3 } from 'three';
import { EventBus } from '../core/EventBus';
import { Rng } from '../core/Rng';
import { AxeSim } from '../entities/Axe';
import { EnemyManager } from '../entities/Enemy';
import { Orbs } from '../entities/Orbs';
import { PlayerSim, type PlayerInput } from '../entities/Player';
import { ArenaCollision } from '../physics/ArenaCollision';
import type { Feedback, GameEvents } from './events';
import { Stats } from './Stats';
import { WaveDirector } from './WaveDirector';

/**
 * Estado completo de la simulación. No toca el DOM ni WebGL, así que corre en tests.
 * Lo único que viene de la vista es la cámara (`camYaw`, `aimOrigin`, `aimDir`) y la posición
 * de la mano del jugador.
 */
export class World {
  readonly events = new EventBus<GameEvents>();
  readonly collision = new ArenaCollision();
  readonly stats = new Stats(this.events);
  readonly player: PlayerSim;
  readonly axe: AxeSim;
  readonly enemies: EnemyManager;
  readonly orbs: Orbs;
  readonly waves: WaveDirector;

  /** Yaw de la cámara: define hacia dónde es "adelante" para el movimiento y la mira. */
  camYaw = 0;
  readonly aimOrigin = new Vector3();
  readonly aimDir = new Vector3(0, 0, -1);

  /** Se pone en true cuando termina la demora de muerte del jugador. */
  gameOver = false;

  constructor(
    readonly feedback: Feedback,
    readonly rng: Rng = new Rng(),
  ) {
    this.player = new PlayerSim(this);
    this.axe = new AxeSim(this);
    this.enemies = new EnemyManager(this);
    this.orbs = new Orbs(this);
    this.waves = new WaveDirector(this);

    this.events.on('enemy:killed', ({ enemy }) => {
      this.axe.onEnemyKilled(enemy);
      if (this.rng.chance(enemy.arch.orbDropChance)) this.orbs.spawn(enemy.pos.x, enemy.pos.z);
    });
  }

  reset(): void {
    this.enemies.clear();
    this.orbs.clear();
    this.player.reset();
    this.axe.reset();
    this.waves.reset();
    this.stats.reset();
    this.camYaw = 0;
    this.gameOver = false;
  }

  /** Un paso de simulación de duración fija. */
  step(dt: number, input: PlayerInput): void {
    this.player.snapshot();
    this.axe.snapshot();
    this.enemies.snapshot();

    this.player.step(dt, input);
    this.axe.fsm.update(this.axe, dt);
    this.enemies.step(dt);
    this.orbs.step(dt);

    if (this.player.alive) {
      this.waves.step(dt);
    } else if (!this.gameOver) {
      this.player.deathTimer -= dt;
      if (this.player.deathTimer <= 0) this.gameOver = true;
    }
  }
}
