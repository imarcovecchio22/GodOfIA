import { Vector3 } from 'three';
import { Fsm, type StateTable } from '../ai/Fsm';
import { areaContains, type AreaShape } from '../combat/areas';
import { damp, lerpAngle } from '../core/math';
import {
  BOSS,
  BOSS_ATTACKS,
  type BossAttackDef,
  type BossAttackId,
  type BossPhase,
  type BossStrike,
} from '../data/boss';
import { PLAYER } from '../data/player';
import type { CharacterBody } from '../game/collision';
import type { Telegraph } from '../game/Telegraphs';
import type { World } from '../game/World';

export type BossState =
  | 'inactive'
  | 'emerge'
  | 'idle'
  | 'windup'
  | 'active'
  | 'recover'
  | 'broken'
  | 'stunned'
  | 'transition'
  | 'leap'
  | 'airborne'
  | 'landing'
  | 'dying'
  | 'dead';

/** Fase según la vida restante. */
export function phaseFor(hpFraction: number): BossPhase {
  const [p2, p3] = BOSS.phaseThresholds;
  return hpFraction > p2 ? 1 : hpFraction > p3 ? 2 : 3;
}

/** Carga efectiva de un golpe en una fase: aceleración de fase con piso de la regla de oro. */
export function effectiveWindup(strike: BossStrike, phase: BossPhase): number {
  return Math.max(BOSS.minWindup, strike.windup * (BOSS.phaseWindup[phase - 1] ?? 1));
}

export function effectiveRecover(strike: BossStrike, phase: BossPhase): number {
  return strike.recover * (BOSS.phaseRecover[phase - 1] ?? 1);
}

/**
 * Elige el próximo ataque por peso, según la fase, la distancia y los enfriamientos, sin repetir
 * el mismo ataque más de `maxRepeats` veces seguidas.
 */
export function chooseBossAttack(
  phase: BossPhase,
  dist: number,
  cooldowns: ReadonlyMap<BossAttackId, number>,
  history: readonly BossAttackId[],
  random: () => number,
  attacks: readonly BossAttackDef[] = BOSS_ATTACKS,
): BossAttackDef | null {
  const recent = history.slice(-BOSS.maxRepeats);
  const repeated =
    recent.length === BOSS.maxRepeats && recent.every((id) => id === recent[0]) ? recent[0] : null;
  const options: { a: BossAttackDef; w: number }[] = [];
  let total = 0;
  for (const a of attacks) {
    if (a.minPhase > phase || (cooldowns.get(a.id) ?? 0) > 0 || a.id === repeated) continue;
    const inRange = dist >= a.range[0] && dist <= a.range[1];
    const w = a.weight * (inRange ? 1 : BOSS.outOfRangeWeight);
    options.push({ a, w });
    total += w;
  }
  if (total <= 0) return null;
  let r = random() * total;
  for (const o of options) {
    r -= o.w;
    if (r <= 0) return o.a;
  }
  return options[options.length - 1]?.a ?? null;
}

interface Ring {
  start: number;
  radius: number;
  hit: boolean;
  shape: { kind: 'ring'; inner: number; outer: number };
  telegraph: Telegraph | null;
}

const tmp = new Vector3();
const dir = new Vector3();
const CENTER = { x: 0, z: 0 };
const LANDING: AreaShape = { kind: 'circle', radius: BOSS.judgment.landRadius };
/** En la embestida pega lo que toca el cuerpo. */
const CHARGE_BODY: AreaShape = { kind: 'circle', radius: BOSS.radius + 0.4 };

const STATES: StateTable<BossState, BossSim> = {
  inactive: {},
  emerge: { update: (b) => (b.fsm.t >= BOSS.emergeDuration ? 'idle' : undefined) },
  idle: { update: (b, dt) => b.updateIdle(dt) },
  windup: { update: (b, dt) => b.updateWindup(dt) },
  active: { enter: (b) => b.enterActive(), update: (b, dt) => b.updateActive(dt) },
  recover: { update: (b) => b.updateRecover() },
  broken: { update: (b) => b.updateBroken() },
  stunned: { update: (b) => (b.fsm.t >= BOSS.stunnedDuration ? 'idle' : undefined) },
  transition: {
    enter: (b) => b.enterTransition(),
    update: (b) => (b.fsm.t >= BOSS.transition.duration ? 'idle' : undefined),
  },
  leap: {
    enter: (b) => b.enterLeap(),
    update: (b) => (b.fsm.t >= BOSS.judgment.crouch ? 'airborne' : undefined),
  },
  airborne: { update: (b) => b.updateAirborne() },
  landing: {
    enter: (b) => b.enterLanding(),
    update: (b) => (b.fsm.t >= BOSS.judgment.recover ? 'idle' : undefined),
  },
  dying: { update: (b) => b.updateDying() },
  dead: {},
};

