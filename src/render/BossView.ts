import { Color, Group, MeshStandardMaterial, type Scene } from 'three';
import { damp, lerp, lerpAngle } from '../core/math';
import { BOSS } from '../data/boss';
import { BOSS_LOOK } from '../data/bossView';
import { effectiveWindup, type BossSim } from '../entities/Boss';
import { box, cyl, mat, sph } from '../render/primitives';

/** Pose objetivo del greybox; la vista la persigue con suavizado. */
interface Pose {
  /** Brazos: giro horizontal (hacia el costado) y vertical (arriba/abajo). */
  armsYaw: number;
  armsPitch: number;
  /** Inclinación del torso hacia adelante. */
  lean: number;
  /** Altura extra del cuerpo (negativa = agachado / arrodillado). */
  drop: number;
}

const pose: Pose = { armsYaw: 0, armsPitch: 0, lean: 0, drop: 0 };
const ease = (u: number) => 1 - (1 - u) * (1 - u);

/**
 * El Jarl Ahogado en greybox (primitivas), hasta que la pelea se sienta bien y llegue el modelo.
 * Lee el estado interpolado del jefe; las poses salen del estado y del tiempo en él.
 */
export class BossView {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly torso = new Group();
  private readonly arms = new Group();
  private readonly chain = new Group();
  private readonly skin: MeshStandardMaterial;
  private readonly fire: MeshStandardMaterial;
  private readonly fireColor = new Color(BOSS_LOOK.fire);
  private readonly cur: Pose = { armsYaw: 0, armsPitch: 0.3, lean: 0, drop: 0 };

