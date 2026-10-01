/** Geometría de la arena e iluminación. Valores portados de `reference/prototype.html`. */

export interface CircleObstacle {
  x: number;
  z: number;
  r: number;
}

export interface ArenaTuning {
  radius: number;
  /** Los personajes no pasan de radio − edgePadding − su radio. */
  edgePadding: number;
  pillarRing: number;
  pillarRadius: number;
  torchRing: number;
  torchRadius: number;
}

export const ARENA: ArenaTuning = {
  radius: 22,
  edgePadding: 0.9,
  pillarRing: 9,
  pillarRadius: 1.0,
  torchRing: 15,
  torchRadius: 0.35,
};

/** Columnas en diagonal (π/4 + i·π/2) y antorchas en los ejes (i·π/2). */
export function pillarPositions(): CircleObstacle[] {
  const out: CircleObstacle[] = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    out.push({
      x: Math.sin(a) * ARENA.pillarRing,
      z: Math.cos(a) * ARENA.pillarRing,
      r: ARENA.pillarRadius,
    });
  }
  return out;
}

export function torchPositions(): CircleObstacle[] {
  const out: CircleObstacle[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    out.push({
      x: Math.sin(a) * ARENA.torchRing,
      z: Math.cos(a) * ARENA.torchRing,
      r: ARENA.torchRadius,
    });
  }
  return out;
}

/**
 * Iluminación. El prototipo usaba Three r128 con luces "legacy", que multiplicaban la irradiancia
 * por π y tenían otra caída de distancia. Los valores de acá están convertidos para que se vea
 * igual con las luces físicas actuales:
 * - Hemisférica y direccional: intensidad del prototipo × π.
 * - Puntuales: decay 1 e intensidad calibrada para igualar la caída legacy entre 3 y 12 u.
 */
export interface LightingTuning {
  fogColor: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  moonColor: number;
  moonIntensity: number;
  torchColor: number;
  torchDistance: number;
  torchIntensity: number;
  /** Amplitud del titileo, en la misma escala que la intensidad. */
  torchFlicker: number;
  axeLightColor: number;
  axeLightDistance: number;
  axeLightFlying: number;
  axeLightGround: number;
  axeLightGroundPulse: number;
}

const LEGACY_PI = Math.PI;
/** Conversión de intensidad puntual legacy (decay 1,5, dist 16) a física con decay 1. */
const TORCH_LEGACY_TO_PHYSICAL = 9.1;
/** Idem para la luz del hacha (decay 1,6, dist 7). */
const AXE_LEGACY_TO_PHYSICAL = 4;

export const LIGHTING: LightingTuning = {
  fogColor: 0x18202c,
  fogDensity: 0.028,
  hemiSky: 0x9fb2d6,
  hemiGround: 0x2a1f18,
  hemiIntensity: 0.55 * LEGACY_PI,
  moonColor: 0xc4d4ff,
  moonIntensity: 0.75 * LEGACY_PI,
  torchColor: 0xff8a3a,
  torchDistance: 16,
  torchIntensity: 1.5 * TORCH_LEGACY_TO_PHYSICAL,
  torchFlicker: TORCH_LEGACY_TO_PHYSICAL,
  axeLightColor: 0x7fe0ff,
  axeLightDistance: 7,
  axeLightFlying: 1.4 * AXE_LEGACY_TO_PHYSICAL,
  axeLightGround: 1.1 * AXE_LEGACY_TO_PHYSICAL,
  axeLightGroundPulse: 0.4 * AXE_LEGACY_TO_PHYSICAL,
};
