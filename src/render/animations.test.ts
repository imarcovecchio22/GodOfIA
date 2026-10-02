import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HEAVY, LIGHT_COMBO, THROW } from '../data/attacks';
import { ENEMY, ARCHETYPES } from '../data/enemies';
import { BOSS, BOSS_ATTACKS } from '../data/boss';
import { ANIMATION, BOSS_MODEL, ENEMY_MODELS, PLAYER_MODEL, type ClipRef } from '../data/models';
import { effectiveRecover, effectiveWindup } from '../entities/Boss';
import { bossImpactTime, impactTimeOf, warpTime } from './timeWarp';

const STEP = 1 / 60;

/** Duraciones de los clips leídas del JSON de cada GLB (sin decodificar los buffers). */
function clipDurations(file: string): Map<string, number> {
  const glb = readFileSync(join(process.cwd(), 'src', 'assets', 'models', `${file}.glb`));
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8')) as {
    animations: { name: string; samplers: { input: number }[] }[];
    accessors: { max?: number[] }[];
  };
  const out = new Map<string, number>();
  for (const a of json.animations) {
    let dur = 0;
    for (const s of a.samplers) dur = Math.max(dur, json.accessors[s.input]?.max?.[0] ?? 0);
    out.set(a.name, dur);
  }
  return out;
}

/** Primer tick (a 60 Hz) en que el clip llega a su cuadro de contacto. */
function contactTick(impact: number, total: number, ref: ClipRef, duration: number): number {
  for (let tick = 1; tick < 600; tick++) {
    if (warpTime(tick * STEP, impact, total, ref.contact, duration) >= ref.contact - 1e-9)
      return tick;
  }
  return -1;
}

