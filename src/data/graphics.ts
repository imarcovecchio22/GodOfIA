/** Calidad gráfica y post-procesado (fase 4). */

export type Quality = 'low' | 'medium' | 'high';

export interface QualityPreset {
  /** Tope del devicePixelRatio. */
  maxPixelRatio: number;
  shadowMapSize: number;
  bloom: boolean;
  /** Muestras de MSAA del composer (0 = sin antialiasing). */
  multisampling: number;
}

export const QUALITY: Record<Quality, QualityPreset> = {
  low: { maxPixelRatio: 1, shadowMapSize: 1024, bloom: false, multisampling: 0 },
  medium: { maxPixelRatio: 1.5, shadowMapSize: 2048, bloom: true, multisampling: 2 },
  high: { maxPixelRatio: 2, shadowMapSize: 2048, bloom: true, multisampling: 4 },
};

export const DEFAULT_QUALITY: Quality = 'medium';

export interface PostFxTuning {
  exposure: number;
  /** Solo brilla lo que supera esta luminancia (llamas, runas, ojos, hacha). */
  bloomThreshold: number;
  bloomSmoothing: number;
  bloomIntensity: number;
  bloomRadius: number;
  vignetteOffset: number;
  vignetteDarkness: number;
  /** Corrección de color final: saturación (−1 a 1), brillo y contraste (−1 a 1). */
  saturation: number;
  brightness: number;
  contrast: number;
}

export const POSTFX: PostFxTuning = {
  exposure: 0.95,
  bloomThreshold: 0.62,
  bloomSmoothing: 0.25,
  bloomIntensity: 0.9,
  bloomRadius: 0.7,
  vignetteOffset: 0.32,
  vignetteDarkness: 0.62,
  saturation: 0.08,
  brightness: 0,
  contrast: 0.12,
};