export class BossSim {
  readonly fsm = new Fsm<BossState, BossSim>(STATES, 'inactive');
  readonly pos = new Vector3();
  readonly prevPos = new Vector3();
  facing = 0;
  prevFacing = 0;
  hp = 0;
  maxHp = 0;
  phase: BossPhase = 1;
  appearance = 0;
  /** Medidor de quiebre (oculto en el HUD). */
  breakMeter = 0;
  private sinceHit = 0;
  /** Tiempo restante de la ralentización del hacha. */
  slowTimer = 0;
  flash = 0;

  attack: BossAttackDef | null = null;
  strikeIndex = 0;
  /** Golpe en curso (puede ser el tajo encadenado del garfio, que no está en la lista). */
  strike: BossStrike | null = null;
  private followUp: BossStrike | null = null;
  /** El tajo encadenado del garfio: se ejecuta como golpe común, no como garfio. */
  private followUpStrikeRef: BossStrike | null = null;
  private approach = 0;
  readonly cooldowns = new Map<BossAttackId, number>();
  readonly history: BossAttackId[] = [];
  telegraph: Telegraph | null = null;
  /** Origen y dirección fijados del área del golpe. */
  aimX = 0;
  aimZ = 0;
  aimDir = 0;
  private hitThisStrike = false;
  private chargeStart = new Vector3();
  judgmentTimer = 0;
  private landingTelegraph: Telegraph | null = null;
  readonly rings: Ring[] = [];
  private ringClock = 0;

  // Relación con el jugador, al inicio de cada paso.
  distToPlayer = 0;
  wantFacing = 0;

  private body: CharacterBody | null = null;

  constructor(private readonly world: World) {}

  get state(): BossState {
    return this.fsm.state;
  }

  get active(): boolean {
    return !this.fsm.is('inactive') && !this.fsm.is('dead');
  }

  get alive(): boolean {
    return this.active && !this.fsm.is('dying');
  }

  /** Puede recibir golpes (no en la entrada, la transición, el salto ni la muerte). */
  get canBeHit(): boolean {
    const s = this.fsm.state;
    return (
      s === 'idle' ||
      s === 'windup' ||
      s === 'active' ||
      s === 'recover' ||
      s === 'broken' ||
      s === 'stunned' ||
      s === 'landing'
    );
  }

  get hpFraction(): number {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  /** Aparición número `appearance` (1 en la oleada 5, 2 en la 10…). */
  spawn(appearance: number): void {
    this.appearance = appearance;
    this.maxHp = this.hp = BOSS.hpBase + BOSS.hpPerAppearance * (appearance - 1);
    this.phase = 1;
    this.breakMeter = 0;
    this.sinceHit = 0;
    this.slowTimer = 0;
    this.flash = 0;
    this.attack = null;
    this.strike = null;
    this.followUp = null;
    this.cooldowns.clear();
    this.history.length = 0;
    this.clearRings();
    this.pos.set(CENTER.x, 0, CENTER.z);
    this.prevPos.copy(this.pos);
    const p = this.world.player.pos;
    this.facing = this.prevFacing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    this.body ??= this.world.collision.createCharacter(BOSS.radius, BOSS.height);
    this.fsm.go('emerge', this);
    // Sale del centro rompiendo el piso: aparta al jugador si estaba encima.
    this.pushPlayer(BOSS.radius + PLAYER.radius + 1.5, BOSS.transition.pushForce);
    this.world.events.emit('boss:intro', { appearance });
  }

  /** Para reiniciar la partida. */
  reset(): void {
    this.hideTelegraph();
    this.clearRings();
    this.world.telegraphs.hide(this.landingTelegraph);
    this.fsm.reset('inactive');
  }

  snapshot(): void {
    this.prevPos.copy(this.pos);
    this.prevFacing = this.facing;
  }

  // ─────────────────────── Daño ───────────────────────

  /** Recibe daño del jugador. `slow`: el hacha lo ralentiza en vez de congelarlo. */
  takeDamage(amount: number, breakAmount: number, slow = false): boolean {
    if (!this.canBeHit) return false;
    const broken = this.fsm.is('broken');
    this.hp -= amount * (broken ? BOSS.brokenDamageMult : 1);
    this.flash = 1;
    this.sinceHit = 0;
    if (slow) this.slowTimer = BOSS.axeSlowDuration;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }
    const next = phaseFor(this.hpFraction);
    if (next > this.phase) {
      this.phase = next;
      this.cancelAttack();
      this.fsm.go('transition', this);
      return true;
    }
    if (!broken) {
      this.breakMeter = Math.min(BOSS.breakMax, this.breakMeter + breakAmount);
      if (this.breakMeter >= BOSS.breakMax) {
        this.cancelAttack();
        this.fsm.go('broken', this);
        this.world.events.emit('boss:broken', undefined);
      }
    }
    return true;
  }

