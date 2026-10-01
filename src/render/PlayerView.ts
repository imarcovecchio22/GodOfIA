import { Group, Vector3, type Object3D, type Scene } from 'three';
import { HEAVY, LIGHT_COMBO, THROW, type AttackDef } from '../data/attacks';
import { PLAYER_MODEL } from '../data/models';
import { PLAYER } from '../data/player';
import { clamp, lerpAngle } from '../core/math';
import type { PlayerSim, PlayerState } from '../entities/Player';
import { Animator } from './Animator';
import { instantiate, type CharacterTemplate } from './characters';
import { impactTimeOf, warpTime } from './timeWarp';

const interp = new Vector3();
const M = PLAYER_MODEL;

/** El guerrero: modelo animado, sincronizado con el estado de la simulación. */
export class PlayerView {
  readonly root = new Group();
  /** Hueso de la mano derecha: de acá sale y acá vuelve el hacha. */
  readonly hand: Object3D;
  /** El hacha del modelo (la maneja `AxeView`). */
  readonly axeObject: Object3D;
  private readonly model: Object3D;
  private readonly animator: Animator;

  private lastState: PlayerState | null = null;
  private lastT = 0;
  private lastAttack: AttackDef | null = null;

  constructor(scene: Scene, template: CharacterTemplate) {
    const inst = instantiate(template, { tint: M.tint, exclude: [M.axeNode] });
    this.model = inst.root;
    this.model.scale.setScalar(M.scale);
    this.root.add(this.model);
    scene.add(this.root);
    const hand = this.model.getObjectByName(M.handBone);
    const axe = this.model.getObjectByName(M.axeNode);
    if (!hand || !axe) throw new Error('Al modelo del jugador le falta la mano o el hacha');
    this.hand = hand;
    this.axeObject = axe;
    this.animator = new Animator(this.model, template.clips);
    this.locomotion(0, 0);
  }

  reset(): void {
    this.lastState = null;
    this.animator.stop(0);
  }

  /**
   * `dt` es tiempo de simulación del frame (0 durante el hit-stop: la pose queda congelada en el
   * impacto). En el menú se pasa tiempo real para que respire.
   */
  update(p: PlayerSim, alpha: number, dt: number): void {
    interp.lerpVectors(p.prevPos, p.pos, alpha);
    this.root.position.copy(interp);
    this.root.rotation.y = lerpAngle(p.prevFacing, p.facing, alpha);
    this.animate(p, dt);
    // Parpadeo durante la invulnerabilidad.
    this.root.visible = !(
      p.invuln > 0 &&
      p.state !== 'dead' &&
      p.state !== 'hurt' &&
      Math.floor(p.invuln * 20) % 2 === 0
    );
  }

  /** Mezcla quieto/caminar/correr según la velocidad. */
  private locomotion(speed: number, fade: number): void {
    const L = M.locomotion;
    const split = L.walkToRunSpeed;
    let idle = 0;
    let walk: number;
    let run = 0;
    if (speed < split) {
      walk = speed / split;
      idle = 1 - walk;
    } else {
      run = clamp((speed - split) / split, 0, 1);
      walk = 1 - run;
    }
    const ts = (clipSpeed: number): number => clamp(speed / clipSpeed, 0.5, L.maxTimeScale);
    this.animator.setBase(L.idle, idle, 1, fade);
    this.animator.setBase(L.walk, walk, ts(L.walkClipSpeed), fade);
    this.animator.setBase(L.run, run, ts(L.runClipSpeed), fade);
  }

  private animate(p: PlayerSim, dt: number): void {
    const st = p.state;
    const t = p.fsm.t;
    // Una acción nueva (aunque sea el mismo estado): reinicia el clip.
    const restart = st !== this.lastState || t < this.lastT || p.attack !== this.lastAttack;
    this.lastState = st;
    this.lastT = t;
    this.lastAttack = p.attack;
    const a = this.animator;
    this.locomotion(p.vel.length(), M.locomotionFade);

    if (st === 'attack' || st === 'heavy') {
      const def = p.attack ?? HEAVY;
      const ref = M.attacks[def.id] ?? M.attacks[LIGHT_COMBO[0]?.id ?? ''];
      if (ref) {
        const time = warpTime(t, impactTimeOf(def), def.total, ref.contact, a.duration(ref.clip));
        a.drive(ref.clip, time, { fade: M.actionFade, restart });
      }
    } else if (st === 'throw') {
      const ref = M.throwClip;
      const time = warpTime(t, THROW.releaseAt, THROW.total, ref.contact, a.duration(ref.clip));
      a.drive(ref.clip, time, { fade: M.actionFade, restart });
    } else if (st === 'dodge') {
      const time = (t / PLAYER.dodge.duration) * a.duration(M.dodge);
      a.drive(M.dodge, time, { fade: M.actionFade, restart });
    } else if (st === 'hurt') {
      a.play(M.hurt, { fade: M.actionFade, timeScale: M.hurtTimeScale, restart });
    } else if (st === 'dead') {
      a.play(M.death, { fade: M.actionFade });
    } else {
      a.stop(M.locomotionFade);
    }
    a.update(dt);
  }

  /** Escribe en `out` la posición de la mano derecha en el mundo. */
  handWorldPosition(out: Vector3): Vector3 {
    this.root.updateMatrixWorld(true);
    return this.hand.getWorldPosition(out);
  }
}