describe('warpTime', () => {
  it('lleva el impacto del juego al contacto del clip y los extremos a los extremos', () => {
    expect(warpTime(0, 0.15, 0.38, 0.375, 1)).toBe(0);
    expect(warpTime(0.15, 0.15, 0.38, 0.375, 1)).toBeCloseTo(0.375);
    expect(warpTime(0.38, 0.15, 0.38, 0.375, 1)).toBeCloseTo(1);
    expect(warpTime(5, 0.15, 0.38, 0.375, 1)).toBeCloseTo(1);
  });

  it('es monótona', () => {
    let prev = -1;
    for (let t = 0; t <= 0.4; t += 0.005) {
      const v = warpTime(t, 0.15, 0.38, 0.375, 1);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('Clips del jugador', () => {
  const durations = clipDurations(PLAYER_MODEL.file);

  it('todos los clips referenciados existen en el GLB', () => {
    const names = [
      PLAYER_MODEL.locomotion.idle,
      PLAYER_MODEL.locomotion.walk,
      PLAYER_MODEL.locomotion.run,
      ...Object.values(PLAYER_MODEL.attacks).map((a) => a.clip),
      PLAYER_MODEL.throwClip.clip,
      PLAYER_MODEL.dodge,
      PLAYER_MODEL.hurt,
      PLAYER_MODEL.death,
      PLAYER_MODEL.recallPose.clip,
    ];
    for (const n of names) expect(durations.has(n), n).toBe(true);
  });

  it('cada golpe conecta en su ventana activa (±1 frame del impacto de la tabla)', () => {
    for (const def of [...LIGHT_COMBO, HEAVY]) {
      const ref = PLAYER_MODEL.attacks[def.id];
      if (!ref) throw new Error(`sin clip para ${def.id}`);
      const duration = durations.get(ref.clip) ?? 0;
      expect(ref.contact, def.id).toBeLessThan(duration);
      const impact = impactTimeOf(def);
      expect(impact).toBeGreaterThanOrEqual(def.active[0]);
      expect(impact).toBeLessThanOrEqual(def.active[1]);
      const tick = contactTick(impact, def.total, ref, duration);
      expect(Math.abs(tick - Math.round(impact / STEP)), def.id).toBeLessThanOrEqual(1);
      expect(tick * STEP).toBeGreaterThanOrEqual(def.active[0] - STEP);
      expect(tick * STEP).toBeLessThanOrEqual(def.active[1] + STEP);
    }
  });

  it('el hacha sale de la mano en el cuadro del lanzamiento (±1 frame)', () => {
    const ref = PLAYER_MODEL.throwClip;
    const duration = durations.get(ref.clip) ?? 0;
    const tick = contactTick(THROW.releaseAt, THROW.total, ref, duration);
    expect(Math.abs(tick - Math.round(THROW.releaseAt / STEP))).toBeLessThanOrEqual(1);
  });
});

describe('Clips de enemigos', () => {
  for (const kind of ['draugr', 'brute'] as const) {
    const model = ENEMY_MODELS[kind];
    const arch = ARCHETYPES[kind];
    const durations = clipDurations(model.file);

    it(`${kind}: los clips existen y el golpe conecta dentro de la ventana de daño`, () => {
      for (const n of [
        model.locomotion.idle,
        model.locomotion.walk,
        model.attack.clip,
        model.hit,
        model.death,
        model.spawn,
      ]) {
        expect(durations.has(n), n).toBe(true);
      }
      expect(model.spawnEnd).toBeLessThan(durations.get(model.spawn) ?? 0);
      // Secuencia: carga + ataque + recuperación; el contacto cae en la ventana del ataque.
      const impact = arch.windup + ANIMATION.enemyContactDelay;
      const total = arch.windup + ENEMY.attackDuration + arch.recover;
      const duration = durations.get(model.attack.clip) ?? 0;
      const tick = contactTick(impact, total, model.attack, duration);
      const t = tick * STEP - arch.windup;
      expect(t).toBeGreaterThanOrEqual(ENEMY.attackHitStart - STEP);
      expect(t).toBeLessThanOrEqual(ENEMY.attackHitEnd + STEP);
    });
  }
});

describe('Clips del jefe', () => {
  const M = BOSS_MODEL;
  const durations = clipDurations(M.file);

  it('todos los clips referenciados existen en el GLB', () => {
    const names = [
      M.idle,
      M.walk,
      M.chargeRun,
      M.transition,
      M.kneel.clip,
      M.stunned,
      M.leapStart,
      M.leapIdle,
      M.leapLand,
      M.emerge,
      M.death,
      ...Object.values(M.strikes).flatMap((refs) => refs.map((r) => r.clip)),
    ];
    for (const n of names) expect(durations.has(n), n).toBe(true);
    expect(M.emergeEnd).toBeLessThan(durations.get(M.emerge) ?? 0);
    expect(M.kneel.contact).toBeLessThan(durations.get(M.kneel.clip) ?? 0);
  });

  it('cada golpe tiene su clip y conecta en la ventana de daño, en todas las fases', () => {
    for (const a of BOSS_ATTACKS) {
      const refs = M.strikes[a.id];
      expect(refs.length, a.id).toBe(a.strikes.length);
      a.strikes.forEach((s, i) => {
        const ref = refs[i];
        if (!ref) throw new Error(`sin clip para ${a.id} ${i}`);
        const duration = durations.get(ref.clip) ?? 0;
        expect(ref.contact, a.id).toBeLessThan(duration);
        for (const phase of [1, 2, 3] as const) {
          const windup = effectiveWindup(s, phase);
          const total = windup + s.active + effectiveRecover(s, phase);
          const instant = s.anchor === 'target' || a.special !== undefined;
          const impact = bossImpactTime(windup, s.active, instant);
          const t = contactTick(impact, total, ref, duration) * STEP;
          expect(t, `${a.id} ${i} fase ${phase}`).toBeGreaterThanOrEqual(windup - STEP);
          expect(t, `${a.id} ${i} fase ${phase}`).toBeLessThanOrEqual(windup + s.active + STEP);
        }
      });
    }
    expect(BOSS.minWindup).toBeGreaterThan(0);
  });
});
