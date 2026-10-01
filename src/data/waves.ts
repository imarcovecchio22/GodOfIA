/** Oleadas, orbes y contador de combo. Valores portados de `reference/prototype.html`. */
export interface WaveTuning {
  /** Cantidad de enemigos: countBase + countPerWave × oleada. */
  countBase: number;
  countPerWave: number;
  /** Brutos: floor((oleada − bruteWaveOffset) / bruteWaveDivisor). */
  bruteWaveOffset: number;
  bruteWaveDivisor: number;
  /** Máximo de vivos simultáneos: maxAliveBase + oleada. */
  maxAliveBase: number;
  firstSpawnDelay: number;
  spawnIntervalMin: number;
  spawnIntervalMax: number;
  initialDelay: number;
  breather: number;
  clearHeal: number;
}

export const WAVES: WaveTuning = {
  countBase: 3,
  countPerWave: 2,
  bruteWaveOffset: 1,
  bruteWaveDivisor: 2,
  maxAliveBase: 4,
  firstSpawnDelay: 0.6,
  spawnIntervalMin: 0.4,
  spawnIntervalMax: 0.9,
  initialDelay: 1.2,
  breather: 3,
  clearHeal: 20,
};

export interface OrbTuning {
  heal: number;
  lifetime: number;
  blinkAfter: number;
  pickupRadius: number;
  height: number;
  bobAmplitude: number;
  bobSpeed: number;
}

export const ORBS: OrbTuning = {
  heal: 18,
  lifetime: 20,
  blinkAfter: 16,
  pickupRadius: 1.2,
  height: 0.6,
  bobAmplitude: 0.15,
  bobSpeed: 3,
};

export interface ComboTuning {
  /** El contador se reinicia tras estos segundos sin golpes. */
  window: number;
}

export const COMBO: ComboTuning = { window: 2.5 };
