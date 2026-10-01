import { Vector3 } from 'three';
import { Fsm, type StateTable } from '../ai/Fsm';
import { damageEnemy } from '../combat/damage';
import { ARENA } from '../data/arena';
import { AXE } from '../data/axe';
import { clamp } from '../core/math';
import type { EnemySim } from './Enemy';
import type { World } from '../game/World';

export type AxeState = 'hand' | 'flying' | 'stuck' | 'ground' | 'recall';

const ZERO = new Vector3();
const aimPoint = new Vector3();
const flatDir = new Vector3();
const delta = new Vector3();

const STATES: StateTable<AxeState, AxeSim> = {
  hand: {},
  flying: { update: (a, dt) => a.updateFlying(dt) },
  stuck: { update: (a) => a.updateStuck() },
  ground: {},
  recall: { update: (a, dt) => a.updateRecall(dt) },
};

/**
 * Hacha arrojadiza. Estados: en la mano, volando, clavada en un enemigo, en el piso/escenario
 * y volviendo. En la mano su posición la define la vista (hueso de la mano).
 */
export class AxeSim {
  readonly fsm = new Fsm<AxeState, AxeSim>(STATES, 'hand');

  readonly pos = new Vector3();
  readonly prevPos = new Vector3();
  readonly vel = new Vector3();
  /** Rotación X (giro) y Y (rumbo) del hacha fuera de la mano. */
  spin = 0;
  prevSpin = 0;
  yaw = 0;

  stuckTo: EnemySim | null = null;
  private readonly stuckOffset = new Vector3();
  private readonly p0 = new Vector3();
  private readonly p1 = new Vector3();
  private readonly prev = new Vector3();
  private recallDuration = 0;
  private readonly recallHits = new Set<EnemySim>();

  constructor(private readonly world: World) {}

  get state(): AxeState {
    return this.fsm.state;
  }

  get inHand(): boolean {
    return this.fsm.is('hand');
  }

  reset(): void {
    this.fsm.reset('hand');
    this.stuckTo = null;
    this.spin = this.prevSpin = 0;
  }

  snapshot(): void {
    this.prevPos.copy(this.pos);
    this.prevSpin = this.spin;
  }

  /** Sale de la mano hacia el punto a `aimDistance` sobre el rayo de la cámara. */
  throwFrom(hand: Vector3, aimOrigin: Vector3, aimDir: Vector3): void {
    this.pos.copy(hand);
    this.prevPos.copy(hand);
    aimPoint.copy(aimOrigin).addScaledVector(aimDir, AXE.aimDistance);
    this.vel.copy(aimPoint).sub(hand).normalize().multiplyScalar(AXE.throwSpeed);
    this.spin = this.prevSpin = 0;
    this.yaw = Math.atan2(this.vel.x, this.vel.z);
    this.fsm.go('flying', this);
    this.world.events.emit('axe:thrown', undefined);
  }

  recall(): void {
    if (this.inHand || this.fsm.is('recall') || !this.world.player.alive) return;
    const e = this.stuckTo;
    if (e?.fsm.is('frozen')) {
      // Llamarla desde un enemigo congelado lo libera aturdido y le hace un poco de daño.
      e.fsm.go('stagger', e);
      damageEnemy(this.world, e, AXE.unfreezeDamage, ZERO, 0);
    }
    this.stuckTo = null;
    this.recallHits.clear();
    this.p0.copy(this.pos);
    this.prev.copy(this.pos);

    const hand = this.world.player.handPos;
    const dist = this.p0.distanceTo(hand);
    this.recallDuration = clamp(
      dist / AXE.recallSpeed,
      AXE.recallMinDuration,
      AXE.recallMaxDuration,
    );
    // Punto de control de la Bézier: al costado del camino y por encima.
    const dx = hand.x - this.p0.x;
    const dz = hand.z - this.p0.z;
    const l = Math.hypot(dx, dz) || 1;
    this.p1.copy(this.p0).lerp(hand, 0.5);
    this.p1.x += (dz / l) * dist * AXE.recallCurveSide;
    this.p1.z += (-dx / l) * dist * AXE.recallCurveSide;
    this.p1.y += AXE.recallCurveLift + dist * AXE.recallCurveLiftPerUnit;

    this.fsm.go('recall', this);
    this.world.events.emit('axe:recalled', undefined);
  }

  /** Si el enemigo donde está clavada muere, el hacha cae al piso. */
  onEnemyKilled(e: EnemySim): void {
    if (this.stuckTo === e) this.drop();
  }