  constructor(scene: Scene) {
    this.skin = mat(BOSS_LOOK.bone, { roughness: 0.9 });
    this.fire = mat(0x000000, { emissive: BOSS_LOOK.fire, emissiveIntensity: 2 });
    const rust = mat(BOSS_LOOK.rust, { roughness: 0.7, metalness: 0.4 });
    const iron = mat(BOSS_LOOK.iron, { roughness: 0.5, metalness: 0.7 });
    const algae = mat(BOSS_LOOK.algae);

    // Piernas.
    for (const sx of [-0.6, 0.6]) {
      const leg = cyl(0.42, 0.34, 2.5, this.skin);
      leg.position.set(sx, 1.25, 0);
      this.body.add(leg);
    }
    // Torso, pecho con fuego azul, cabeza, barba y corona.
    const chest = cyl(1.35, 0.95, 2.6, this.skin, 12);
    chest.position.y = 1.3;
    const heart = sph(0.38, this.fire, 10);
    heart.position.set(0, 1.55, 0.95);
    const head = sph(0.66, this.skin, 14);
    head.position.y = 3.1;
    const beard = cyl(0.55, 0.05, 1.3, algae, 8);
    beard.position.set(0, 2.45, 0.38);
    const crownBand = cyl(0.62, 0.68, 0.28, rust, 12);
    crownBand.position.y = 3.62;
    this.torso.add(chest, heart, head, beard, crownBand);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = box(0.14, 0.42, 0.1, rust);
      spike.position.set(Math.sin(a) * 0.6, 3.92, Math.cos(a) * 0.6);
      spike.rotation.y = a;
      this.torso.add(spike);
    }
    for (const sx of [-0.24, 0.24]) {
      const eye = sph(0.11, this.fire, 8);
      eye.position.set(sx, 3.18, 0.56);
      eye.castShadow = false;
      this.torso.add(eye);
    }
    // Brazos y hacha a dos manos: todo gira desde los hombros.
    this.arms.position.y = 2.2;
    for (const sx of [-1.3, 1.3]) {
      const arm = cyl(0.32, 0.26, 2.3, this.skin);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(sx * 0.85, 0, 1.05);
      this.arms.add(arm);
    }
    const handle = cyl(0.1, 0.1, 4.2, iron, 6);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, 2.6);
    const blade = box(0.14, 1.6, 1.1, iron);
    blade.position.set(0, 0.55, 4.25);
    const edge = box(0.05, 1.4, 0.12, this.fire);
    edge.position.set(0, 0.55, 4.82);
    this.arms.add(handle, blade, edge);
    // Cadena de ancla enrollada en el brazo izquierdo.
    for (let i = 0; i < 4; i++) {
      const link = cyl(0.36, 0.36, 0.12, iron, 8);
      link.position.set(-1.1, 0.0, 0.55 + i * 0.32);
      link.rotation.x = Math.PI / 2;
      this.chain.add(link);
    }
    this.arms.add(this.chain);
    this.torso.position.y = 2.5;
    this.torso.add(this.arms);
    this.body.add(this.torso);
    this.root.add(this.body);
    this.root.visible = false;
    scene.add(this.root);
  }

  update(b: BossSim, alpha: number, dt: number, time: number): void {
    const visible = b.state !== 'inactive' && b.state !== 'dead';
    this.root.visible = visible;
    if (!visible) return;

    this.root.position.lerpVectors(b.prevPos, b.pos, alpha);
    this.root.rotation.y = lerpAngle(b.prevFacing, b.facing, alpha);
    let y = this.targetPose(b, time);

    const k = damp(BOSS_LOOK.poseDamp, dt);
    const c = this.cur;
    c.armsYaw = lerp(c.armsYaw, pose.armsYaw, k);
    c.armsPitch = lerp(c.armsPitch, pose.armsPitch, k);
    c.lean = lerp(c.lean, pose.lean, k);
    c.drop = lerp(c.drop, pose.drop, k);

    if (b.state === 'stunned') this.body.rotation.z = Math.sin(time * 7) * 0.12;
    else this.body.rotation.z = 0;
    y += c.drop;
    this.body.position.y = y;
    this.torso.rotation.x = c.lean;
    this.arms.rotation.set(c.armsPitch, c.armsYaw, 0, 'YXZ');
    this.chain.rotation.z = b.attack?.id === 'hook' && b.state === 'windup' ? time * 18 : 0;

    // Fuego azul según la fase; el destello del golpe aclara la piel.
    const glow = BOSS_LOOK.fireGlow[b.phase - 1] ?? 1;
    const dying = b.state === 'dying' ? Math.max(0, 1 - b.fsm.t / BOSS.death.duration) : 1;
    this.fire.emissiveIntensity = glow * dying * (b.state === 'transition' ? 1.6 : 1);
    this.fire.emissive.copy(this.fireColor);
    this.skin.emissive.setScalar(b.flash * BOSS_LOOK.flashGlow);
  }

  /** Arma `pose` según el estado y devuelve la altura base del cuerpo. */
  private targetPose(b: BossSim, time: number): number {
    pose.armsYaw = 0;
    pose.armsPitch = 0.3;
    pose.lean = 0;
    pose.drop = 0;
    const t = b.fsm.t;
    const id = b.attack?.id;
    const strike = b.strike;
    switch (b.state) {
      case 'emerge': {
        const u = ease(Math.min(1, t / BOSS.emergeDuration));
        pose.armsPitch = -0.6;
        return -BOSS_LOOK.sinkDepth * (1 - u);
      }
      case 'idle':
        pose.armsPitch = 0.3 + Math.sin(time * 1.6) * 0.05;
        return 0;
      case 'windup': {
        const u = strike ? Math.min(1, t / effectiveWindup(strike, b.phase)) : 1;
        const side = b.strikeIndex % 2 === 0 ? 1 : -1;
        if (id === 'hammer') {
          pose.armsPitch = lerp(0.3, -2.4, ease(u));
          pose.lean = -0.15 * u;
        } else if (id === 'charge') {
          pose.armsPitch = 0.9;
          pose.lean = 0.45 * u;
          pose.drop = -0.5 * u;
        } else if (id === 'summon') {
          pose.armsPitch = -1.8 * u;
          pose.lean = -0.25 * u;
        } else if (id === 'hook') {
          pose.armsYaw = 0.8 * u;
          pose.armsPitch = -0.4;
        } else {
          // Tajo y furia: la hacha va hacia atrás del lado del golpe.
          pose.armsYaw = side * lerp(0, 1.9, ease(u));
          pose.armsPitch = 0.1;
          pose.lean = -0.1 * u;
        }
        return 0;
      }
      case 'active': {
        const side = b.strikeIndex % 2 === 0 ? 1 : -1;
        if (id === 'hammer') {
          pose.armsPitch = 1.25;
          pose.lean = 0.45;
          pose.drop = -0.4;
        } else if (id === 'charge') {
          pose.armsPitch = 0.9;
          pose.lean = 0.55;
        } else if (id === 'summon') {
          pose.armsPitch = 1;
          pose.lean = 0.3;
        } else if (id === 'hook') {
          pose.armsYaw = -0.5;
          pose.armsPitch = 0.2;
        } else {
          pose.armsYaw = -side * 1.7;
          pose.armsPitch = 0.4;
          pose.lean = 0.2;
        }
        return 0;
      }
      case 'recover':
        pose.armsPitch = 0.7;
        pose.lean = 0.15;
        return 0;
      case 'broken':
        pose.armsPitch = 1.3;
        pose.lean = 0.5;
        pose.drop = -BOSS_LOOK.kneelDrop;
        return 0;
      case 'stunned':
        pose.armsPitch = 1;
        pose.lean = 0.3;
        return 0;
      case 'transition':
        pose.armsYaw = 0;
        pose.armsPitch = -1.4;
        pose.lean = -0.35;
        return 0;
      case 'leap':
        pose.drop = -0.9;
        pose.lean = 0.4;
        pose.armsPitch = 1;
        return 0;
      case 'airborne': {
        const u = Math.min(1, t / BOSS.judgment.airborne);
        pose.armsPitch = -2;
        return Math.sin(u * Math.PI) * BOSS_LOOK.leapHeight;
      }
      case 'landing':
        pose.drop = -0.7 * Math.max(0, 1 - t / BOSS.judgment.recover);
        pose.armsPitch = 1.2;
        pose.lean = 0.4;
        return 0;
      case 'dying': {
        const u = Math.min(1, t / BOSS.death.duration);
        pose.armsPitch = 1.5;
        pose.lean = 0.7;
        return -BOSS_LOOK.sinkDepth * u * u;
      }
      default:
        return 0;
    }
  }
}
