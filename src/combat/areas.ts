/**
 * Áreas de ataque y de peligro sobre el piso. La misma forma se usa para el chequeo de daño y para
 * dibujar el aviso (decal), así lo que se ve es exactamente lo que pega.
 *
 * Todas se ubican con un origen (x, z) y una dirección `dir` (ángulo como `facing`: adelante es
 * (sin dir, cos dir)).
 */
export type AreaShape =
  /** Sector centrado en el origen, abierto `angle` radianes en total hacia `dir`. */
  | { kind: 'arc'; radius: number; angle: number }
  /** Círculo centrado en el origen. */
  | { kind: 'circle'; radius: number }
  /** Rectángulo que sale del origen hacia `dir`. */
  | { kind: 'line'; length: number; width: number }
  /** Anillo centrado en el origen. */
  | { kind: 'ring'; inner: number; outer: number };

/** ¿Un círculo de radio `r` en (px, pz) toca el área? */
export function areaContains(
  shape: AreaShape,
  ox: number,
  oz: number,
  dir: number,
  px: number,
  pz: number,
  r = 0,
): boolean {
  const dx = px - ox;
  const dz = pz - oz;
  const dist = Math.hypot(dx, dz);
  switch (shape.kind) {
    case 'circle':
      return dist <= shape.radius + r;
    case 'ring':
      return dist + r >= shape.inner && dist - r <= shape.outer;
    case 'arc': {
      if (dist > shape.radius + r) return false;
      if (dist <= r) return true;
      const fx = Math.sin(dir);
      const fz = Math.cos(dir);
      const cos = (dx * fx + dz * fz) / dist;
      const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
      // El radio del objetivo ensancha el sector en el borde.
      return angle <= shape.angle / 2 + Math.asin(Math.min(1, r / dist));
    }
    case 'line': {
      const fx = Math.sin(dir);
      const fz = Math.cos(dir);
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      return along >= -r && along <= shape.length + r && side <= shape.width / 2 + r;
    }
  }
}
