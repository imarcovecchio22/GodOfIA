import { Vector3 } from 'three';
import { Fsm, type StateTable } from '../ai/Fsm';
import { ARENA } from '../data/arena';
import { ARCHETYPES, ENEMY, type EnemyArchetype, type EnemyKind } from '../data/enemies';
import { PLAYER } from '../data/player';
import { damp, lerpAngle } from '../core/math';
import type { World } from '../game/World';

export type EnemyState =
  'spawn' | 'chase' | 'windup' | 'attack' | 'recover' | 'stagger' | 'frozen' | 'dead';

const hitDir = new Vector3();

const STATES: StateTable<EnemyState, EnemySim> = {
  spawn: {
    update: (e) => {
      e.facing = e.wantFacing;
      return e.fsm.t >= ENEMY.spawnDuration ? 'chase' : undefined;
    },
  },
  chase: { update: (e, dt) => e.updateChase(dt) },
  windup: {
    update: (e, dt) => {
      e.facing = lerpAngle(e.facing, e.wantFacing, damp(ENEMY.windupTurnDamp, dt));
      return e.fsm.t >= e.arch.windup ? 'attack' : undefined;
    },
  },
  attack: {
    enter: (e) => {
      e.hasHit = false;
      e.lunge.set(Math.sin(e.facing), 0, Math.cos(e.facing)).multiplyScalar(e.arch.attackLunge);
    },
    update: (e, dt) => e.updateAttack(dt),
  },
  recover: {
    update: (e) => {
      if (e.fsm.t <= e.arch.recover) return undefined;
      e.cooldown = e.world.rng.range(ENEMY.cooldownMin, ENEMY.cooldownMax);
      return 'chase';
    },
  },
  stagger: {
    update: (e) => {
      if (e.fsm.t <= ENEMY.staggerDuration) return undefined;
      e.cooldown = Math.max(e.cooldown, ENEMY.staggerMinCooldown);
      return 'chase';
    },
  },
  frozen: { update: (e) => (e.fsm.t > e.freezeTime ? 'chase' : undefined) },
  dead: {
    update: (e) => {
      if (e.fsm.t > ENEMY.deathRemoveAfter) e.world.enemies.remove(e);
      return undefined;
    },
  },
};

export class EnemySim {
  readonly fsm = new Fsm<EnemyState, EnemySim>(STATES, 'spawn');
  arch: EnemyArchetype;
  active = false;

  readonly pos = new Vector3();
  readonly prevPos = new Vector3();
  readonly kb = new Vector3();
  readonly lunge = new Vector3();
  facing = 0;
  prevFacing = 0;
  hp = 0;
  maxHp = 0;
  speed = 0;
  cooldown = 0;
  flash = 0;
  freezeTime = 0;
  hasHit = false;
  /** Fase de la animación de caminata y si se movió en el último paso (0 o 1). */
  walk = 0;
  moving = 0;

  // Relación con el jugador, calculada al inicio de cada paso.
  toPlayerX = 0;
  toPlayerZ = 0;
  distToPlayer = 0;
  wantFacing = 0;

  constructor(
    readonly world: World,
    readonly id: number,
  ) {
    this.arch = ARCHETYPES.draugr;
  }

  get state(): EnemyState {
    return this.fsm.state;
  }

  get alive(): boolean {
    return this.active && !this.fsm.is('dead');
  }

  /** Muertos y los que todavía salen del piso no reciben golpes. */
  get canBeHit(): boolean {
    return this.active && !this.fsm.is('dead') && !this.fsm.is('spawn');
  }

  init(kind: EnemyKind, wave: number, x: number, z: number): void {
    const a = ARCHETYPES[kind];
    const rng = this.world.rng;
    this.arch = a;
    this.active = true;
    this.fsm.reset('spawn');
    this.pos.set(x, 0, z);
    this.prevPos.copy(this.pos);
    this.kb.set(0, 0, 0);
    this.lunge.set(0, 0, 0);
    this.facing = this.prevFacing = 0;
    this.hp = this.maxHp = a.hpBase + wave * a.hpPerWave;
    this.speed = a.speedBase + Math.min(wave * a.speedPerWave, a.speedPerWaveCap);
    this.cooldown = rng.range(ENEMY.initialCooldownMin, ENEMY.initialCooldownMax);
    this.walk = rng.range(0, 6);
    this.moving = 0;
    this.flash = 0;
    this.freezeTime = 0;
    this.hasHit = false;
  }

  snapshot(): void {
    this.prevPos.copy(this.pos);
    this.prevFacing = this.facing;
  }

  freeze(): void {
    this.freezeTime = this.arch.freezeDuration;
    this.fsm.go('frozen', this);
  }

  step(dt: number): void {
    this.flash = Math.max(0, this.flash - dt * ENEMY.flashDecay);
    const p = this.world.player.pos;
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    this.distToPlayer = dist;
    this.toPlayerX = dx / dist;
    this.toPlayerZ = dz / dist;
    this.wantFacing = Math.atan2(dx, dz);
    this.moving = 0;

    const before = this.fsm.state;
    this.fsm.update(this, dt);
    // Los que salen del piso y los muertos no se empujan ni chocan.
    if (before === 'spawn' || before === 'dead' || !this.active) return;

    const frozen = this.fsm.is('frozen');
    if (!frozen) this.pos.addScaledVector(this.kb, dt);
    this.kb.multiplyScalar(Math.pow(ENEMY.knockbackDecay, dt));
    this.world.collision.collide(this.pos, this.arch.radius);
    if (!frozen) this.walk += dt * this.moving * this.speed * ENEMY.walkCycle;
  }

