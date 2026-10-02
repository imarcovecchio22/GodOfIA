import {
  Color,
  Group,
  MeshStandardMaterial,
  TorusGeometry,
  type Object3D,
  type Scene,
  type Vector3,
} from 'three';
import { clamp, lerpAngle } from '../core/math';
import { BOSS } from '../data/boss';
import { BOSS_LOOK } from '../data/bossView';
import { ANIMATION, BOSS_MODEL, type ClipRef } from '../data/models';
import { effectiveRecover, effectiveWindup, type BossSim } from '../entities/Boss';
import { Animator } from './Animator';
import { instantiate, type CharacterInstance, type CharacterTemplate } from './characters';
import { box, cyl, mat, mesh, sph } from './primitives';
import { bossImpactTime, warpTime } from './timeWarp';

/**
 * El Jarl Ahogado: el guerrero esqueleto de KayKit escalado, con corona de hierro oxidado, barba de
 * algas y hielo, fuego azul en ojos y pecho y una cadena de ancla en el brazo (piezas propias
 * colgadas de los huesos). Los clips se manejan desde el estado del jefe: el cuadro de contacto
 * de cada golpe cae en el momento en que la simulación pega.
 */
export class BossView {
  readonly root: Object3D;
  private readonly inst: CharacterInstance;
  private readonly animator: Animator;
  private readonly fire: MeshStandardMaterial;
  private readonly fireColor = new Color(BOSS_LOOK.fire);
  private readonly eyeColor = new Color(BOSS_LOOK.fire);
  private readonly chain = new Group();
  private lastState = '';
  private lastStrike: unknown = null;

  constructor(scene: Scene, template: CharacterTemplate) {
    const M = BOSS_MODEL;
    this.inst = instantiate(template, { tint: M.tint, eyesNode: M.eyesNode });
    this.root = this.inst.root;
    this.root.scale.setScalar(M.scale);
    this.animator = new Animator(this.root, template.clips);
    this.fire = mat(0x000000, { emissive: BOSS_LOOK.fire, emissiveIntensity: 2 });
    this.buildProps();
    this.root.visible = false;
    scene.add(this.root);
  }

  private bone(name: string): Object3D {
    const b = this.root.getObjectByName(name);
    if (!b) throw new Error(`El modelo del jefe no tiene el hueso ${name}`);
    return b;
  }

  private buildProps(): void {
    const L = BOSS_LOOK.props;
    const rust = mat(BOSS_LOOK.rust, { roughness: 0.65, metalness: 0.5 });
    const iron = mat(BOSS_LOOK.iron, { roughness: 0.5, metalness: 0.7 });
    const algae = mat(BOSS_LOOK.algae, { roughness: 0.95 });
    const ice = mat(BOSS_LOOK.ice, { roughness: 0.2, metalness: 0.1 });

    // Corona: aro con puntas, sobre el cráneo.
    const crown = new Group();
    crown.position.set(0, L.crownY, L.crownZ);
    crown.add(cyl(L.crownRadius, L.crownRadius * 1.08, 0.12, rust, 12));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const h = 0.24 + (i % 2) * 0.1;
      const spike = box(0.08, h, 0.06, rust);
      spike.position.set(Math.sin(a) * L.crownRadius, 0.06 + h / 2, Math.cos(a) * L.crownRadius);
      spike.rotation.y = a;
      crown.add(spike);
    }
    this.bone(BOSS_MODEL.bones.head).add(crown);

    // Barba de algas con carámbanos, colgando de la mandíbula.
    const beard = new Group();
    beard.position.set(0, L.beardY, L.beardZ);
    const strands = cyl(0.2, 0.04, 0.45, algae, 7);
    strands.position.y = -0.22;
    beard.add(strands);
    for (const sx of [-0.12, 0.12]) {
      const icicle = cyl(0.04, 0.005, 0.28, ice, 5);
      icicle.position.set(sx, -0.3, 0.05);
      beard.add(icicle);
    }
    this.bone(BOSS_MODEL.bones.head).add(beard);

    // Fuego azul en el pecho, entre las costillas.
    const heart = sph(L.heartRadius, this.fire, 10);
    heart.castShadow = false;
    heart.position.set(0, L.heartY, L.heartZ);
    this.bone(BOSS_MODEL.bones.chest).add(heart);

