/**
 * El Jarl Ahogado (fase 5). Los valores que da el brief están tal cual; los que no da (marcados
 * como "propio") son una primera propuesta para tunear con el panel.
 *
 * Regla de oro: todo ataque se anuncia con al menos `minWindup` segundos (pose + decal + sonido).
 * Las aceleraciones de fase y los golpes rápidos de la furia triple respetan ese piso.
 */
import type { AreaShape } from '../combat/areas';

export type BossAttackId = 'sweep' | 'hammer' | 'charge' | 'summon' | 'hook' | 'fury';
export type BossPhase = 1 | 2 | 3;

export interface BossStrike {
  /** Carga (aviso) antes del golpe. */
  windup: number;
  /** Duración de la ventana de daño (en la embestida, el recorrido). */
  active: number;
  recover: number;
  shape: AreaShape;
  /** 'self': el área sale del jefe hacia donde mira. 'target': centrada donde estaba el jugador. */
  anchor: 'self' | 'target';
  /** Fracción de la carga durante la que el jefe sigue girando hacia el jugador (después, fija). */
  track: number;
  damage: number;
  knockback: number;
  /** Avance del jefe durante la ventana activa (u). */
  lunge: number;
  /** Temblor de cámara al soltar el golpe (propio). */
  shake: number;
}

export interface BossAttackDef {
  id: BossAttackId;
  minPhase: BossPhase;
  /** Distancia al jugador en la que prefiere usarlo. */
  range: [number, number];
  weight: number;
  cooldown: number;
  strikes: BossStrike[];
  special?: 'charge' | 'hook' | 'summon';
}

const DEG = Math.PI / 180;

const sweepStrike = (windup: number): BossStrike => ({
  windup,
  active: 0.18,
  recover: 0.7,
  shape: { kind: 'arc', radius: 5, angle: 160 * DEG },
  anchor: 'self',
  track: 0.6,
  damage: 25,
  knockback: 12,
  lunge: 0.6,
  shake: 0.25,
});

const furyStrike = (windup: number, recover: number): BossStrike => ({
  windup,
  active: 0.15,
  recover,
  shape: { kind: 'arc', radius: 4.5, angle: 120 * DEG },
  anchor: 'self',
  track: 0.7,
  damage: 20, // propio
  knockback: 9,
  lunge: 1.5,
  shake: 0.2,
});

export const BOSS_ATTACKS: BossAttackDef[] = [
  {
    id: 'sweep',
    minPhase: 1,
    range: [0, 5.5],
    weight: 3,
    cooldown: 1.5,
    strikes: [sweepStrike(0.9)],
  },
  {
    id: 'hammer',
    minPhase: 1,
    range: [2.5, 10],
    weight: 3,
    cooldown: 3,
    strikes: [
      {
        windup: 1.1,
        active: 0.12,
        recover: 0.9,
        shape: { kind: 'circle', radius: 3 },
        anchor: 'target',
        track: 0,
        damage: 35,
        knockback: 14,
        lunge: 0,
        shake: 0.55,
      },
    ],
  },
  {
    id: 'charge',
    minPhase: 1,
    range: [6, 20],
    weight: 2,
    cooldown: 5,
    special: 'charge',
    strikes: [
      {
        windup: 0.8,
        active: 0.5, // 12 u a 24 u/s
        recover: 1,
        shape: { kind: 'line', length: 12, width: 2.7 },
        anchor: 'self',
        track: 0,
        damage: 30,
        knockback: 16,
        lunge: 12,
        shake: 0.3,
      },
    ],
  },
  {
    id: 'summon',
    minPhase: 2,
    range: [0, 40],
    weight: 1.5,
    cooldown: 25,
    special: 'summon',
    strikes: [
      {
        windup: 1,
        active: 0.3,
        recover: 0.8,
        shape: { kind: 'circle', radius: 0 },
        anchor: 'self',
        track: 0,
        damage: 0,
        knockback: 0,
        lunge: 0,
        shake: 0.15,
      },
    ],
  },
  {
    id: 'hook',
    minPhase: 2,
    range: [4, 12],
    weight: 2.5,
    cooldown: 6,
    special: 'hook',
    strikes: [
      {
        windup: 0.7,
        active: 0.3,
        recover: 0.6,
        shape: { kind: 'line', length: 12, width: 1.4 },
        anchor: 'self',
        track: 0.5,
        damage: 0,
        knockback: 0,
        lunge: 0,
        shake: 0.15,
      },
    ],
  },
  {
    id: 'fury',
    minPhase: 2,
    range: [0, 5],
    weight: 2.5,
    cooldown: 5,
    // El brief pide 0,6 / 0,5 / 0,8: el segundo sube a 0,6 por la regla de oro.
    strikes: [furyStrike(0.6, 0.25), furyStrike(0.5, 0.25), furyStrike(0.8, 0.8)],
  },
];