  private die(): void {
    this.cancelAttack();
    this.clearRings();
    this.world.telegraphs.hide(this.landingTelegraph);
    this.world.hazards.clear();
    this.fsm.go('dying', this);
    const w = this.world;
    // Sus invocados caen con él.
    for (const e of [...w.enemies.active]) if (e.alive) w.enemies.kill(e);
    w.player.heal(w.player.maxHp);
    for (let i = 0; i < BOSS.death.orbs; i++) {
      const a = (i / BOSS.death.orbs) * Math.PI * 2;
      w.orbs.spawn(this.pos.x + Math.sin(a) * 2.5, this.pos.z + Math.cos(a) * 2.5);
    }
    w.events.emit('boss:died', { x: this.pos.x, y: BOSS.hitHeight, z: this.pos.z });
  }

  updateDying(): BossState | undefined {
    if (this.fsm.t < BOSS.death.duration) return undefined;
    this.world.events.emit('boss:defeated', undefined);
    return 'dead';
  }

  // ─────────────────────── Paso ───────────────────────

  step(dt: number): void {
    if (!this.active) return;
    const w = this.world;
    this.flash = Math.max(0, this.flash - dt * 6);
    this.sinceHit += dt;
    if (this.sinceHit > BOSS.breakDecayDelay && !this.fsm.is('broken')) {
      this.breakMeter = Math.max(0, this.breakMeter - BOSS.breakDecayRate * dt);
    }
    for (const [id, cd] of this.cooldowns) this.cooldowns.set(id, cd - dt);
    if (this.phase === 3) this.judgmentTimer -= dt;
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    // El hacha lo ralentiza: todo su tiempo (cargas incluidas) corre más lento.
    const bossDt = dt * (this.slowTimer > 0 ? 1 - BOSS.axeSlow : 1);

    const p = w.player.pos;
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    this.distToPlayer = Math.hypot(dx, dz);
    this.wantFacing = Math.atan2(dx, dz);

    this.fsm.update(this, bossDt);
    this.updateRings(dt);

    if (this.body && this.grounded) {
      const before = tmp.copy(this.pos);
      const wanted = before.distanceTo(this.prevPos);
      w.collision.moveCharacter(this.body, this.prevPos, this.pos);
      this.checkChargeBlocked(wanted);
      this.separateFromPlayer();
    }
  }

  private get grounded(): boolean {
    const s = this.fsm.state;
    return s !== 'airborne' && s !== 'emerge' && s !== 'dying' && s !== 'leap';
  }

  private turnToPlayer(dt: number, k = BOSS.turnDamp): void {
    this.facing = lerpAngle(this.facing, this.wantFacing, damp(k, dt));
  }

  /** El jugador no puede atravesar al jefe: lo empuja hacia afuera. */
  private separateFromPlayer(): void {
    const p = this.world.player;
    const dx = p.pos.x - this.pos.x;
    const dz = p.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const min = BOSS.radius + PLAYER.radius;
    if (d < min && d > 1e-4) p.displace((dx / d) * (min - d), (dz / d) * (min - d));
  }

  private pushPlayer(radius: number, force: number): void {
    const p = this.world.player;
    const dx = p.pos.x - this.pos.x;
    const dz = p.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 0.001;
    if (d > radius) return;
    dir.set(dx / d, 0, dz / d);
    p.kb.addScaledVector(dir, force);
  }