  updateChase(dt: number): EnemyState | undefined {
    const playerAlive = this.world.player.alive;
    this.facing = lerpAngle(this.facing, this.wantFacing, damp(ENEMY.chaseTurnDamp, dt));
    const stop = ENEMY.stopDistance + this.arch.radius * ENEMY.stopRadiusFactor;
    if (playerAlive && this.distToPlayer > stop) {
      this.pos.x += this.toPlayerX * this.speed * dt;
      this.pos.z += this.toPlayerZ * this.speed * dt;
      this.moving = 1;
    }
    this.cooldown -= dt;
    const trigger = ENEMY.attackTriggerDistance + this.arch.radius;
    if (playerAlive && this.distToPlayer < trigger && this.cooldown <= 0) return 'windup';
    return undefined;
  }

  updateAttack(dt: number): EnemyState | undefined {
    this.pos.addScaledVector(this.lunge, dt);
    this.lunge.multiplyScalar(Math.pow(ENEMY.attackLungeDecay, dt));
    const t = this.fsm.t;
    if (!this.hasHit && t > ENEMY.attackHitStart && t < ENEMY.attackHitEnd) {
      const fx = Math.sin(this.facing);
      const fz = Math.cos(this.facing);
      const reach = ENEMY.attackReach + this.arch.radius * ENEMY.attackReachRadiusFactor;
      const facingPlayer = fx * this.toPlayerX + fz * this.toPlayerZ > ENEMY.attackMinDot;
      if (this.distToPlayer < reach && facingPlayer) {
        this.hasHit = true;
        hitDir.set(this.toPlayerX, 0, this.toPlayerZ);
        this.world.player.hurt(this.arch.damage, hitDir, this.arch.heavyHitter);
      }
    }
    return t > ENEMY.attackDuration ? 'recover' : undefined;
  }
}

/** Pool de enemigos. Crece si hace falta y nunca libera memoria durante la partida. */
export class EnemyManager {
  private readonly pool: EnemySim[] = [];
  /** Enemigos activos (vivos, saliendo del piso o en animación de muerte). */
  readonly active: EnemySim[] = [];

  constructor(private readonly world: World) {}

  get aliveCount(): number {
    let n = 0;
    for (const e of this.active) if (!e.fsm.is('dead')) n++;
    return n;
  }

  spawn(kind: EnemyKind, wave: number): EnemySim {
    const { x, z } = this.spawnPoint();
    let e = this.pool.find((p) => !p.active);
    if (!e) {
      e = new EnemySim(this.world, this.pool.length);
      this.pool.push(e);
    }
    e.init(kind, wave, x, z);
    this.active.push(e);
    this.world.events.emit('enemy:spawned', { enemy: e });
    return e;
  }

  /** Lejos del jugador, en un anillo cerca del borde. Tras varios intentos acepta lo que salga. */
  private spawnPoint(): { x: number; z: number } {
    const rng = this.world.rng;
    const p = this.world.player.pos;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < ENEMY.spawnTries; tries++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(ARENA.radius - ENEMY.spawnRingInner, ARENA.radius - ENEMY.spawnRingOuter);
      x = Math.sin(a) * r;
      z = Math.cos(a) * r;
      if (Math.hypot(x - p.x, z - p.z) >= ENEMY.spawnMinDistFromPlayer) break;
    }
    return { x, z };
  }

  kill(e: EnemySim): void {
    e.fsm.go('dead', e);
    this.world.stats.kills++;
    this.world.events.emit('enemy:killed', { enemy: e });
  }

  remove(e: EnemySim): void {
    const i = this.active.indexOf(e);
    if (i < 0) return;
    this.active.splice(i, 1);
    e.active = false;
    this.world.events.emit('enemy:removed', { enemy: e });
  }

  clear(): void {
    while (this.active.length > 0) {
      const e = this.active[this.active.length - 1];
      if (e) this.remove(e);
    }
  }

  snapshot(): void {
    for (const e of this.active) e.snapshot();
  }

  step(dt: number): void {
    // De atrás para adelante: un enemigo puede quitarse a sí mismo del arreglo.
    for (let i = this.active.length - 1; i >= 0; i--) this.active[i]?.step(dt);
    this.separate();
  }

  /** Separación blanda entre enemigos y respecto del jugador, para que no se apilen. */
  private separate(): void {
    const list = this.active;
    const player = this.world.player.pos;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a?.canBeHit) continue;
      const aFrozen = a.fsm.is('frozen');
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b?.canBeHit) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = a.arch.radius + b.arch.radius;
        if (d < min && d > 1e-4) {
          const push = (min - d) / 2;
          const ux = dx / d;
          const uz = dz / d;
          if (!aFrozen) {
            a.pos.x -= ux * push;
            a.pos.z -= uz * push;
          }
          if (!b.fsm.is('frozen')) {
            b.pos.x += ux * push;
            b.pos.z += uz * push;
          }
        }
      }
      const dx = a.pos.x - player.x;
      const dz = a.pos.z - player.z;
      const d = Math.hypot(dx, dz);
      const min = a.arch.radius + PLAYER.radius;
      if (d < min && d > 1e-4 && !aFrozen) {
        a.pos.x += (dx / d) * (min - d);
        a.pos.z += (dz / d) * (min - d);
      }
    }
  }
}
