import { Vector3 } from 'three';
import { Fsm, type StateTable } from '../ai/Fsm';
import { resolvePlayerAttack } from '../combat/HitSystem';
import { HEAVY, LIGHT_COMBO, THROW, type AttackDef } from '../data/attacks';
import { PHYSICS } from '../data/physics';
import { PLAYER } from '../data/player';
import { damp, lerpAngle } from '../core/math';
import type { EnemySim } from './Enemy';
import type { CharacterBody } from '../game/collision';
import type { World } from '../game/World';

export type PlayerState =
  'idle' | 'move' | 'attack' | 'heavy' | 'throw' | 'dodge' | 'hurt' | 'dead';

/** Intención del jugador en un paso de simulación. Los "pressed" valen solo para ese paso. */
export interface PlayerInput {
  /** Derecha − izquierda (D − A). */
  moveX: number;
  /** Adelante − atrás (W − S). */
  moveZ: number;
  sprint: boolean;
  attack: boolean;
  heavy: boolean;
  /** Q: lanza el hacha si está en la mano, si no la llama. */
  axe: boolean;
  /** E: llama al hacha. */
  recall: boolean;
  dodge: boolean;
}

export const NO_INPUT: Readonly<PlayerInput> = {
  moveX: 0,
  moveZ: 0,
  sprint: false,
  attack: false,
  heavy: false,
  axe: false,
  recall: false,
  dodge: false,
};

const target = new Vector3();

const STATES: StateTable<PlayerState, PlayerSim> = {
  idle: { update: (p, dt) => p.locomotion(dt) },
  move: { update: (p, dt) => p.locomotion(dt) },
  attack: { update: (p, dt) => p.updateAction(dt) },
  heavy: { update: (p, dt) => p.updateAction(dt) },
  throw: { update: (p, dt) => p.updateAction(dt) },
  dodge: { update: (p, dt) => p.updateDodge(dt) },
  hurt: { update: (p) => (p.fsm.t > PLAYER.hurtDuration ? 'idle' : undefined) },
  dead: {},
};

export class PlayerSim {
  readonly fsm = new Fsm<PlayerState, PlayerSim>(STATES, 'idle');

  readonly pos = new Vector3();
  readonly prevPos = new Vector3();
  readonly vel = new Vector3();
  readonly kb = new Vector3();
  readonly moveIn = new Vector3();
  readonly dodgeDir = new Vector3();
  /**
   * Posición de la mano derecha en el mundo. La escribe la vista en cada frame (depende de la
   * pose animada); el hacha sale y vuelve a este punto, igual que en el prototipo.
   */
  readonly handPos = new Vector3();

  facing = 0;
  prevFacing = 0;
  hp = 0;
  invuln = 0;
  dodgeCooldown = 0;
  /** Fase de la animación de caminata. */
  walk = 0;
  deathTimer = 0;
  private sprinting = false;

  /** Índice del golpe actual del combo liviano. */
  combo = 0;
  queued = false;
  heavyQueued = false;
  /** Ataque cuerpo a cuerpo en curso (null durante el lanzamiento). */
  attack: AttackDef | null = null;
  readonly hitSet = new Set<EnemySim>();
  hitAny = false;
  swung = false;
  impacted = false;
  released = false;

  private readonly body: CharacterBody;

  constructor(private readonly world: World) {
    this.body = world.collision.createCharacter(PLAYER.radius, PHYSICS.characterHeight);
    this.reset();
  }

  get state(): PlayerState {
    return this.fsm.state;
  }

  get maxHp(): number {
    return PLAYER.maxHp;
  }

  get alive(): boolean {
    return !this.fsm.is('dead');
  }

  /** Puede iniciar una acción nueva. */
  get free(): boolean {
    return this.fsm.is('idle') || this.fsm.is('move');
  }

  /** Ventana activa y duración de la acción en curso. */
  get actionTiming(): { active: readonly [number, number]; total: number } {
    return this.fsm.is('throw') ? THROW : (this.attack ?? HEAVY);
  }

  /** Después de la ventana activa de un ataque o lanzamiento: se puede cancelar con el esquive. */
  get inRecovery(): boolean {
    const s = this.fsm.state;
    return (
      (s === 'attack' || s === 'heavy' || s === 'throw') && this.fsm.t > this.actionTiming.active[1]
    );
  }