  // ─────────────────────── Elección y ataques ───────────────────────

  updateIdle(dt: number): BossState | undefined {
    this.turnToPlayer(dt);
    if (!this.world.player.alive) return undefined;
    if (this.fsm.t < BOSS.thinkTime) return undefined;
    if (this.phase === 3 && this.judgmentTimer <= 0) return 'leap';
    if (!this.attack) {
      this.attack = chooseBossAttack(
        this.phase,
        this.distToPlayer,
        this.cooldowns,
        this.history,
        () => this.world.rng.next(),
      );
      this.approach = 0;
      if (!this.attack) return undefined;
    }
    const [, max] = this.attack.range;
    if (this.distToPlayer > max && this.approach < BOSS.approachTimeout) {
      this.approach += dt;
      this.pos.x += Math.sin(this.facing) * BOSS.moveSpeed * dt;
      this.pos.z += Math.cos(this.facing) * BOSS.moveSpeed * dt;
      return undefined;
    }
    this.strikeIndex = 0;
    const first = this.attack.strikes[0];
    if (!first) return undefined;
    this.beginStrike(first);
    return undefined;
  }

  /** Arranca la carga de un golpe: aviso en el piso con el área exacta. */
  private beginStrike(strike: BossStrike): void {
    this.strike = strike;
    this.hitThisStrike = false;
    const p = this.world.player.pos;
    if (strike.anchor === 'target') {
      this.aimX = p.x;
      this.aimZ = p.z;
      this.facing = this.wantFacing;
    } else {
      this.aimX = this.pos.x;
      this.aimZ = this.pos.z;
    }
    this.aimDir = this.facing;
    this.hideTelegraph();
    if (this.hasArea(strike)) {
      this.telegraph = this.world.telegraphs.show(
        strike.shape,
        this.aimX,
        this.aimZ,
        this.aimDir,
        effectiveWindup(strike, this.phase),
      );
    }
    this.fsm.go('windup', this);
    this.world.events.emit('boss:windup', {
      attack: this.attack?.id ?? 'sweep',
      strike: this.strikeIndex,
    });
  }

  private hasArea(strike: BossStrike): boolean {
    const s: AreaShape = strike.shape;
    return !(s.kind === 'circle' && s.radius <= 0);
  }

  updateWindup(dt: number): BossState | undefined {
    const strike = this.strike;
    if (!strike) return 'idle';
    const windup = effectiveWindup(strike, this.phase);
    // Sigue al jugador durante la primera parte de la carga; después el área queda fija.
    if (strike.anchor === 'self' && this.fsm.t < windup * strike.track) {
      this.turnToPlayer(dt, BOSS.turnDamp * 1.5);
      this.aimX = this.pos.x;
      this.aimZ = this.pos.z;
      this.aimDir = this.facing;
    }
    const tg = this.telegraph;
    if (tg) {
      tg.x = this.aimX;
      tg.z = this.aimZ;
      tg.dir = this.aimDir;
      tg.t = this.fsm.t;
    }
    return this.fsm.t >= windup ? 'active' : undefined;
  }

  enterActive(): void {
    const strike = this.strike;
    const w = this.world;
    if (!strike) return;
    this.chargeStart.copy(this.pos);
    w.events.emit('boss:strike', {
      attack: this.attack?.id ?? 'sweep',
      x: this.aimX,
      z: this.aimZ,
    });
    const special = this.strike === this.followUpStrikeRef ? undefined : this.attack?.special;
    if (special === 'summon') {
      for (let i = 0; i < BOSS.summon.count; i++) w.enemies.spawn('draugr', w.waves.wave);
      w.events.emit('boss:summon', undefined);
    } else if (special === 'hook') {
      this.tryHook(strike);
    } else if (strike.anchor === 'target') {
      // Martillazo: pega una vez y deja la grieta de hielo.
      this.tryHit(strike.shape, strike.damage, strike.knockback, this.aimX, this.aimZ, this.aimDir);
      w.hazards.add(
        'burn',
        { kind: 'circle', radius: BOSS.burn.radius },
        this.aimX,
        this.aimZ,
        BOSS.burn.dps,
        BOSS.burn.duration,
      );
    }
  }

