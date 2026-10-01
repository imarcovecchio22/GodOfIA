import type { Object3D, Scene, Vector3 } from 'three';
import { ENEMY, type EnemyKind } from '../data/enemies';
import { ANIMATION, ENEMY_MODELS } from '../data/models';
import { clamp, lerpAngle } from '../core/math';
import type { EnemySim } from '../entities/Enemy';
import { Animator } from './Animator';
import { instantiate, type CharacterInstance, type CharacterTemplate } from './characters';
import { warpTime } from './timeWarp';

/** Draugr o bruto animado. Cada instancia tiene sus materiales para el destello y los ojos. */
class EnemyView {
  readonly root: Object3D;
  private readonly inst: CharacterInstance;
  private readonly animator: Animator;
  private lastState = '';
  private lastT = 0;

  constructor(
    readonly kind: EnemyKind,
    template: CharacterTemplate,
  ) {
    const model = ENEMY_MODELS[kind];
    this.inst = instantiate(template, { tint: model.tint, eyesNode: model.eyesNode });
    this.root = this.inst.root;
    this.animator = new Animator(this.root, template.clips);
  }

  /** Vuelve a un estado neutro al reutilizarse desde el pool. */
  reset(e: EnemySim): void {
    this.lastState = '';
    this.animator.stop(0);
    this.root.scale.setScalar(ENEMY_MODELS[this.kind].scale * e.arch.scale);
    this.inst.body.emissive.setRGB(0, 0, 0);
  }

  update(e: EnemySim, alpha: number, dt: number, player: Vector3): void {
    const model = ENEMY_MODELS[this.kind];
    const st = e.state;
    const t = e.fsm.t;

    // Brillo: azul congelado, pulso rojo al cargar, blanco al recibir un golpe.
    let er = 0;
    let eg = 0;
    let eb = 0;
    if (st === 'frozen') {
      er = 0.12;
      eg = 0.42;
      eb = 0.6;
    } else if (st === 'windup') {
      const p = 0.25 + 0.25 * Math.sin(t * 30);
      er = p * 1.3;
      eg = p * 0.4;
    }
    if (e.flash > 0) {
      er = Math.max(er, e.flash);
      eg = Math.max(eg, e.flash);
      eb = Math.max(eb, e.flash);
    }
    this.inst.body.emissive.setRGB(er, eg, eb);
    this.inst.eyes?.color.setHex(
      st === 'dead'
        ? model.eyeDead
        : st === 'windup' || st === 'attack'
          ? model.eyeAttack
          : st === 'frozen'
            ? model.eyeFrozen
            : model.eyeIdle,
    );

    const x = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
    const z = e.prevPos.z + (e.pos.z - e.prevPos.z) * alpha;
    const sink = st === 'dead' ? Math.max(0, t - ENEMY.deathSinkDelay) * ENEMY.deathSinkSpeed : 0;
    this.root.position.set(x, -sink, z);
    this.root.rotation.y = lerpAngle(e.prevFacing, e.facing, alpha);

    const near = Math.hypot(x - player.x, z - player.z) < ANIMATION.shadowDistance;
    this.inst.bodyMesh.castShadow = near;

    this.animate(e, dt);
  }

  private animate(e: EnemySim, dt: number): void {
    const model = ENEMY_MODELS[this.kind];
    const a = this.animator;
    const st = e.state;
    const t = e.fsm.t;
    const restart = st !== this.lastState || t < this.lastT;
    this.lastState = st;
    this.lastT = t;

    const L = model.locomotion;
    const moving = e.moving > 0 && st === 'chase';
    a.setBase(L.idle, moving ? 0 : 1, 1, model.locomotionFade);
    a.setBase(
      L.walk,
      moving ? 1 : 0,
      clamp(e.speed / L.walkClipSpeed, 0.5, L.maxTimeScale),
      model.locomotionFade,
    );

    const arch = e.arch;
    switch (st) {
      case 'spawn': {
        const time = (t / ENEMY.spawnDuration) * model.spawnEnd;
        a.drive(model.spawn, time, { fade: 0 });
        break;
      }
      case 'windup':
      case 'attack':
      case 'recover': {
        // Carga, golpe y recuperación son un solo clip; el contacto cae en la ventana de daño.
        const seq =
          st === 'windup'
            ? t
            : st === 'attack'
              ? arch.windup + t
              : arch.windup + ENEMY.attackDuration + t;
        const time = warpTime(
          seq,
          arch.windup + ANIMATION.enemyContactDelay,
          arch.windup + ENEMY.attackDuration + arch.recover,
          model.attack.contact,
          a.duration(model.attack.clip),
        );
        a.drive(model.attack.clip, time, {
          fade: model.actionFade,
          restart: st === 'windup' && restart,
        });
        break;
      }
      case 'stagger':
        a.play(model.hit, {
          fade: model.actionFade,
          timeScale: model.hitTimeScale,
          restart,
        });
        break;
      case 'dead':
        a.play(model.death, { fade: model.actionFade });
        break;
      case 'frozen':
        // Congelado: la pose queda quieta (no avanza el mixer).
        a.update(0);
        return;
      default:
        a.stop(model.locomotionFade);
    }
    a.update(dt);
  }
}

/** Asigna una vista del pool a cada enemigo activo de la simulación. */
export class EnemyViews {
  private readonly free: Record<EnemyKind, EnemyView[]> = { draugr: [], brute: [] };
  private readonly bound = new Map<EnemySim, EnemyView>();

  constructor(
    private readonly scene: Scene,
    private readonly templates: Record<EnemyKind, CharacterTemplate>,
  ) {}

  acquire(e: EnemySim): void {
    const kind = e.arch.kind;
    const view = this.free[kind].pop() ?? new EnemyView(kind, this.templates[kind]);
    view.reset(e);
    view.root.visible = true;
    this.scene.add(view.root);
    this.bound.set(e, view);
  }

  release(e: EnemySim): void {
    const view = this.bound.get(e);
    if (!view) return;
    this.bound.delete(e);
    view.root.visible = false;
    this.scene.remove(view.root);
    this.free[view.kind].push(view);
  }

  update(alpha: number, dt: number, player: Vector3): void {
    for (const [e, view] of this.bound) view.update(e, alpha, dt, player);
  }
}
