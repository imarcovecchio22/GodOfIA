/** Geometría de la arena e iluminación. Valores portados de `reference/prototype.html`. */
import { Rng } from '../core/Rng';

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
  pillarHeight: number;
  /** Capitel de la columna (caja cuadrada encima del fuste). */
  pillarCapSize: number;
  pillarCapHeight: number;
  torchHeight: number;
  rockCount: number;
  /** Semilla del borde de rocas: la vista y la física tienen que generar el mismo layout. */
  rockSeed: number;
}

export const ARENA: ArenaTuning = {
  radius: 22,
  edgePadding: 0.9,
  pillarRing: 9,
  pillarRadius: 1.0,
  torchRing: 15,
  torchRadius: 0.35,
  pillarHeight: 4.6,
  pillarCapSize: 2.1,
  pillarCapHeight: 0.4,
  torchHeight: 2.6,
  rockCount: 46,
  rockSeed: 2207,
};

export interface Rock {
  x: number;
  y: number;
  z: number;
  /** Radio del dodecaedro. */
  size: number;
  rx: number;
  ry: number;
  rz: number;
}

/** Rocas del borde, por fuera de la plataforma. Determinístico para que vista y física coincidan. */
export function rockLayout(): Rock[] {
  const rng = new Rng(ARENA.rockSeed);
  const out: Rock[] = [];
  const n = ARENA.rockCount;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.05, 0.05);
    const r = ARENA.radius + rng.range(0.6, 3.2);
    const size = rng.range(0.8, 2.4);
    out.push({
      x: Math.sin(a) * r,
      y: size * 0.35,
      z: Math.cos(a) * r,
      size,
      rx: rng.range(0, 3),
      ry: rng.range(0, 3),
      rz: rng.range(0, 3),
    });
  }
  return out;
}

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
 * Iluminación (fase 4: pipeline sRGB con tone mapping AgX). Calibrada a ojo para mantener la noche
 * del prototipo: ambiente y luna bajos, y las antorchas como fuente cálida principal. Las puntuales
 * usan decay 1 con intensidades físicas.
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

export const LIGHTING: LightingTuning = {
  fogColor: 0x18202c,
  fogDensity: 0.028,
  hemiSky: 0x9fb2d6,
  hemiGround: 0x2a1f18,
  hemiIntensity: 0.6,
  moonColor: 0xc4d4ff,
  moonIntensity: 1.3,
  torchColor: 0xff8a3a,
  torchDistance: 16,
  torchIntensity: 13.6,
  torchFlicker: 9.1,
  axeLightColor: 0x7fe0ff,
  axeLightDistance: 7,
  axeLightFlying: 5.6,
  axeLightGround: 4.4,
  axeLightGroundPulse: 1.6,
};