  updateFlying(dt: number): AxeState | undefined {
    const w = this.world;
    this.vel.y -= AXE.gravity * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.spin -= dt * AXE.flightSpin;
    const p = this.pos;

    for (const e of w.enemies.active) {
      if (!e.canBeHit) continue;
      const s = e.arch.scale;
      const near = Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < e.arch.radius + AXE.flightHitRadius;
      if (!near || p.y >= AXE.flightHitHeight * s || p.y <= 0) continue;

      flatDir.copy(this.vel).setY(0).normalize();
      damageEnemy(w, e, AXE.flightDamage, flatDir, AXE.flightKnockback, { x: p.x, y: p.y, z: p.z });
      w.feedback.hitStop(AXE.flightHitStop);
      w.feedback.shake(AXE.flightShake);
      w.events.emit('axe:hit', undefined);
      if (e.alive) {
        e.freeze();
        this.stuckTo = e;
        this.stuckOffset.copy(p).sub(e.pos);
        w.events.emit('enemy:frozen', { x: p.x, y: p.y, z: p.z });
        return 'stuck';
      }
      this.drop();
      return undefined;
    }

    // Raycast del tramo recorrido en este paso: se clava justo en la superficie.
    const hit = w.collision.castSolid(this.prevPos, p);
    if (hit >= 0) {
      p.lerpVectors(this.prevPos, p, hit);
      return this.embed('obstacle');
    }
    if (p.y <= AXE.floorHeight) {
      p.y = AXE.floorHeight;
      this.spin = this.prevSpin = AXE.floorTilt;
      return this.embed('floor');
    }
    const r = Math.hypot(p.x, p.z);
    const maxR = ARENA.radius + AXE.edgeMargin;
    if (r > maxR || this.fsm.t > AXE.maxFlightTime) {
      if (r > maxR) {
        p.x *= maxR / r;
        p.z *= maxR / r;
      }
      p.y = Math.max(p.y, AXE.edgeMinY);
      return this.embed('edge');
    }
    return undefined;
  }

  updateStuck(): AxeState | undefined {
    const e = this.stuckTo;
    if (!e?.alive) {
      this.drop();
      return undefined;
    }
    this.pos.copy(e.pos).add(this.stuckOffset);
    return undefined;
  }

  updateRecall(dt: number): AxeState | undefined {
    const w = this.world;
    const u = Math.min(this.fsm.t / this.recallDuration, 1);
    const k = u * u;
    const hand = w.player.handPos;
    const a = (1 - k) * (1 - k);
    const b = 2 * (1 - k) * k;
    const c = k * k;
    this.prev.copy(this.pos);
    this.pos.set(
      a * this.p0.x + b * this.p1.x + c * hand.x,
      a * this.p0.y + b * this.p1.y + c * hand.y,
      a * this.p0.z + b * this.p1.z + c * hand.z,
    );
    delta.copy(this.pos).sub(this.prev);
    if (delta.lengthSq() > 1e-6) this.yaw = Math.atan2(delta.x, delta.z);
    this.spin -= dt * AXE.recallSpin;

    const p = this.pos;
    for (const e of w.enemies.active) {
      if (!e.canBeHit || this.recallHits.has(e)) continue;
      const near = Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < e.arch.radius + AXE.recallHitRadius;
      if (!near || p.y >= AXE.recallHitHeight * e.arch.scale) continue;
      this.recallHits.add(e);
      flatDir.copy(delta).setY(0).normalize();
      damageEnemy(w, e, AXE.recallDamage, flatDir, AXE.recallKnockback, { x: p.x, y: p.y, z: p.z });
      w.feedback.shake(AXE.recallShake);
      w.events.emit('axe:hit', undefined);
    }

    if (u >= 1) {
      w.feedback.hitStop(AXE.catchHitStop);
      w.feedback.shake(AXE.catchShake);
      w.events.emit('axe:caught', { x: hand.x, y: hand.y, z: hand.z });
      return 'hand';
    }
    return undefined;
  }

  private embed(surface: 'floor' | 'obstacle' | 'edge'): AxeState {
    this.stuckTo = null;
    this.world.events.emit('axe:embedded', {
      x: this.pos.x,
      y: this.pos.y,
      z: this.pos.z,
      surface,
    });
    return 'ground';
  }

  /** Cae suelta: queda apoyada a poca altura e inclinada. */
  private drop(): void {
    this.stuckTo = null;
    this.pos.y = clamp(this.pos.y, AXE.dropMinY, AXE.dropMaxY);
    this.spin = this.prevSpin = AXE.dropTilt;
    this.fsm.go('ground', this);
  }
}