  reset(): void {
    this.fsm.reset('idle');
    this.pos.set(PLAYER.spawnX, 0, PLAYER.spawnZ);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.kb.set(0, 0, 0);
    this.moveIn.set(0, 0, 0);
    this.facing = this.prevFacing = PLAYER.spawnFacing;
    this.hp = PLAYER.maxHp;
    this.invuln = 0;
    this.dodgeCooldown = 0;
    this.deathTimer = 0;
    this.combo = 0;
    this.queued = this.heavyQueued = false;
    this.attack = null;
    this.handPos.set(this.pos.x, 1.3, this.pos.z);
  }

  snapshot(): void {
    this.prevPos.copy(this.pos);
    this.prevFacing = this.facing;
  }

  step(dt: number, input: PlayerInput): void {
    this.computeMoveInput(input);
    if (this.alive) this.handleInput(input);

    this.invuln = Math.max(0, this.invuln - dt);
    this.dodgeCooldown -= dt;
    this.sprinting = input.sprint;
    this.fsm.update(this, dt);

    this.pos.addScaledVector(this.kb, dt);
    this.kb.multiplyScalar(Math.pow(PLAYER.knockbackDecay, dt));
    // Todo el desplazamiento del paso (caminar, lunge, rodada, empuje) pasa por el controller.
    this.world.collision.moveCharacter(this.body, this.prevPos, this.pos);
  }

  private computeMoveInput(input: PlayerInput): void {
    const yaw = this.world.camYaw;
    // Frente y derecha de la cámara sobre el plano.
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    this.moveIn.set(fx * input.moveZ + rx * input.moveX, 0, fz * input.moveZ + rz * input.moveX);
    if (this.moveIn.lengthSq() > 0) this.moveIn.normalize();
    if (!this.alive) this.moveIn.set(0, 0, 0);
  }

  /** Las pulsaciones se procesan antes de avanzar el tiempo, como los eventos del prototipo. */
  private handleInput(input: PlayerInput): void {
    if (input.attack) {
      if (this.free) this.startAttack(0);
      else if (this.fsm.is('attack') && this.fsm.t > PLAYER.comboInputMinTime) this.queued = true;
    }
    if (input.heavy) {
      if (this.free) this.startHeavy();
      else if (this.fsm.is('attack')) this.heavyQueued = true;
    }
    if (input.dodge) this.startDodge();
    if (input.axe) {
      if (this.world.axe.inHand) {
        if (this.free) this.startThrow();
      } else {
        this.world.axe.recall();
      }
    }
    if (input.recall) this.world.axe.recall();
  }

  /** Orientación hacia donde mira la cámara. */
  private get aimFacing(): number {
    const yaw = this.world.camYaw;
    return Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
  }

  startAttack(index: number): void {
    const def = LIGHT_COMBO[index];
    if (!def) return;
    this.beginAction('attack', def);
    this.combo = index;
  }

  startHeavy(): void {
    this.beginAction('heavy', HEAVY);
  }

  startThrow(): void {
    this.fsm.go('throw', this);
    this.attack = null;
    this.released = false;
  }

  private beginAction(state: 'attack' | 'heavy', def: AttackDef): void {
    this.fsm.go(state, this);
    this.attack = def;
    this.queued = false;
    this.heavyQueued = false;
    this.hitSet.clear();
    this.hitAny = false;
    this.swung = false;
    this.impacted = false;
  }

  startDodge(): void {
    if (this.dodgeCooldown > 0) return;
    const canCancel = this.inRecovery || (this.fsm.is('throw') && this.released);
    if (!this.free && !canCancel) return;
    if (this.moveIn.lengthSq() > 0) this.dodgeDir.copy(this.moveIn);
    // Sin dirección, rueda hacia atrás.
    else this.dodgeDir.set(-Math.sin(this.facing), 0, -Math.cos(this.facing));
    this.fsm.go('dodge', this);
    this.facing = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
    this.dodgeCooldown = PLAYER.dodge.cooldown;
    this.world.events.emit('player:dodge', { x: this.pos.x, y: 0.1, z: this.pos.z });
  }

  locomotion(dt: number): PlayerState {
    const speed = this.sprinting ? PLAYER.runSpeed : PLAYER.walkSpeed;
    target.copy(this.moveIn).multiplyScalar(speed);
    this.vel.lerp(target, damp(PLAYER.accelDamp, dt));
    if (this.moveIn.lengthSq() > 0) {
      this.facing = lerpAngle(
        this.facing,
        Math.atan2(this.moveIn.x, this.moveIn.z),
        damp(PLAYER.turnDamp, dt),
      );
    }
    this.pos.addScaledVector(this.vel, dt);
    this.walk += dt * this.vel.length() * PLAYER.walkCycle;
    return this.vel.lengthSq() > 0.3 ? 'move' : 'idle';
  }