    // Cadena de ancla enrollada en el antebrazo izquierdo.
    const link = new TorusGeometry(0.09, 0.025, 6, 10);
    for (let i = 0; i < 5; i++) {
      const m = mesh(link, iron);
      m.position.set(i * 0.06, 0, 0);
      m.rotation.set(0, Math.PI / 2, (i % 2) * (Math.PI / 2));
      this.chain.add(m);
    }
    this.chain.position.set(L.chainX, 0, 0);
    this.bone(BOSS_MODEL.bones.chainArm).add(this.chain);
  }

  update(b: BossSim, alpha: number, dt: number, player: Vector3): void {
    const visible = b.state !== 'inactive' && b.state !== 'dead';
    this.root.visible = visible;
    if (!visible) {
      this.lastState = '';
      this.animator.stop(0);
      return;
    }

    const x = b.prevPos.x + (b.pos.x - b.prevPos.x) * alpha;
    const z = b.prevPos.z + (b.pos.z - b.prevPos.z) * alpha;
    this.root.position.set(x, this.heightOf(b), z);
    this.root.rotation.y = lerpAngle(b.prevFacing, b.facing, alpha);
    this.root.rotation.z = b.state === 'stunned' ? Math.sin(b.fsm.t * 7) * 0.05 : 0;
    this.inst.bodyMesh.castShadow =
      Math.hypot(x - player.x, z - player.z) < ANIMATION.shadowDistance * 1.6;

    // Fuego azul según la fase (más fuerte en la transición); destello blanco al recibir golpes.
    const glow = BOSS_LOOK.fireGlow[b.phase - 1] ?? 1;
    const dying = b.state === 'dying' ? Math.max(0, 1 - b.fsm.t / BOSS.death.duration) : 1;
    const k = glow * dying * (b.state === 'transition' ? 1.6 : 1);
    this.fire.emissive.copy(this.fireColor);
    this.fire.emissiveIntensity = k;
    this.inst.eyes?.color.copy(this.eyeColor).multiplyScalar(k);
    this.inst.body.emissive.setScalar(b.flash * BOSS_LOOK.flashGlow);
    this.chain.rotation.x = b.attack?.id === 'hook' && b.state === 'windup' ? b.fsm.t * 20 : 0;

    this.animate(b, dt);
  }

  /** El salto del juicio del lago sale de cuadro; al morir se hunde después de desarmarse. */
  private heightOf(b: BossSim): number {
    const t = b.fsm.t;
    if (b.state === 'airborne') {
      return Math.sin(Math.min(1, t / BOSS.judgment.airborne) * Math.PI) * BOSS_LOOK.leapHeight;
    }
    if (b.state === 'dying') {
      const u = clamp(
        (t - BOSS_LOOK.sinkDelay) / (BOSS.death.duration - BOSS_LOOK.sinkDelay),
        0,
        1,
      );
      return -BOSS_LOOK.sinkDepth * u * u;
    }
    return 0;
  }

  private animate(b: BossSim, dt: number): void {
    const M = BOSS_MODEL;
    const a = this.animator;
    const st = b.state;
    const t = b.fsm.t;
    const entered = st !== this.lastState;
    this.lastState = st;

    const moving = st === 'idle' && b.pos.distanceToSquared(b.prevPos) > 1e-6;
    a.setBase(M.idle, moving ? 0 : 1, 1, M.locomotionFade);
    a.setBase(
      M.walk,
      moving ? 1 : 0,
      clamp(BOSS.moveSpeed / BOSS_MODEL.scale / M.walkClipSpeed, 0.5, 2),
      M.locomotionFade,
    );

    switch (st) {
      case 'emerge':
        a.drive(M.emerge, (t / BOSS.emergeDuration) * M.emergeEnd, { fade: 0 });
        break;
      case 'windup':
      case 'active':
      case 'recover':
        this.animateStrike(b, entered);
        break;
      case 'broken': {
        // Cae de rodillas, se queda y al final se levanta.
        const { clip, contact } = M.kneel;
        const out = BOSS.brokenDuration - M.kneelOut;
        const time =
          t < out
            ? Math.min(1, t / M.kneelIn) * contact
            : contact + ((t - out) / M.kneelOut) * (a.duration(clip) - contact);
        a.drive(clip, time, { fade: M.actionFade });
        break;
      }
      case 'stunned':
        a.drive(M.stunned, (t / BOSS.stunnedDuration) * a.duration(M.stunned), {
          fade: M.actionFade,
        });
        break;
      case 'transition':
        a.drive(M.transition, (t / BOSS.transition.duration) * a.duration(M.transition), {
          fade: M.actionFade,
        });
        break;
      case 'leap':
        a.drive(M.leapStart, (t / BOSS.judgment.crouch) * a.duration(M.leapStart), {
          fade: M.actionFade,
        });
        break;
      case 'airborne':
        a.play(M.leapIdle, { fade: M.actionFade, loop: true });
        break;
      case 'landing':
        a.drive(M.leapLand, Math.min(1, t / M.landDuration) * a.duration(M.leapLand), {
          fade: 0.05,
        });
        if (t > M.landDuration) a.stop(M.locomotionFade);
        break;
      case 'dying':
        a.drive(M.death, Math.min(1, t / BOSS_LOOK.deathClipTime) * a.duration(M.death), {
          fade: M.actionFade,
        });
        break;
      default:
        a.stop(M.locomotionFade);
    }
    a.update(dt);
  }

  /** Carga, golpe y recuperación son un solo clip; el contacto cae donde la simulación pega. */
  private animateStrike(b: BossSim, entered: boolean): void {
    const M = BOSS_MODEL;
    const a = this.animator;
    const strike = b.strike;
    const attack = b.attack;
    if (!strike || !attack) return;
    const st = b.state;
    const t = b.fsm.t;

    // La embestida corre durante la ventana activa.
    if (attack.id === 'charge' && st === 'active') {
      a.play(M.chargeRun, { fade: 0.05, loop: true, timeScale: M.chargeRunTimeScale });
      return;
    }

    // El tajo encadenado del garfio no es un golpe de la lista: usa el clip del tajo.
    const index = attack.strikes.indexOf(strike);
    const ref: ClipRef | undefined = index < 0 ? M.strikes.sweep[0] : M.strikes[attack.id][index];
    if (!ref) return;
    const windup = effectiveWindup(strike, b.phase);
    const recover = effectiveRecover(strike, b.phase);
    const instant = strike.anchor === 'target' || (index >= 0 && attack.special !== undefined);
    const impact = bossImpactTime(windup, strike.active, instant);
    const seq = st === 'windup' ? t : st === 'active' ? windup + t : windup + strike.active + t;
    const total = windup + strike.active + recover;
    const time = warpTime(seq, impact, total, ref.contact, a.duration(ref.clip));
    const restart = st === 'windup' && (entered || strike !== this.lastStrike);
    this.lastStrike = strike;
    a.drive(ref.clip, time, { fade: M.actionFade, restart });
  }
}
