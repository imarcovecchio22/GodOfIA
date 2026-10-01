/** Tuning del jugador. Valores portados de `reference/prototype.html`. */
export interface PlayerTuning {
  maxHp: number;
  radius: number;
  spawnX: number;
  spawnZ: number;
  spawnFacing: number;
  walkSpeed: number;
  runSpeed: number;
  /** Suavizado exponencial de la velocidad al caminar. */
  accelDamp: number;
  turnDamp: number;
  /** Factor de la animación de caminata: fase += velocidad × factor × dt. */
  walkCycle: number;
  /** Giro hacia la mira antes de la ventana activa y después. */
  attackTurnDampWindup: number;
  attackTurnDampActive: number;
  /** La velocidad se multiplica por `attackVelDecay^dt` durante un ataque. */
  attackVelDecay: number;
  knockbackDecay: number;
  /** Un click durante un golpe solo se encola si el golpe lleva más de esto. */
  comboInputMinTime: number;
  /** El golpe siguiente arranca este tiempo después de cerrar la ventana activa. */
  comboChainDelay: number;
  /** Sin hacha: multiplicadores de daño y alcance. */
  unarmedDamageMult: number;
  unarmedRangeMult: number;
  invulnAfterHit: number;
  hurtDuration: number;
  hurtKnockback: number;
  hurtKnockbackBig: number;
  hurtHitStop: number;
  hurtShake: number;
  hurtShakeBig: number;
  /** Segundos entre la muerte y la pantalla de game over. */
  deathDelay: number;
  lowHpThreshold: number;
  dodge: {
    duration: number;
    cooldown: number;
    /** Velocidad = speed × (1 − u) + minSpeed, con u el progreso de la rodada. */
    speed: number;
    minSpeed: number;
    exitSpeed: number;
  };
}

export const PLAYER: PlayerTuning = {
  maxHp: 100,
  radius: 0.45,
  spawnX: 0,
  spawnZ: 6,
  spawnFacing: Math.PI,
  walkSpeed: 6,
  runSpeed: 9,
  accelDamp: 14,
  turnDamp: 14,
  walkCycle: 1.5,
  attackTurnDampWindup: 22,
  attackTurnDampActive: 6,
  attackVelDecay: 0.001,
  knockbackDecay: 0.003,
  comboInputMinTime: 0.05,
  comboChainDelay: 0.04,
  unarmedDamageMult: 0.5,
  unarmedRangeMult: 0.72,
  invulnAfterHit: 0.55,
  hurtDuration: 0.28,
  hurtKnockback: 7,
  hurtKnockbackBig: 11,
  hurtHitStop: 0.05,
  hurtShake: 0.45,
  hurtShakeBig: 0.7,
  deathDelay: 1.8,
  lowHpThreshold: 30,
  dodge: {
    duration: 0.38,
    cooldown: 0.55,
    speed: 16,
    minSpeed: 3,
    exitSpeed: 4,
  },
};
