/**
 * Números de la vista del jefe (fase 5): greybox, avisos en el piso, fijación de objetivo y
 * cinemáticas. No afectan la simulación.
 */

export const BOSS_LOOK = {
  bone: 0x8d8a7c,
  rust: 0x5b3a26,
  iron: 0x3c4148,
  algae: 0x2f4a3a,
  /** Fuego azul de ojos y pecho, en HDR para que lo agarre el bloom. */
  fire: 0x4fb8ff,
  fireGlow: [1.6, 2.6, 3.8] as [number, number, number],
  /** Blanco del destello al recibir un golpe. */
  flashGlow: 1.4,
  /** Suavizado de las poses (1/s). */
  poseDamp: 14,
  /** Altura del salto del juicio del lago: sale de cuadro. */
  leapHeight: 34,
  /** Cuánto se hunde al arrodillarse por el quiebre. */
  kneelDrop: 1.3,
  /** Profundidad desde la que emerge y a la que se hunde al morir. */
  sinkDepth: 7,
};

/** Avisos en el piso (decals). Lo que se ve es exactamente el área que pega. */
export const DECALS = {
  max: 14,
  /** Altura sobre el piso, para que no parpadee contra él. */
  y: 0.04,
  /** Rojo del aviso, en HDR: el borde brilla con el bloom. */
  telegraph: { color: 0xff3a24, glow: 1.6, fill: 0.16, charge: 0.38, edge: 0.95 },
  /** Grieta de hielo que quema. */
  burn: { color: 0x7fe6ff, glow: 1.8, fill: 0.3, edge: 0.7 },
  /** Borde congelado de la fase 3. */
  cold: { color: 0xbfefff, glow: 1, fill: 0.32, edge: 0.9, band: 3 },
  /** Ancho del borde, en unidades. */
  edgeWidth: 0.14,
  /** El área exterior del frío se dibuja hasta acá (el resto queda fuera de la arena). */
  coldExtent: 26,
};

export const LOCK_ON = {
  /** Distancia máxima para fijar y para mantener la fijación. */
  range: 22,
  keepRange: 28,
  /** Ángulo máximo respecto del frente de la cámara para elegir objetivo. */
  maxAngle: 1.2,
  /** Peso de la distancia frente al ángulo al elegir (u por radián). */
  distanceWeight: 0.08,
  /** Suavizado del giro de cámara hacia el objetivo (1/s). */
  turnDamp: 7,
  /** Altura del marcador sobre el objetivo, en fracción de su altura. */
  markerHeight: 0.72,
};

export const CINEMATIC = {
  /** Cuánto se aleja la cámara durante la entrada. */
  pullBack: 6,
  pitch: 0.42,
  turnDamp: 3,
  /** Temblor continuo mientras emerge (por segundo). */
  rumble: 0.55,
  /** La entrada se puede saltear desde la segunda vez. */
  seenKey: 'furia-boss-seen',
};
