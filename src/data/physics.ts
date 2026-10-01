/** Parámetros de la física (Rapier): character controller, pared del borde y cámara. */
export interface PhysicsTuning {
  /** Margen que el character controller deja entre el personaje y los obstáculos. */
  characterOffset: number;
  /** Alto de la cápsula de un personaje de escala 1 (se escala con el arquetipo). */
  characterHeight: number;
  /** La pared invisible del borde se arma con este número de segmentos. */
  wallSegments: number;
  wallThickness: number;
  wallHeight: number;
  /** Las rocas colisionan con la cámara como esferas de radio tamaño × este factor. */
  rockColliderScale: number;
}

export const PHYSICS: PhysicsTuning = {
  characterOffset: 0.01,
  characterHeight: 1.9,
  wallSegments: 64,
  wallThickness: 1,
  wallHeight: 6,
  rockColliderScale: 0.8,
};
