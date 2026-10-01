/** Cámara sobre el hombro y temblor por trauma. Valores portados de `reference/prototype.html`. */
export interface CameraTuning {
  fov: number;
  near: number;
  far: number;
  shoulderOffset: number;
  lookHeight: number;
  distance: number;
  pitchMin: number;
  pitchMax: number;
  pitchInitial: number;
  yawSensitivity: number;
  pitchSensitivity: number;
  invertY: boolean;
  followDamp: number;
  /** Giro lento de la cámara en el menú (rad/s). */
  menuOrbitSpeed: number;
  traumaDecay: number;
  /** Desplazamiento máximo = trauma² × shakeOffset. */
  shakeOffset: number;
  shakeRoll: number;
  /** Radio de la esfera que se usa para que la cámara no se meta en la geometría. */
  collisionRadius: number;
  /** Distancia mínima a la que puede acercarse la cámara al chocar. */
  collisionMinDistance: number;
  /** Al chocar se acerca de golpe; al liberarse vuelve suave con este factor. */
  collisionReturnDamp: number;
}

export const CAMERA: CameraTuning = {
  fov: 62,
  near: 0.1,
  far: 250,
  shoulderOffset: 0.75,
  lookHeight: 1.75,
  distance: 5.4,
  pitchMin: -0.15,
  pitchMax: 1.1,
  pitchInitial: 0.32,
  yawSensitivity: 0.0026,
  pitchSensitivity: 0.002,
  invertY: false,
  followDamp: 12,
  menuOrbitSpeed: 0.12,
  traumaDecay: 1.6,
  shakeOffset: 0.35,
  shakeRoll: 0.04,
  collisionRadius: 0.25,
  collisionMinDistance: 0.6,
  collisionReturnDamp: 6,
};
