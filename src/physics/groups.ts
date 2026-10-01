/**
 * Grupos de colisión de Rapier: los 16 bits altos son la pertenencia y los bajos el filtro.
 * Dos colliders (o una consulta y un collider) interactúan si cada uno está en el filtro del otro.
 */
export const GROUP = {
  /** Pared invisible del borde: solo frena personajes. */
  WALL: 1 << 0,
  /** Columnas y antorchas: frenan personajes, cámara y hacha. */
  SOLID: 1 << 1,
  /** Rocas del borde: solo la cámara. */
  DECOR: 1 << 2,
  /** Collider propio de cada personaje: no lo ve ninguna consulta. */
  CHARACTER: 1 << 3,
  CAMERA: 1 << 4,
  PROJECTILE: 1 << 5,
} as const;

export function interactionGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

/** Escenario: pertenece a su grupo y deja que cualquiera lo consulte. */
export const scenery = (group: number): number => interactionGroups(group, 0xffff);

export const CHARACTER_BODY = interactionGroups(GROUP.CHARACTER, 0);
export const CHARACTER_QUERY = interactionGroups(GROUP.CHARACTER, GROUP.WALL | GROUP.SOLID);
export const CAMERA_QUERY = interactionGroups(GROUP.CAMERA, GROUP.SOLID | GROUP.DECOR);
export const PROJECTILE_QUERY = interactionGroups(GROUP.PROJECTILE, GROUP.SOLID);
