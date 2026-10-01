import {
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three';
import { REST_POSE, THROW, type ArmPose } from '../data/attacks';
import { PLAYER } from '../data/player';
import { clamp, damp, lerp, lerpAngle } from '../core/math';
import type { AxeSim } from '../entities/Axe';
import type { PlayerSim } from '../entities/Player';
import { box, cyl, mat, mesh, sph } from './primitives';

interface Arm {
  g: Group;
  hand: Group;
}

const pose: ArmPose = { ...REST_POSE };
const interp = new Vector3();

/** Pose del brazo en un ataque: anticipación, golpe y recuperación (curvas del prototipo). */
function attackPose(
  out: ArmPose,
  def: { active: readonly [number, number]; total: number; pose: { from: ArmPose; to: ArmPose } },
  t: number,
): void {
  const [a0, a1] = def.active;
  let a: ArmPose;
  let b: ArmPose;
  let u: number;
  if (t < a0) {
    u = t / a0;
    u = 1 - (1 - u) * (1 - u);
    a = REST_POSE;
    b = def.pose.from;
  } else if (t < a1) {
    u = Math.sqrt((t - a0) / (a1 - a0));
    a = def.pose.from;
    b = def.pose.to;
  } else {
    u = clamp((t - a1) / (def.total - a1), 0, 1);
    u = u * u;
    a = def.pose.to;
    b = REST_POSE;
  }
  out.x = lerp(a.x, b.x, u);
  out.y = lerp(a.y, b.y, u);
  out.z = lerp(a.z, b.z, u);
  out.ax = lerp(a.ax, b.ax, u);
  out.tw = lerp(a.tw, b.tw, u);
}

/** Guerrero de primitivas con animación procedural, portado del prototipo. */
export class PlayerView {
  readonly root = new Group();
  private readonly model = new Group();
  private readonly hips = new Group();
  private readonly torso = new Group();
  private readonly legL: Group;
  private readonly legR: Group;
  private readonly armL: Arm;
  readonly armR: Arm;
  /** Rotación X que tiene el hacha en la mano según la pose. */
  handAxeTilt = REST_POSE.ax;

  constructor(scene: Scene) {
    scene.add(this.root);
    this.root.add(this.model);
    this.hips.position.y = 0.95;
    this.model.add(this.hips);

    const skinM = mat(0xc58b6a);
    const leatherM = mat(0x4a3322);
    const furM = mat(0x7a6650, { roughness: 1 });
    const beardM = mat(0xb5542a);
    const clothM = mat(0x8a1c18);
    const metalM = mat(0xb4bcc6, { metalness: 0.85, roughness: 0.28 });
    const darkM = mat(0x2a2522);

    const makeLeg = (x: number): Group => {
      const g = new Group();
      g.position.set(x, 0, 0);
      this.hips.add(g);
      const th = box(0.24, 0.55, 0.28, leatherM);
      th.position.y = -0.27;
      const sn = box(0.22, 0.42, 0.26, furM);
      sn.position.y = -0.7;
      const bt = box(0.25, 0.14, 0.36, darkM);
      bt.position.set(0, -0.88, 0.05);
      g.add(th, sn, bt);
      return g;
    };
    this.legL = makeLeg(0.17);
    this.legR = makeLeg(-0.17);

    this.hips.add(this.torso);
    const t = this.torso;
    const belly = box(0.62, 0.4, 0.36, skinM);
    belly.position.y = 0.2;
    const chest = box(0.8, 0.5, 0.42, skinM);
    chest.position.y = 0.6;
    const belt = box(0.68, 0.14, 0.4, leatherM);
    belt.position.y = 0.02;
    const buckle = box(0.14, 0.12, 0.06, metalM);
    buckle.position.set(0, 0.02, 0.21);
    const sash = box(0.13, 0.95, 0.45, clothM);
    sash.position.set(0, 0.45, 0);
    sash.rotation.z = 0.7;
    const pelt = cyl(0.3, 0.36, 0.25, furM, 8);
    pelt.position.set(0.42, 0.86, 0);
    pelt.rotation.z = 0.5;
    const skirt = cyl(0.36, 0.47, 0.42, leatherM, 8);
    skirt.position.y = -0.16;
    const neck = cyl(0.14, 0.16, 0.2, skinM, 8);
    neck.position.y = 0.88;
    t.add(belly, chest, belt, buckle, sash, pelt, skirt, neck);

    const head = new Group();
    head.position.y = 1.06;
    t.add(head);
    head.add(sph(0.24, skinM, 14));
    const beard = mesh(new ConeGeometry(0.2, 0.44, 8), beardM);
    beard.rotation.x = Math.PI;
    beard.position.set(0, -0.22, 0.1);
    const brow = box(0.36, 0.06, 0.08, darkM);
    brow.position.set(0, 0.06, 0.2);
    head.add(beard, brow);
    const eyeM = new MeshBasicMaterial({ color: 0xffd27a });
    for (const x of [-0.08, 0.08]) {
      const e = new Mesh(new SphereGeometry(0.03, 6, 4), eyeM);
      e.position.set(x, 0, 0.215);
      head.add(e);
    }

    const makeArm = (x: number): Arm => {
      const g = new Group();
      g.position.set(x, 0.78, 0);
      g.rotation.order = 'YXZ';
      this.torso.add(g);
      const up = box(0.22, 0.42, 0.24, skinM);
      up.position.y = -0.2;
      const fo = box(0.2, 0.36, 0.22, leatherM);
      fo.position.y = -0.56;
      const hand = new Group();
      hand.position.y = -0.78;
      hand.add(box(0.18, 0.16, 0.18, skinM));
      g.add(up, fo, hand);
      return { g, hand };
    };
    this.armL = makeArm(0.5);
    this.armR = makeArm(-0.5);
  }

  /** Pose inicial al reiniciar la partida. */
  reset(): void {
    this.hips.rotation.x = 0;
    this.hips.position.y = 0.95;
  }

  /**
   * Ubica el modelo en la posición interpolada y anima. `dt` es tiempo de simulación del frame
   * (0 durante el hit-stop, así la pose queda congelada en el impacto).
   */
  update(p: PlayerSim, axe: AxeSim, alpha: number, dt: number, time: number): void {
    interp.lerpVectors(p.prevPos, p.pos, alpha);
    this.root.position.copy(interp);
    this.root.rotation.y = lerpAngle(p.prevFacing, p.facing, alpha);
    this.animate(p, axe, dt, time);
  }

  private animate(p: PlayerSim, axe: AxeSim, dt: number, time: number): void {
    Object.assign(pose, REST_POSE);
    let alx: number;
    let lL = 0;
    let lR = 0;
    let hipsY = 0.95;
    let torsoRX = 0;
    let snap = false;
    const moving = Math.min(p.vel.length() / PLAYER.walkSpeed, 1.4);
    const st = p.state;

    if (st === 'idle' || st === 'move') {
      const s = Math.sin(p.walk);
      pose.x = REST_POSE.x + s * 0.45 * moving;
      alx = -s * 0.55 * moving;
      lL = s * 0.75 * moving;
      lR = -s * 0.75 * moving;
      hipsY = 0.95 + Math.abs(Math.cos(p.walk)) * 0.06 * moving + Math.sin(time * 2) * 0.01;
      torsoRX = 0.08 * moving;
      if (axe.state === 'recall') Object.assign(pose, { x: -1.6, y: -0.25, z: 0, ax: 0, tw: -0.2 });
      else if (!axe.inHand) pose.z = -0.25;
    } else if (st === 'attack' || st === 'heavy' || st === 'throw') {
      const def = p.fsm.is('throw') ? THROW : p.attack;
      if (def) attackPose(pose, def, p.fsm.t);
      alx = st === 'heavy' ? pose.x : -0.6;
      lL = -0.45;
      lR = 0.35;
      torsoRX = 0.15;
      snap = true;
      if (st === 'heavy' && p.fsm.t > (p.attack?.active[0] ?? 0)) hipsY = 0.8;
    } else if (st === 'dodge') {
      const u = p.fsm.t / PLAYER.dodge.duration;
      this.hips.rotation.x = u * Math.PI * 2;
      hipsY = 0.55 + Math.sin(u * Math.PI) * 0.3;
      torsoRX = 0.9;
      lL = lR = -1.6;
      Object.assign(pose, { x: -1.2, y: 0, z: 0, ax: REST_POSE.ax, tw: 0 });
      alx = -1.2;
      snap = true;
    } else if (st === 'hurt') {
      torsoRX = -0.35;
      pose.x = 0.3;
      alx = 0.3;
    } else {
      this.hips.rotation.x = lerp(this.hips.rotation.x, -1.45, damp(6, dt));
      hipsY = 0.3;
      pose.x = -2.8;
      alx = -2.8;
      lL = -0.3;
      lR = 0.2;
    }

    const k = snap ? 1 : damp(16, dt);
    const ar = this.armR.g.rotation;
    ar.x = lerp(ar.x, pose.x, k);
    ar.y = lerp(ar.y, pose.y, k);
    ar.z = lerp(ar.z, pose.z, k);
    const al = this.armL.g.rotation;
    al.x = lerp(al.x, alx, k);
    al.z = lerp(al.z, 0.1, k);
    this.torso.rotation.y = lerp(this.torso.rotation.y, pose.tw, k);
    this.torso.rotation.x = lerp(this.torso.rotation.x, torsoRX, k);
    this.legL.rotation.x = lerp(this.legL.rotation.x, lL, k);
    this.legR.rotation.x = lerp(this.legR.rotation.x, lR, k);
    this.hips.position.y = lerp(this.hips.position.y, hipsY, snap ? damp(30, dt) : damp(12, dt));
    if (st !== 'dodge' && st !== 'dead') {
      this.hips.rotation.x = lerp(this.hips.rotation.x, 0, damp(20, dt));
    }
    this.handAxeTilt = lerp(this.handAxeTilt, pose.ax, k);

    // Parpadeo durante la invulnerabilidad.
    this.model.visible = !(
      p.invuln > 0 &&
      st !== 'dead' &&
      st !== 'hurt' &&
      Math.floor(p.invuln * 20) % 2 === 0
    );
  }

  /** Escribe en `out` la posición de la mano derecha en el mundo. */
  handWorldPosition(out: Vector3): Vector3 {
    this.root.updateMatrixWorld(true);
    return this.armR.hand.getWorldPosition(out);
  }
}
