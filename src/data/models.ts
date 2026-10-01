/**
 * Modelos y animaciones (fase 3). Los tiempos de gameplay siguen viviendo en las otras tablas de
 * `data/`: cada clip se estira o se comprime para que su cuadro de contacto caiga en el momento
 * de impacto del ataque. Cambiar un asset nunca cambia el game feel.
 *
 * `contact` es el segundo del clip en que el arma pega. Se mide con
 * `node scripts/analyze-clips.mjs` (pico de velocidad de la mano, o el punto donde frena contra el
 * piso en los golpes de arriba hacia abajo).
 */
import type { EnemyKind } from './enemies';

export interface ClipRef {
  clip: string;
  /** Segundo del clip en que el golpe conecta (o el hacha sale de la mano). */
  contact: number;
}

export interface LocomotionTuning {
  idle: string;
  walk: string;
  run: string;
  /** Velocidad (u/s) a la que el clip de caminar se reproduce a velocidad 1. */
  walkClipSpeed: number;
  runClipSpeed: number;
  /** Debajo de esta velocidad domina caminar; arriba, correr. */
  walkToRunSpeed: number;
  /** Tope de la velocidad de reproducción de los ciclos (los personajes tienen piernas cortas). */
  maxTimeScale: number;
}

export interface CharacterModel {
  /** Nombre del GLB en `src/assets/models/`. */
  file: string;
  scale: number;
  /** Tinte multiplicado sobre la textura. */
  tint: number;
  /** Fundido entre clips de acción (s). Corto: el prototipo cambiaba de pose al instante. */
  actionFade: number;
  locomotionFade: number;
}

export const PLAYER_MODEL: CharacterModel & {
  locomotion: LocomotionTuning;
  attacks: Record<string, ClipRef>;
  throwClip: ClipRef;
  dodge: string;
  hurt: string;
  hurtTimeScale: number;
  death: string;
  /** Nodo del hacha dentro del modelo: es la que se lanza. */
  axeNode: string;
  /** Hueso donde va el hacha (Three saca los puntos: `handslot.r` → `handslotr`). */
  handBone: string;
  axeGlow: number;
} = {
  file: 'barbarian',
  scale: 1,
  tint: 0xffffff,
  actionFade: 0.06,
  locomotionFade: 0.15,
  locomotion: {
    idle: 'Idle',
    walk: 'Walking_A',
    run: 'Running_A',
    walkClipSpeed: 1.6,
    runClipSpeed: 3.6,
    walkToRunSpeed: 3,
    maxTimeScale: 2.4,
  },
  attacks: {
    light1: { clip: '1H_Melee_Attack_Slice_Diagonal', contact: 0.375 },
    light2: { clip: '1H_Melee_Attack_Slice_Horizontal', contact: 0.242 },
    light3: { clip: '1H_Melee_Attack_Chop', contact: 0.575 },
    heavy: { clip: '2H_Melee_Attack_Chop', contact: 0.8 },
  },
  throwClip: { clip: 'Throw', contact: 0.7 },
  dodge: 'Dodge_Forward',
  hurt: 'Hit_A',
  hurtTimeScale: 1.6,
  death: 'Death_A',
  axeNode: '1H_Axe',
  handBone: 'handslotr',
  axeGlow: 0x0e3a44,
};

export interface EnemyModel extends CharacterModel {
  locomotion: Omit<LocomotionTuning, 'run' | 'runClipSpeed' | 'walkToRunSpeed'>;
  attack: ClipRef;
  hit: string;
  /** El aturdimiento dura 0,32 s: se muestra el comienzo de la reacción, algo acelerado. */
  hitTimeScale: number;
  death: string;
  spawn: string;
  /** Segundo del clip de aparición en que el esqueleto ya está parado en el piso. */
  spawnEnd: number;
  eyeIdle: number;
  eyeAttack: number;
  eyeFrozen: number;
  eyeDead: number;
  /** Nodo con los ojos (material propio para cambiar de color). */
  eyesNode: string;
}

const skeleton = {
  scale: 1,
  actionFade: 0.08,
  locomotionFade: 0.2,
  hit: 'Hit_A',
  hitTimeScale: 1.4,
  death: 'Death_C_Skeletons',
  spawn: 'Spawn_Ground_Skeletons',
  spawnEnd: 2.67,
  eyeIdle: 0x66e6ff,
  eyeAttack: 0xff3a22,
  eyeFrozen: 0xffffff,
  eyeDead: 0x222222,
};

export const ENEMY_MODELS: Record<EnemyKind, EnemyModel> = {
  draugr: {
    ...skeleton,
    file: 'draugr',
    tint: 0xb9c9a6,
    eyesNode: 'Skeleton_Minion_Eyes',
    locomotion: {
      idle: 'Idle_Combat',
      walk: 'Running_C',
      walkClipSpeed: 2.2,
      maxTimeScale: 2,
    },
    attack: { clip: '1H_Melee_Attack_Chop', contact: 0.575 },
  },
  brute: {
    ...skeleton,
    file: 'brute',
    tint: 0x98a48e,
    eyesNode: 'Skeleton_Warrior_Eyes',
    locomotion: {
      idle: 'Idle_Combat',
      walk: 'Walking_D_Skeletons',
      walkClipSpeed: 1.1,
      maxTimeScale: 2,
    },
    attack: { clip: '2H_Melee_Attack_Chop', contact: 0.8 },
  },
};

export interface AnimationTiming {
  /**
   * En el ataque enemigo, el golpe conecta este tiempo después de terminar la carga (en el
   * prototipo el brazo completaba el arco a los 0,14 s).
   */
  enemyContactDelay: number;
  /** Solo proyectan sombra los personajes a menos de esta distancia del jugador. */
  shadowDistance: number;
}

export const ANIMATION: AnimationTiming = {
  enemyContactDelay: 0.14,
  shadowDistance: 14,
};
