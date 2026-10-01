import type { EnemySim } from '../entities/Enemy';

export interface Point {
  x: number;
  y: number;
  z: number;
}

/** Eventos de la simulación. Audio, FX y HUD los escuchan; el combate no los conoce. */
export interface GameEvents {
  'player:swing': { heavy: boolean };
  'player:slam': { x: number; z: number; armed: boolean };
  /** Primer enemigo alcanzado en un ataque. */
  'player:hit-landed': { heavy: boolean };
  'player:hurt': Point & { big: boolean };
  'player:died': undefined;
  'player:dodge': Point;
  'player:healed': Point;
  'enemy:spawned': { enemy: EnemySim };
  'enemy:removed': { enemy: EnemySim };
  'enemy:hit': Point & { enemy: EnemySim };
  'enemy:killed': { enemy: EnemySim };
  'enemy:frozen': Point;
  'axe:thrown': undefined;
  'axe:hit': undefined;
  'axe:embedded': Point & { surface: 'floor' | 'obstacle' | 'edge' };
  'axe:recalled': undefined;
  'axe:caught': Point;
  'wave:start': { wave: number };
  'wave:cleared': { wave: number };
  'combo:changed': { combo: number };
}

/** Respuesta inmediata al impacto: la provee el juego (Time + CameraRig) o un doble en tests. */
export interface Feedback {
  hitStop(seconds: number): void;
  shake(trauma: number): void;
}