export interface BossTuning {
  name: string;
  scale: number;
  radius: number;
  height: number;
  hitHeight: number;
  hpBase: number;
  /** Cada aparición siguiente (oleadas 10, 15…) suma esta vida. */
  hpPerAppearance: number;
  /** El jefe aparece en las oleadas múltiplo de esto. */
  waveInterval: number;
  moveSpeed: number; // propio
  turnDamp: number; // propio
  /** Si el ataque elegido queda fuera de rango, camina a lo sumo esto antes de usarlo igual. */
  approachTimeout: number; // propio
  /** Respiro entre un ataque y el siguiente. */
  thinkTime: number; // propio
  /** Fuera del rango preferido, el peso del ataque se multiplica por esto. */
  outOfRangeWeight: number; // propio
  /** No repite el mismo ataque más de esta cantidad de veces seguidas. */
  maxRepeats: number;
  /** Piso de la carga de cualquier golpe (regla de oro). */
  minWindup: number;
  emergeDuration: number;
  /** Vida (fracción) donde empieza cada fase: fase 2 debajo de [0], fase 3 debajo de [1]. */
  phaseThresholds: [number, number];
  /** Multiplicador de la carga por fase (fase 2: 15 % menos; fase 3: 20 % más rápido). */
  phaseWindup: [number, number, number];
  phaseRecover: [number, number, number];
  transition: { duration: number; pushRadius: number; pushForce: number };
  breakMax: number; // propio
  /** Sin golpes durante este tiempo, el quiebre empieza a bajar. */
  breakDecayDelay: number; // propio
  breakDecayRate: number; // propio
  brokenDuration: number;
  brokenDamageMult: number;
  /** El hacha no lo congela: lo ralentiza. */
  axeSlow: number;
  axeSlowDuration: number;
  /** Aturdido al chocar una columna en la embestida. */
  stunnedDuration: number;
  /** Temblor al chocar la columna (propio). */
  stunShake: number;
  charge: { speed: number };
  hook: { pullDuration: number; pullDistance: number };
  summon: { count: number };
  burn: { radius: number; dps: number; duration: number };
  cold: { radius: number; dps: number }; // dps propio
  judgment: {
    interval: number;
    /** El primero llega antes, para que la fase 3 lo muestre pronto. */
    firstDelay: number; // propio
    crouch: number;
    airborne: number;
    landRadius: number; // propio
    landDamage: number; // propio
    landKnockback: number; // propio
    landShake: number; // propio
    rings: number;
    ringSpacing: number; // propio
    ringSpeed: number; // propio
    ringWidth: number; // propio
    ringDamage: number; // propio
    ringKnockback: number; // propio
    ringMaxRadius: number;
    recover: number; // propio
  };
  death: { timeScale: number; slowDuration: number; duration: number; orbs: number };
}

export const BOSS: BossTuning = {
  name: 'El Jarl Ahogado',
  scale: 3.2,
  radius: 1.35,
  height: 6.4,
  hitHeight: 3.4,
  hpBase: 1200,
  hpPerAppearance: 400,
  waveInterval: 5,
  moveSpeed: 3.4,
  turnDamp: 4,
  approachTimeout: 2.5,
  thinkTime: 0.35,
  outOfRangeWeight: 0.2,
  maxRepeats: 2,
  minWindup: 0.6,
  emergeDuration: 3,
  phaseThresholds: [0.6, 0.3],
  phaseWindup: [1, 0.85, 0.8],
  phaseRecover: [1, 1, 0.8],
  transition: { duration: 2, pushRadius: 9, pushForce: 18 },
  breakMax: 100,
  breakDecayDelay: 2,
  breakDecayRate: 6,
  brokenDuration: 3,
  brokenDamageMult: 1.5,
  axeSlow: 0.4,
  axeSlowDuration: 1.5,
  stunnedDuration: 2,
  stunShake: 0.6,
  charge: { speed: 24 },
  hook: { pullDuration: 0.35, pullDistance: 2.6 },
  summon: { count: 4 },
  burn: { radius: 2.6, dps: 5, duration: 3 },
  cold: { radius: 16, dps: 6 },
  judgment: {
    interval: 20,
    firstDelay: 8,
    crouch: 0.6,
    airborne: 1.2,
    landRadius: 4,
    landDamage: 30,
    landKnockback: 14,
    landShake: 0.8,
    rings: 3,
    ringSpacing: 0.9,
    ringSpeed: 14,
    ringWidth: 1.2,
    ringDamage: 20,
    ringKnockback: 12,
    ringMaxRadius: 24,
    recover: 1.4,
  },
  death: { timeScale: 0.3, slowDuration: 1.5, duration: 3.2, orbs: 3 },
};

/** Cuánto llena el quiebre cada golpe (propio). Los ataques del jugador lo traen en su tabla. */
export const BREAK_FROM_AXE = { flight: 14, recall: 8, unfreeze: 0 };
