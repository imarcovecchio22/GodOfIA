import { WAVES } from '../data/waves';
import type { World } from './World';

/** Cantidad de enemigos y de brutos de una oleada. */
export function waveComposition(wave: number): { total: number; brutes: number } {
  return {
    total: WAVES.countBase + WAVES.countPerWave * wave,
    brutes: Math.floor((wave - WAVES.bruteWaveOffset) / WAVES.bruteWaveDivisor),
  };
}

export function maxAlive(wave: number): number {
  return WAVES.maxAliveBase + wave;
}

/**
 * Oleadas: aparece un enemigo cada 0,4–0,9 s respetando el máximo de vivos; al limpiar la oleada,
 * cartel, curación y respiro antes de la siguiente.
 */
export class WaveDirector {
  wave = 0;
  toSpawn = 0;
  brutesLeft = 0;
  spawnTimer = 0;
  between = 0;
  cleared = true;

  constructor(private readonly world: World) {
    this.reset();
  }

  reset(): void {
    this.wave = 0;
    this.toSpawn = 0;
    this.brutesLeft = 0;
    this.spawnTimer = 0;
    this.between = WAVES.initialDelay;
    this.cleared = true;
  }

  private startWave(): void {
    this.wave++;
    const { total, brutes } = waveComposition(this.wave);
    this.toSpawn = total;
    this.brutesLeft = brutes;
    this.spawnTimer = WAVES.firstSpawnDelay;
    this.cleared = false;
    this.world.events.emit('wave:start', { wave: this.wave });
  }

  step(dt: number): void {
    const w = this.world;
    const alive = w.enemies.aliveCount;
    if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && alive < maxAlive(this.wave)) {
        // Los brutos se reparten al azar entre los que faltan aparecer.
        const brute = this.brutesLeft > 0 && w.rng.chance(this.brutesLeft / this.toSpawn);
        if (brute) this.brutesLeft--;
        w.enemies.spawn(brute ? 'brute' : 'draugr', this.wave);
        this.toSpawn--;
        this.spawnTimer = w.rng.range(WAVES.spawnIntervalMin, WAVES.spawnIntervalMax);
      }
    } else if (alive === 0) {
      if (!this.cleared && this.wave > 0) {
        this.cleared = true;
        w.player.heal(WAVES.clearHeal);
        this.between = WAVES.breather;
        w.events.emit('wave:cleared', { wave: this.wave });
      }
      this.between -= dt;
      if (this.between <= 0) this.startWave();
    }
  }
}
