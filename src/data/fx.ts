/** Presets de partículas y anillos. Valores portados de `reference/prototype.html`. */

export interface BurstPreset {
  color: number;
  count: number;
  speed: number;
  life: number;
  size: number;
  /** Componente vertical extra al elegir la dirección. */
  up: number;
  gravity: number;
}

const burst = (
  color: number,
  count: number,
  speed: number,
  o: Partial<Pick<BurstPreset, 'life' | 'size' | 'up' | 'gravity'>> = {},
): BurstPreset => ({
  color,
  count,
  speed,
  life: o.life ?? 0.5,
  size: o.size ?? 0.12,
  up: o.up ?? 0.4,
  gravity: o.gravity ?? 14,
});

export const BURSTS = {
  ichor: burst(0x29361b, 9, 6, { life: 0.6, size: 0.14 }),
  sparks: burst(0xffc06a, 6, 9, { life: 0.22, size: 0.07, gravity: 3 }),
  deathIchor: burst(0x29361b, 22, 7, { life: 0.9, size: 0.18 }),
  deathSoul: burst(0x66e6ff, 10, 4, { life: 0.7, size: 0.06, gravity: -2 }),
  spawnDirt: burst(0x3b3222, 16, 5, { life: 0.8, size: 0.16, up: 1.2 }),
  spawnTrickle: burst(0x3b3222, 1, 3, { life: 0.5, size: 0.12, up: 1.5 }),
  axeTrail: burst(0x86e6f7, 1, 0.5, { life: 0.3, size: 0.05, gravity: 0 }),
  freeze: burst(0xbff4ff, 18, 5, { life: 0.6, size: 0.09, gravity: 2 }),
  clinkObstacle: burst(0xffc06a, 10, 6, { life: 0.3, size: 0.06 }),
  clinkFloor: burst(0x6b6355, 12, 4, { life: 0.5, size: 0.1, up: 1 }),
  catch: burst(0x86e6f7, 16, 5, { life: 0.4, size: 0.07, gravity: 2 }),
  dodgeDust: burst(0x6b6355, 6, 2, { life: 0.4, size: 0.1, up: 0.5 }),
  slamDust: burst(0x6b6355, 22, 7, { life: 0.7, size: 0.14, up: 1.4 }),
  playerBlood: burst(0x9a1a14, 10, 5),
  heal: burst(0x6dff9a, 14, 4, { life: 0.5, size: 0.08, gravity: -3 }),
} satisfies Record<string, BurstPreset>;

export interface FxTuning {
  maxParticles: number;
  maxRings: number;
  /** Partículas por segundo detrás del hacha en vuelo y en el recall. */
  axeTrailRate: number;
  axeRecallTrailRate: number;
  spawnTrickleRate: number;
  spawnTrickleSpread: number;
  /** Rebote de las partículas al tocar el piso. */
  floorY: number;
  bounce: number;
  floorFriction: number;
  spinSpeed: number;
  ringOpacity: number;
  spawnRingColor: number;
  spawnRingRadius: number;
  spawnRingDuration: number;
  slamRingArmed: number;
  slamRingUnarmed: number;
}

export const FX: FxTuning = {
  maxParticles: 450,
  maxRings: 16,
  axeTrailRate: 40,
  axeRecallTrailRate: 50,
  spawnTrickleRate: 25,
  spawnTrickleSpread: 0.4,
  floorY: 0.03,
  bounce: 0.3,
  floorFriction: 0.6,
  spinSpeed: 6,
  ringOpacity: 0.85,
  spawnRingColor: 0x4fc6d8,
  spawnRingRadius: 3,
  spawnRingDuration: 0.6,
  slamRingArmed: 0x86e6f7,
  slamRingUnarmed: 0xe0a24c,
};
