/**
 * Mezcla de audio (fase 4). Cada banco tiene varias variaciones (`src/assets/audio/<banco>_<i>.mp3`)
 * y cada reproducción elige una al azar, con pitch y volumen variables para que no suene repetido.
 */
export type SampleBank =
  | 'hit_bone'
  | 'hit_flesh'
  | 'hit_heavy'
  | 'slam'
  | 'bone_break'
  | 'clink_metal'
  | 'clink_floor'
  | 'catch'
  | 'freeze'
  | 'step'
  | 'cloth'
  | 'growl'
  | 'rise'
  | 'groan'
  | 'ambient';

export interface BankTuning {
  volume: number;
  /** Variación aleatoria del volumen (± fracción). */
  volumeJitter: number;
  pitchMin: number;
  pitchMax: number;
  /** Máximo de reproducciones simultáneas: evita que 15 enemigos saturen la mezcla. */
  maxVoices: number;
}

const bank = (
  volume: number,
  pitchMin: number,
  pitchMax: number,
  maxVoices = 4,
  volumeJitter = 0.15,
): BankTuning => ({ volume, volumeJitter, pitchMin, pitchMax, maxVoices });

export const BANKS: Record<SampleBank, BankTuning> = {
  hit_bone: bank(0.7, 0.9, 1.1),
  hit_flesh: bank(0.55, 0.85, 1.05),
  hit_heavy: bank(0.9, 0.8, 0.95, 3),
  slam: bank(1, 0.7, 0.85, 2),
  bone_break: bank(0.6, 0.75, 0.95, 3),
  clink_metal: bank(0.6, 0.95, 1.1, 2),
  clink_floor: bank(0.6, 0.85, 1, 2),
  catch: bank(0.55, 1.05, 1.2, 1),
  freeze: bank(0.6, 0.8, 1, 2),
  step: bank(0.22, 0.9, 1.1, 2, 0.25),
  cloth: bank(0.5, 0.9, 1.1, 1),
  // Las criaturas suenan más graves para que parezcan no-muertos.
  growl: bank(0.45, 0.62, 0.75, 3),
  rise: bank(0.45, 0.55, 0.7, 3),
  groan: bank(0.5, 0.6, 0.72, 3),
  ambient: bank(0.5, 1, 1, 1, 0),
};

/** Cantidad de variaciones generadas por `npm run audio`. */
export const BANK_SIZES: Record<SampleBank, number> = {
  hit_bone: 5,
  hit_flesh: 5,
  hit_heavy: 5,
  slam: 5,
  bone_break: 5,
  clink_metal: 5,
  clink_floor: 5,
  catch: 5,
  freeze: 5,
  step: 5,
  cloth: 4,
  growl: 5,
  rise: 5,
  groan: 3,
  ambient: 1,
};

export interface MixTuning {
  /** Distancia a la que los sonidos de enemigos ya casi no se oyen. */
  falloffDistance: number;
  /** Cuánto se abren a izquierda/derecha según el ángulo respecto de la cámara. */
  panAmount: number;
  /** Tambores de guerra (procedurales) durante las oleadas. */
  drumsBpm: number;
  drumsVolume: number;
  /** Segundos para entrar o salir los tambores. */
  drumsFade: number;
  ambientVolume: number;
  /** Mínimo de segundos entre gruñidos de carga (si atacan muchos a la vez). */
  growlCooldown: number;
}

export const MIX: MixTuning = {
  falloffDistance: 26,
  panAmount: 0.7,
  drumsBpm: 92,
  drumsVolume: 0.55,
  drumsFade: 2.5,
  ambientVolume: 0.6,
  growlCooldown: 0.35,
};
