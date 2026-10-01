/** Tuning de enemigos. Valores portados de `reference/prototype.html`. */

export type EnemyKind = 'draugr' | 'brute';

export interface EnemyArchetype {
  kind: EnemyKind;
  scale: number;
  radius: number;
  hpBase: number;
  hpPerWave: number;
  speedBase: number;
  speedPerWave: number;
  speedPerWaveCap: number;
  damage: number;
  /** Carga del ataque (ojos en rojo). */
  windup: number;
  attackLunge: number;
  recover: number;
  /** Multiplicador del empuje recibido. */
  knockbackTaken: number;
  /** Súper armadura: solo lo aturden los ataques que la rompen. */
  armored: boolean;
  /** Empuja más fuerte al jugador cuando lo golpea. */
  heavyHitter: boolean;
  freezeDuration: number;
  orbDropChance: number;
  /** Altura donde salen las partículas de impacto. */
  hitHeight: number;
}

export interface EnemyCommonTuning {
  spawnDuration: number;
  spawnDepth: number;
  spawnMinDistFromPlayer: number;
  /** Anillo de aparición: entre radio de arena − inner y radio de arena − outer. */
  spawnRingInner: number;
  spawnRingOuter: number;
  spawnTries: number;
  initialCooldownMin: number;
  initialCooldownMax: number;
  /** Deja de acercarse a esta distancia + radio × stopRadiusFactor. */
  stopDistance: number;
  stopRadiusFactor: number;
  /** Empieza a cargar el ataque a esta distancia + radio. */
  attackTriggerDistance: number;
  attackHitStart: number;
  attackHitEnd: number;
  attackDuration: number;
  /** Alcance del golpe: distancia + radio × attackReachRadiusFactor. */
  attackReach: number;
  attackReachRadiusFactor: number;
  attackMinDot: number;
  attackLungeDecay: number;
  cooldownMin: number;
  cooldownMax: number;
  staggerDuration: number;
  staggerMinCooldown: number;
  chaseTurnDamp: number;
  windupTurnDamp: number;
  knockbackDecay: number;
  flashDecay: number;
  deathSinkDelay: number;
  deathSinkSpeed: number;
  deathRemoveAfter: number;
  /** Factor de la animación de caminata: fase += velocidad × factor × dt. */
  walkCycle: number;
}

export const ENEMY: EnemyCommonTuning = {
  spawnDuration: 1.1,
  spawnDepth: 2.4,
  spawnMinDistFromPlayer: 8,
  spawnRingInner: 6,
  spawnRingOuter: 2.5,
  spawnTries: 20,
  initialCooldownMin: 0.5,
  initialCooldownMax: 1.5,
  stopDistance: 1.45,
  stopRadiusFactor: 0.6,
  attackTriggerDistance: 1.9,
  attackHitStart: 0.06,
  attackHitEnd: 0.22,
  attackDuration: 0.3,
  attackReach: 1.7,
  attackReachRadiusFactor: 1.2,
  attackMinDot: 0.35,
  attackLungeDecay: 0.002,
  cooldownMin: 0.6,
  cooldownMax: 1.4,
  staggerDuration: 0.32,
  staggerMinCooldown: 0.4,
  chaseTurnDamp: 8,
  windupTurnDamp: 4,
  knockbackDecay: 0.004,
  flashDecay: 6,
  deathSinkDelay: 1.0,
  deathSinkSpeed: 0.8,
  deathRemoveAfter: 2.6,
  walkCycle: 2.2,
};

export const DRAUGR: EnemyArchetype = {
  kind: 'draugr',
  scale: 1,
  radius: 0.45,
  hpBase: 38,
  hpPerWave: 5,
  speedBase: 2.6,
  speedPerWave: 0.13,
  speedPerWaveCap: 1.6,
  damage: 10,
  windup: 0.55,
  attackLunge: 6.5,
  recover: 0.55,
  knockbackTaken: 1,
  armored: false,
  heavyHitter: false,
  freezeDuration: 2.8,
  orbDropChance: 0.28,
  hitHeight: 1.2,
};

export const BRUTE: EnemyArchetype = {
  kind: 'brute',
  scale: 1.45,
  radius: 0.7,
  hpBase: 140,
  hpPerWave: 12,
  speedBase: 2.1,
  speedPerWave: 0,
  speedPerWaveCap: 0,
  damage: 22,
  windup: 0.8,
  attackLunge: 5,
  recover: 0.8,
  knockbackTaken: 0.35,
  armored: true,
  heavyHitter: true,
  freezeDuration: 1.5,
  orbDropChance: 0.9,
  hitHeight: 1.7,
};

export const ARCHETYPES: Record<EnemyKind, EnemyArchetype> = { draugr: DRAUGR, brute: BRUTE };
