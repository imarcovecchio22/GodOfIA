/** Parámetros del motor. Los números de gameplay viven en los otros archivos de `data/`. */
export const ENGINE = {
  /** Frecuencia de la simulación (pasos por segundo). */
  simHz: 60,
  /**
   * Delta real máximo que se acepta por frame. Igual que el prototipo (0,05 s):
   * por debajo de 20 fps el juego se ralentiza en vez de saltar.
   */
  maxFrameDelta: 0.05,
  maxPixelRatio: 2,
} as const;
