import {
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type MeshStandardMaterial,
  type Scene,
} from 'three';
import { ENEMY, type EnemyKind } from '../data/enemies';
import { lerpAngle } from '../core/math';
import type { EnemySim } from '../entities/Enemy';
import { box, cyl, mat, mesh, sph } from './primitives';

const EYE_IDLE = 0x66e6ff;
const EYE_ATTACK = 0xff3a22;
const EYE_FROZEN = 0xffffff;
const EYE_DEAD = 0x222222;

/** Draugr o bruto de primitivas. Cada instancia tiene sus materiales para el destello. */
class EnemyView {
  readonly g = new Group();
  readonly rig = new Group();
  readonly mats: MeshStandardMaterial[] = [];
  readonly eyeM = new MeshBasicMaterial({ color: EYE_IDLE });
  readonly legL: Group;
  readonly legR: Group;
  readonly armL: Group;
  readonly armR: Group;

  constructor(readonly kind: EnemyKind) {
    const brute = kind === 'brute';
    this.g.add(this.rig);
    const M = (c: number, o: Parameters<typeof mat>[1] = {}): MeshStandardMaterial => {
      const m = mat(c, o);
      this.mats.push(m);
      return m;
    };
    const flesh = M(brute ? 0x56614f : 0x6f7c64, { roughness: 0.95 });
    const rag = M(0x3a3430);
    const rust = M(0x6b4a33, { metalness: 0.5, roughness: 0.6 });

    const body = cyl(0.3, 0.36, 0.9, flesh, 10);
    body.position.y = 1.15;
    const rg = cyl(0.38, 0.43, 0.45, rag, 10);
    rg.position.y = 0.78;
    const hd = sph(0.24, flesh, 12);
    hd.position.y = 1.82;
    const helm = mesh(new SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), rust);
    helm.position.y = 1.86;
    this.rig.add(body, rg, hd, helm);
    if (brute) {
      const hornM = M(0xd9cfb8);
      for (const s of [-1, 1]) {
        const h = mesh(new ConeGeometry(0.07, 0.38, 6), hornM);
        h.position.set(0.26 * s, 2.02, 0);
        h.rotation.z = -0.9 * s;
        this.rig.add(h);
      }
    }
    for (const x of [-0.09, 0.09]) {
      const e = new Mesh(new SphereGeometry(0.045, 6, 4), this.eyeM);
      e.position.set(x, 1.82, 0.21);
      this.rig.add(e);
    }
    const leg = (x: number): Group => {
      const p = new Group();
      p.position.set(x, 0.62, 0);
      const b = box(0.18, 0.62, 0.2, rag);
      b.position.y = -0.31;
      p.add(b);
      this.rig.add(p);
      return p;
    };
    const arm = (x: number): Group => {
      const p = new Group();
      p.position.set(x, 1.5, 0);
      p.rotation.order = 'YXZ';
      const b = box(0.16, 0.66, 0.18, flesh);
      b.position.y = -0.33;
      p.add(b);
      this.rig.add(p);
      return p;
    };
    this.legL = leg(0.15);
    this.legR = leg(-0.15);
    this.armL = arm(0.42);
    this.armR = arm(-0.42);
    if (brute) {
      const club = cyl(0.09, 0.17, 1.0, rust, 7);
      club.position.y = -1.05;
      this.armR.add(club);
    } else {
      const sword = box(0.05, 0.8, 0.12, rust);
      sword.position.set(0, -1.0, 0.02);
      this.armR.add(sword);
    }
    this.g.scale.setScalar(brute ? 1.45 : 1);
  }

  /** Vuelve a la pose neutra al reutilizarse desde el pool. */
  reset(): void {
    this.rig.rotation.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0);
    this.armR.rotation.set(0, 0, 0);
    this.eyeM.color.setHex(EYE_IDLE);
    for (const m of this.mats) m.emissive.setRGB(0, 0, 0);
  }

  update(e: EnemySim, alpha: number): void {
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
    for (const m of this.mats) m.emissive.setRGB(er, eg, eb);

    const x = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
    const z = e.prevPos.z + (e.pos.z - e.prevPos.z) * alpha;
    const facing = lerpAngle(e.prevFacing, e.facing, alpha);

    if (st === 'dead') {
      this.eyeM.color.setHex(EYE_DEAD);
      this.rig.rotation.x = -Math.min(t * 4, 1) * 1.45;
      const sink = Math.max(0, t - ENEMY.deathSinkDelay) * ENEMY.deathSinkSpeed;
      this.g.position.set(x, -sink, z);
      return;
    }
    if (st === 'spawn') {
      const u = Math.min(t / ENEMY.spawnDuration, 1);
      this.g.position.set(x, -ENEMY.spawnDepth * (1 - u) * (1 - u), z);
      this.g.rotation.y = facing;
      return;
    }

    if (st !== 'frozen') {
      const mv = e.moving;
      const sw = Math.sin(e.walk) * 0.6 * mv;
      this.legL.rotation.x = sw;
      this.legR.rotation.x = -sw;
      let rx = -1.3 + Math.sin(e.walk * 0.5) * 0.15;
      let lx = -1.2 - Math.sin(e.walk * 0.5) * 0.15;
      let lean = 0.12 * mv;
      if (st === 'windup') {
        const u = Math.min(t / e.arch.windup, 1);
        rx = -1.3 - 1.5 * u;
        lean = -0.25 * u;
      } else if (st === 'attack') {
        const u = Math.min(t / 0.14, 1);
        rx = -2.8 + 3.4 * u;
        lean = 0.35 * u;
      } else if (st === 'recover') {
        rx = 0.6 - 1.9 * Math.min(t / 0.5, 1);
        lean = 0.2;
      } else if (st === 'stagger') {
        lean = -0.4;
        rx = -0.3;
        lx = -0.3;
      }
      this.armR.rotation.x = rx;
      this.armL.rotation.x = lx;
      this.rig.rotation.x = lean;
    }
    this.eyeM.color.setHex(
      st === 'windup' || st === 'attack' ? EYE_ATTACK : st === 'frozen' ? EYE_FROZEN : EYE_IDLE,
    );
    this.g.position.set(x, 0, z);
    this.g.rotation.y = facing;
  }
}

/** Asigna una vista del pool a cada enemigo activo de la simulación. */
export class EnemyViews {
  private readonly free: Record<EnemyKind, EnemyView[]> = { draugr: [], brute: [] };
  private readonly bound = new Map<EnemySim, EnemyView>();

  constructor(private readonly scene: Scene) {}

  acquire(e: EnemySim): void {
    const view = this.free[e.arch.kind].pop() ?? new EnemyView(e.arch.kind);
    view.reset();
    view.g.visible = true;
    this.scene.add(view.g);
    this.bound.set(e, view);
    view.update(e, 1);
  }

  release(e: EnemySim): void {
    const view = this.bound.get(e);
    if (!view) return;
    this.bound.delete(e);
    view.g.visible = false;
    this.scene.remove(view.g);
    this.free[view.kind].push(view);
  }

  update(alpha: number): void {
    for (const [e, view] of this.bound) view.update(e, alpha);
  }
}