  /** Ataque liviano, pesado o lanzamiento. */
  updateAction(dt: number): PlayerState | undefined {
    const t = this.fsm.t;
    const { active, total } = this.actionTiming;
    const turn = t < active[0] ? PLAYER.attackTurnDampWindup : PLAYER.attackTurnDampActive;
    this.facing = lerpAngle(this.facing, this.aimFacing, damp(turn, dt));
    this.vel.multiplyScalar(Math.pow(PLAYER.attackVelDecay, dt));
    this.pos.addScaledVector(this.vel, dt);

    const def = this.attack;
    if (def && t >= active[0] && t < active[1] && def.lunge) {
      this.pos.x += Math.sin(this.facing) * def.lunge * dt;
      this.pos.z += Math.cos(this.facing) * def.lunge * dt;
    }

    if (this.fsm.is('throw')) {
      if (!this.released && t >= THROW.releaseAt) {
        this.released = true;
        this.world.axe.throwFrom(this.handPos, this.world.aimOrigin, this.world.aimDir);
      }
    } else if (def) {
      if (t >= active[0] && !this.swung) {
        this.swung = true;
        this.world.events.emit('player:swing', { heavy: def.heavy });
      }
      if (def.impact) {
        if (!this.impacted && t >= def.impact.at) {
          this.impacted = true;
          const x =
            this.pos.x +
            Math.sin(this.facing) * (def.shape.kind === 'circle' ? def.shape.offset : 0);
          const z =
            this.pos.z +
            Math.cos(this.facing) * (def.shape.kind === 'circle' ? def.shape.offset : 0);
          this.world.events.emit('player:slam', { x, z, armed: this.world.axe.inHand });
          this.world.feedback.shake(def.impact.shake);
          resolvePlayerAttack(this.world, def);
        }
      } else if (t >= active[0] && t <= active[1]) {
        resolvePlayerAttack(this.world, def);
      }
    }

    if (this.fsm.is('attack') && t >= active[1] + PLAYER.comboChainDelay) {
      if (this.queued && this.combo < LIGHT_COMBO.length - 1) {
        this.startAttack(this.combo + 1);
        return undefined;
      }
      if (this.heavyQueued) {
        this.startHeavy();
        return undefined;
      }
    }

    if (t >= total) {
      this.combo = 0;
      return 'idle';
    }
    return undefined;
  }

  updateDodge(dt: number): PlayerState | undefined {
    const { duration, speed, minSpeed, exitSpeed } = PLAYER.dodge;
    const u = this.fsm.t / duration;
    this.pos.addScaledVector(this.dodgeDir, (speed * (1 - u) + minSpeed) * dt);
    if (this.fsm.t >= duration) {
      this.vel.copy(this.dodgeDir).multiplyScalar(exitSpeed);
      return 'idle';
    }
    return undefined;
  }

  /** Recibe un golpe. `big` = empuje y temblor fuertes (brutos). */
  hurt(damage: number, dir: Vector3, big: boolean): void {
    if (!this.alive || this.fsm.is('dodge') || this.invuln > 0) return;
    this.hp -= damage;
    this.invuln = PLAYER.invulnAfterHit;
    this.kb.addScaledVector(dir, big ? PLAYER.hurtKnockbackBig : PLAYER.hurtKnockback);
    this.queued = false;
    this.heavyQueued = false;
    this.fsm.go('hurt', this);
    this.world.feedback.shake(big ? PLAYER.hurtShakeBig : PLAYER.hurtShake);
    this.world.feedback.hitStop(PLAYER.hurtHitStop);
    this.world.stats.resetCombo();
    this.world.events.emit('player:hurt', { x: this.pos.x, y: 1.3, z: this.pos.z, big });
    if (this.hp <= 0) {
      this.hp = 0;
      this.fsm.go('dead', this);
      this.deathTimer = PLAYER.deathDelay;
      this.world.events.emit('player:died', undefined);
    }
  }

  heal(amount: number): void {
    this.hp = Math.min(PLAYER.maxHp, this.hp + amount);
  }
}
