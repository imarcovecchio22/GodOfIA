/**
 * Ataques del jugador, data-driven. Agregar un ataque es agregar un objeto acá.
 * Valores portados de `reference/prototype.html`.
 */

/** Arco frente al jugador: entra todo lo que está a menos de `range` y dentro del cono. */
export interface ArcShape {
  kind: 'arc';
  range: number;
  /** Umbral del producto punto entre el frente y la dirección al objetivo. */
  minDot: number;
}

/** Círculo centrado `offset` unidades adelante del jugador. */
export interface CircleShape {
  kind: 'circle';
  radius: number;
  offset: number;
}

export type HitShape = ArcShape | CircleShape;

/** Impacto puntual (golpe pesado): pega una sola vez en `at` y suma un efecto propio. */
export interface ImpactDef {
  at: number;
  shake: number;
  ringRadius: number;
  ringDuration: number;
}

export interface AttackDef {
  id: string;
  /** Ventana activa [inicio, fin] en segundos desde que arranca el ataque. */
  active: [number, number];
  total: number;
  damage: number;
  shape: HitShape;
  knockback: number;
  /** Avance hacia adelante (u/s) durante la ventana activa. */
  lunge: number;
  hitStop: number;
  shake: number;
  /** Golpe pesado: rompe la súper armadura (aturde a los brutos) y suena más fuerte. */
  heavy: boolean;
  /** Si está, pega una sola vez en `impact.at` en vez de durante toda la ventana. */
  impact?: ImpactDef;
}

export interface CombatTuning {
  /** El alcance se extiende `radio del objetivo × este factor`. */
  targetRadiusReach: number;
  /** Por debajo de esta distancia no se chequea el arco (el objetivo está encima). */
  arcMinDistance: number;
  /** Mezcla entre el frente del jugador y la dirección al objetivo para el empuje de un arco. */
  arcKnockbackBlend: number;
}

export const COMBAT: CombatTuning = {
  targetRadiusReach: 0.6,
  arcMinDistance: 0.4,
  arcKnockbackBlend: 0.5,
};

export const LIGHT_COMBO: AttackDef[] = [
  {
    id: 'light1',
    active: [0.1, 0.2],
    total: 0.38,
    damage: 14,
    shape: { kind: 'arc', range: 2.5, minDot: 0.2 },
    knockback: 5,
    lunge: 4,
    hitStop: 0.05,
    shake: 0.22,
    heavy: false,
  },
  {
    id: 'light2',
    active: [0.1, 0.2],
    total: 0.38,
    damage: 14,
    shape: { kind: 'arc', range: 2.5, minDot: 0.2 },
    knockback: 5,
    lunge: 4,
    hitStop: 0.05,
    shake: 0.22,
    heavy: false,
  },
  {
    id: 'light3',
    active: [0.18, 0.3],
    total: 0.56,
    damage: 24,
    shape: { kind: 'arc', range: 2.8, minDot: 0.05 },
    knockback: 12,
    lunge: 7,
    hitStop: 0.08,
    shake: 0.42,
    // En el prototipo el tercer golpe también aturde a los brutos.
    heavy: true,
  },
];

export const HEAVY: AttackDef = {
  id: 'heavy',
  active: [0.4, 0.5],
  total: 0.85,
  damage: 34,
  shape: { kind: 'circle', radius: 3.3, offset: 1.3 },
  knockback: 14,
  lunge: 2,
  hitStop: 0.1,
  shake: 0.7,
  heavy: true,
  impact: { at: 0.43, shake: 0.35, ringRadius: 3.4, ringDuration: 0.4 },
};

/** El lanzamiento: timing de la acción; no hace daño cuerpo a cuerpo. */
export interface ThrowDef {
  active: [number, number];
  total: number;
  /** Momento en que el hacha sale de la mano. */
  releaseAt: number;
}

export const THROW: ThrowDef = {
  active: [0.1, 0.16],
  total: 0.36,
  releaseAt: 0.12,
};
