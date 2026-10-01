import type { Vector3 } from 'three';

/** Cuerpo de colisión de un personaje (cápsula vertical). Opaco para la simulación. */
export interface CharacterBody {
  readonly radius: number;
}

/**
 * Lo que la simulación necesita de la física. La implementa `physics/PhysicsWorld` sobre Rapier.
 */
export interface Collision {
  createCharacter(radius: number, height: number): CharacterBody;
  removeCharacter(body: CharacterBody): void;
  /**
   * Mueve el personaje de `from` a `to` respetando el escenario: corrige `to` en el lugar,
   * deslizando contra columnas y el borde.
   */
  moveCharacter(body: CharacterBody, from: Vector3, to: Vector3): void;
  /**
   * Segmento contra las superficies sólidas (columnas, antorchas). Devuelve la fracción del
   * segmento donde choca, en [0, 1], o −1 si no choca.
   */
  castSolid(from: Vector3, to: Vector3): number;
}