  private tryHook(strike: BossStrike): void {
    const w = this.world;
    const p = w.player;
    if (
      !areaContains(
        strike.shape,
        this.aimX,
        this.aimZ,
        this.aimDir,
        p.pos.x,
        p.pos.z,
        PLAYER.radius,
      )
    )
      return;
    const d = BOSS.hook.pullDistance + BOSS.radius;
    const tx = this.pos.x + Math.sin(this.facing) * d;
    const tz = this.pos.z + Math.cos(this.facing) * d;
    if (!p.pull(tx, tz, BOSS.hook.pullDuration)) return;
    // Lo trae y encadena un tajo (con su aviso completo).
    const sweep = BOSS_ATTACKS.find((a) => a.id === 'sweep')?.strikes[0] ?? null;
    this.followUp = sweep;
    this.followUpStrikeRef = sweep;
    w.events.emit('boss:hooked', undefined);
  }

  private tryHit(
    shape: AreaShape,
    damage: number,
    knockback: number,
    ox: number,
    oz: number,
    odir: number,
  ): void {
    if (this.hitThisStrike) return;
    const p = this.world.player;
    if (!areaContains(shape, ox, oz, odir, p.pos.x, p.pos.z, PLAYER.radius)) return;
    this.hitThisStrike = true;
    const dx = p.pos.x - this.pos.x;
    const dz = p.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 0.001;
    dir.set(dx / d, 0, dz / d);
    p.hurt(damage, dir, true, knockback);
  }

  updateActive(dt: number): BossState | undefined {
    const strike = this.strike;
    if (!strike) return 'idle';
    const special = strike === this.followUpStrikeRef ? undefined : this.attack?.special;
    if (strike.lunge > 0) {
      const speed = strike.lunge / strike.active;
      this.pos.x += Math.sin(this.aimDir) * speed * dt;
      this.pos.z += Math.cos(this.aimDir) * speed * dt;
    }
    if (special === 'charge') {
      // Embestida: pega a lo que toca con el cuerpo.
      this.tryHit(
        CHARGE_BODY,
        strike.damage,
        strike.knockback,
        this.pos.x,
        this.pos.z,
        this.aimDir,
      );
    } else if (strike.anchor === 'self' && special !== 'hook' && special !== 'summon') {
      this.tryHit(
        strike.shape,
        strike.damage,
        strike.knockback,
        this.pos.x,
        this.pos.z,
        this.aimDir,
      );
    }
    if (this.fsm.t < strike.active) return undefined;
    this.hideTelegraph();
    return 'recover';
  }

  /** En la embestida, si una columna lo frena, queda aturdido. Contra el borde, solo se detiene. */
  private checkChargeBlocked(wanted: number): void {
    if (
      !this.fsm.is('active') ||
      this.attack?.special !== 'charge' ||
      this.strike === this.followUpStrikeRef
    )
      return;
    const moved = this.pos.distanceTo(this.prevPos);
    if (wanted < 1e-3 || moved > wanted * 0.5) return;
    tmp.set(
      this.pos.x + Math.sin(this.aimDir) * (BOSS.radius + 0.6),
      1,
      this.pos.z + Math.cos(this.aimDir) * (BOSS.radius + 0.6),
    );
    dir.set(this.pos.x, 1, this.pos.z);
    this.hideTelegraph();
    if (this.world.collision.castSolid(dir, tmp) >= 0) {
      this.finishAttack();
      this.fsm.go('stunned', this);
      this.world.events.emit('boss:stunned', { x: tmp.x, z: tmp.z });
    } else {
      this.fsm.go('recover', this);
    }
  }

  updateRecover(): BossState | undefined {
    const strike = this.strike;
    if (!strike) return 'idle';
    if (this.fsm.t < effectiveRecover(strike, this.phase)) return undefined;
    if (this.followUp) {
      const next = this.followUp;
      this.followUp = null;
      this.beginStrike(next);
      return undefined;
    }
    this.strikeIndex++;
    const next = this.attack?.strikes[this.strikeIndex];
    if (next) {
      this.beginStrike(next);
      return undefined;
    }
    this.finishAttack();
    return 'idle';
  }

  private finishAttack(): void {
    if (this.attack) {
      this.cooldowns.set(this.attack.id, this.attack.cooldown);
      this.history.push(this.attack.id);
      if (this.history.length > 8) this.history.shift();
    }
    this.attack = null;
    this.strike = null;
    this.followUp = null;
    this.followUpStrikeRef = null;
  }

