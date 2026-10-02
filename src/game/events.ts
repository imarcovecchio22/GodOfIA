import type { BossAttackId, BossPhase } from '../data/boss';
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
  /** Empieza a cargar un ataque (aviso: ojos rojos y gruñido). */
  'enemy:windup': { enemy: EnemySim };
  'enemy:removed': { enemy: EnemySim };
  'enemy:hit': Point & { enemy: EnemySim };
  'enemy:killed': { enemy: EnemySim };
  'enemy:frozen': Point;
  'axe:thrown': undefined;
  'axe:hit': undefined;
  'axe:embedded': Point & { surface: 'floor' | 'obstacle' | 'edge' };
  'axe:recalled': undefined;
  'axe:caught': Point;
  'wave:start': { wave: number; boss: boolean };
  'wave:cleared': { wave: number };
  'combo:changed': { combo: number };
  'boss:intro': { appearance: number };
  'boss:phase': { phase: BossPhase };
  /** Empieza la carga de un golpe (pose + decal + sonido). */
  'boss:windup': { attack: BossAttackId; strike: number };
  'boss:strike': { attack: BossAttackId; x: number; z: number };
  'boss:hit': Point;
  'boss:hooked': undefined;
  'boss:summon': undefined;
  'boss:broken': undefined;
  'boss:recovered': undefined;
  'boss:stunned': { x: number; z: number };
  'boss:leap': undefined;
  'boss:landed': { x: number; z: number };
  'boss:ring': undefined;
  /** Murió: empieza la cámara lenta y la animación de muerte. */
  'boss:died': Point;
  /** Terminó la animación de muerte: la oleada puede cerrarse. */
  'boss:defeated': undefined;
}

/** Respuesta inmediata al impacto: la provee el juego (Time + CameraRig) o un doble en tests. */
export interface Feedback {
  hitStop(seconds: number): void;
  shake(trauma: number): void;
}
