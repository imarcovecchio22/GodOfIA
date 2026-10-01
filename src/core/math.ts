export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Factor de suavizado exponencial independiente del framerate: `lerp(a, b, damp(k, dt))`. */
export const damp = (k: number, dt: number): number => 1 - Math.exp(-k * dt);

/** Interpola ángulos por el camino más corto. */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}