  private cancelAttack(): void {
    this.hideTelegraph();
    this.finishAttack();
  }

  private hideTelegraph(): void {
    this.world.telegraphs.hide(this.telegraph);
    this.telegraph = null;
  }

  updateBroken(): BossState | undefined {
    if (this.fsm.t < BOSS.brokenDuration) return undefined;
    this.breakMeter = 0;
    this.world.events.emit('boss:recovered', undefined);
    return 'idle';
  }

  enterTransition(): void {
    this.pushPlayer(BOSS.transition.pushRadius, BOSS.transition.pushForce);
    if (this.phase === 3) {
      this.world.hazards.add(
        'cold',
        { kind: 'ring', inner: BOSS.cold.radius, outer: 100 },
        0,
        0,
        BOSS.cold.dps,
        Number.POSITIVE_INFINITY,
      );
      this.judgmentTimer = BOSS.judgment.firstDelay;
    }
    this.world.events.emit('boss:phase', { phase: this.phase });
  }

  // ─────────────────────── Juicio del lago ───────────────────────

  enterLeap(): void {
    const J = BOSS.judgment;
    this.landingTelegraph = this.world.telegraphs.show(
      { kind: 'circle', radius: J.landRadius },
      CENTER.x,
      CENTER.z,
      0,
      J.crouch + J.airborne,
    );
    this.world.events.emit('boss:leap', undefined);
  }

  updateAirborne(): BossState | undefined {
    const J = BOSS.judgment;
    const u = Math.min(this.fsm.t / J.airborne, 1);
    this.pos.x += (CENTER.x - this.pos.x) * u;
    this.pos.z += (CENTER.z - this.pos.z) * u;
    if (this.landingTelegraph) this.landingTelegraph.t = J.crouch + this.fsm.t;
    return this.fsm.t >= J.airborne ? 'landing' : undefined;
  }

  enterLanding(): void {
    const J = BOSS.judgment;
    const w = this.world;
    this.pos.set(CENTER.x, 0, CENTER.z);
    this.prevPos.copy(this.pos);
    w.telegraphs.hide(this.landingTelegraph);
    this.landingTelegraph = null;
    this.tryHit(LANDING, J.landDamage, J.landKnockback, CENTER.x, CENTER.z, 0);
    this.hitThisStrike = false;
    this.clearRings();
    this.ringClock = 0;
    for (let i = 0; i < J.rings; i++) {
      this.rings.push({
        start: i * J.ringSpacing,
        radius: 0,
        hit: false,
        shape: { kind: 'ring', inner: 0, outer: 0 },
        telegraph: null,
      });
    }
    this.judgmentTimer = J.interval;
    w.events.emit('boss:landed', { x: CENTER.x, z: CENTER.z });
  }

  /** Los anillos avanzan aunque el jefe haga otra cosa; cada uno pega una sola vez. */
  private updateRings(dt: number): void {
    if (this.rings.length === 0) return;
    const J = BOSS.judgment;
    const w = this.world;
    this.ringClock += dt;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      if (!r) continue;
      const age = this.ringClock - r.start;
      if (age < 0) continue;
      if (!r.telegraph) {
        r.telegraph = w.telegraphs.show(r.shape, CENTER.x, CENTER.z, 0, 0);
        w.events.emit('boss:ring', undefined);
      }
      r.radius = age * J.ringSpeed;
      r.shape.inner = Math.max(0, r.radius - J.ringWidth / 2);
      r.shape.outer = r.radius + J.ringWidth / 2;
      const p = w.player;
      if (!r.hit && areaContains(r.shape, CENTER.x, CENTER.z, 0, p.pos.x, p.pos.z, PLAYER.radius)) {
        r.hit = true;
        const d = Math.hypot(p.pos.x, p.pos.z) || 0.001;
        dir.set(p.pos.x / d, 0, p.pos.z / d);
        p.hurt(J.ringDamage, dir, true, J.ringKnockback);
      }
      if (r.radius > J.ringMaxRadius) {
        w.telegraphs.hide(r.telegraph);
        this.rings.splice(i, 1);
      }
    }
  }

  private clearRings(): void {
    for (const r of this.rings) this.world.telegraphs.hide(r.telegraph);
    this.rings.length = 0;
  }
}
