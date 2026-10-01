/** Tuning del hacha arrojadiza. Valores portados de `reference/prototype.html`. */
export interface AxeTuning {
  throwSpeed: number;
  gravity: number;
  /** El hacha apunta al punto a esta distancia sobre el rayo de la cámara. */
  aimDistance: number;
  maxFlightTime: number;
  /** Se clava si se aleja más que `radio de la arena + esto`. */
  edgeMargin: number;
  flightSpin: number;
  flightHitRadius: number;
  /** Altura máxima de impacto sobre un enemigo, multiplicada por su escala. */
  flightHitHeight: number;
  flightDamage: number;
  flightKnockback: number;
  flightHitStop: number;
  flightShake: number;
  freezeDuration: number;
  freezeDurationArmored: number;
  obstacleHitPadding: number;
  obstacleHeight: number;
  floorHeight: number;
  floorTilt: number;
  /** Al caer suelta (enemigo muerto), la altura queda entre estos valores. */
  dropMinY: number;
  dropMaxY: number;
  dropTilt: number;
  edgeMinY: number;
  recallSpeed: number;
  recallMinDuration: number;
  recallMaxDuration: number;
  /** Desvío lateral de la curva, como fracción de la distancia. */
  recallCurveSide: number;
  recallCurveLift: number;
  recallCurveLiftPerUnit: number;
  recallSpin: number;
  recallHitRadius: number;
  recallHitHeight: number;
  recallDamage: number;
  recallKnockback: number;
  recallShake: number;
  /** Daño al llamar el hacha clavada en un enemigo congelado (además lo aturde). */
  unfreezeDamage: number;
  catchHitStop: number;
  catchShake: number;
}

export const AXE: AxeTuning = {
  throwSpeed: 32,
  gravity: 4,
  aimDistance: 40,
  maxFlightTime: 3,
  edgeMargin: 3,
  flightSpin: 22,
  flightHitRadius: 0.45,
  flightHitHeight: 2.1,
  flightDamage: 28,
  flightKnockback: 2,
  flightHitStop: 0.06,
  flightShake: 0.3,
  freezeDuration: 2.8,
  freezeDurationArmored: 1.5,
  obstacleHitPadding: 0.1,
  obstacleHeight: 4.6,
  floorHeight: 0.15,
  floorTilt: -0.6,
  dropMinY: 0.35,
  dropMaxY: 0.5,
  dropTilt: -0.5,
  edgeMinY: 0.5,
  recallSpeed: 26,
  recallMinDuration: 0.25,
  recallMaxDuration: 0.95,
  recallCurveSide: 0.3,
  recallCurveLift: 1.5,
  recallCurveLiftPerUnit: 0.05,
  recallSpin: 28,
  recallHitRadius: 0.6,
  recallHitHeight: 2.4,
  recallDamage: 16,
  recallKnockback: 6,
  recallShake: 0.15,
  unfreezeDamage: 8,
  catchHitStop: 0.035,
  catchShake: 0.28,
};
