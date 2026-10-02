import type { Vector3 } from 'three';
import { MIX, type SampleBank } from '../data/audio';
import type { World } from '../game/World';
import type { AudioManager } from './AudioManager';
import { createSynthBank } from './synthBank';

/** Desde dónde se escucha: la cámara. */
export interface Listener {
  position: Vector3;
  /** Yaw de la cámara (adelante = (−sin, −cos)). */
  yaw: number;
}

/**
 * Traduce los eventos de la simulación a sonido. Los samples se combinan con el sintetizado del
 * prototipo (whooshes, tonos) y, mientras no cargaron, el sintetizado cubre todo.
 */
export class AudioDirector {
  private readonly synth;
  private lastStep = 0;
  private lastGrowl = -Infinity;

  constructor(
    private readonly audio: AudioManager,
    private readonly world: World,
    private readonly listener: Listener,
  ) {
    this.synth = createSynthBank(audio);
    const s = this.synth;
    const ev = world.events;

    ev.on('player:swing', () => s.whoosh());
    ev.on('player:slam', () => {
      if (!audio.playSample('slam')) s.slam();
      else audio.tone('sine', 90, 30, 0.5, 0.6);
    });
    ev.on('player:hit-landed', ({ heavy }) => {
      const ok = audio.playSample(heavy ? 'hit_heavy' : 'hit_flesh');
      if (!ok) s.hit(heavy);
      else if (heavy) audio.tone('sine', 120, 40, 0.3, 0.5);
    });
    ev.on('player:hurt', () => {
      audio.playSample('hit_flesh', { pitch: 0.8 });
      s.hurt();
    });
    ev.on('player:dodge', () => {
      audio.playSample('cloth');
      s.dodge();
    });
    ev.on('player:healed', () => s.heal());

    ev.on('enemy:hit', ({ x, z }) => this.at('hit_bone', x, z));
    ev.on('enemy:killed', ({ enemy }) => {
      const bone = this.at('bone_break', enemy.pos.x, enemy.pos.z);
      this.at('groan', enemy.pos.x, enemy.pos.z, enemy.arch.armored ? 0.8 : 1);
      if (!bone) s.die();
    });
    ev.on('enemy:spawned', ({ enemy }) => this.at('rise', enemy.pos.x, enemy.pos.z, 0.9, 0.7));
    ev.on('enemy:windup', ({ enemy }) => {
      const now = performance.now() / 1000;
      if (now - this.lastGrowl < MIX.growlCooldown) return;
      this.lastGrowl = now;
      this.at('growl', enemy.pos.x, enemy.pos.z, enemy.arch.armored ? 0.75 : 1);
    });
    ev.on('enemy:frozen', ({ x, z }) => {
      this.at('freeze', x, z);
      s.freeze();
    });

    ev.on('axe:thrown', () => s.throwAxe());
    ev.on('axe:hit', () => audio.playSample('hit_flesh', { volume: 0.7 }) || s.hit(false));
    ev.on('axe:embedded', ({ x, z, surface }) => {
      const ok = this.at(surface === 'obstacle' ? 'clink_metal' : 'clink_floor', x, z);
      if (!ok) s.clink();
    });
    ev.on('axe:recalled', () => s.recall());
    ev.on('axe:caught', () => {
      audio.playSample('catch');
      s.catchAxe();
    });

    ev.on('wave:start', ({ boss }) => {
      s.wave();
      audio.setDrums(true, boss);
    });
    ev.on('wave:cleared', () => audio.setDrums(false));
    this.bindBoss();
    ev.on('player:died', () => audio.setDrums(false));
  }

  private bindBoss(): void {
    const s = this.synth;
    const audio = this.audio;
    const ev = this.world.events;
    const boss = this.world.boss;
    const roar = () => {
      this.at('growl', boss.pos.x, boss.pos.z, 0.5, 1.2);
      s.roar();
    };
    ev.on('boss:intro', () => {
      s.quake();
      setTimeout(roar, 1200);
    });
    ev.on('boss:phase', roar);
    ev.on('boss:windup', ({ attack }) => {
      const x = boss.pos.x;
      const z = boss.pos.z;
      if (attack === 'sweep') s.windSweep();
      else if (attack === 'hammer') s.windHammer();
      else if (attack === 'charge') {
        s.windCharge();
        this.at('growl', x, z, 0.6);
      } else if (attack === 'hook') s.windHook();
      else if (attack === 'summon') {
        s.windSummon();
        this.at('groan', x, z, 0.55);
      } else s.windFury();
    });
    ev.on('boss:strike', ({ attack, x, z }) => {
      if (attack === 'hammer') {
        if (!this.at('slam', x, z, 0.8)) s.slam();
        s.quake();
      } else if (attack === 'charge') this.at('slam', x, z, 1.1, 0.6);
      else if (attack !== 'summon') s.whoosh();
    });
    ev.on('boss:hooked', () => this.at('clink_metal', boss.pos.x, boss.pos.z, 0.7));
    ev.on('boss:hit', ({ x, z }) => {
      if (!this.at('hit_bone', x, z, 0.7)) s.hit(false);
    });
    ev.on('boss:broken', () => {
      this.at('bone_break', boss.pos.x, boss.pos.z, 0.6);
      s.broken();
    });
    ev.on('boss:stunned', ({ x, z }) => {
      this.at('clink_metal', x, z, 0.5);
      s.quake();
    });
    ev.on('boss:leap', () => s.leap());
    ev.on('boss:landed', () => {
      if (!audio.playSample('slam', { pitch: 0.7 })) s.slam();
      s.quake();
    });
    ev.on('boss:ring', () => s.ring());
    ev.on('boss:died', () => {
      this.at('groan', boss.pos.x, boss.pos.z, 0.45, 1.3);
      s.roar();
      s.freeze();
    });
    ev.on('boss:defeated', () => audio.setDrums(false));
  }

  /**
   * Sample en una posición del mundo: se atenúa con la distancia a la cámara y se panea según
   * de qué lado está. Devuelve false si los samples todavía no cargaron.
   */
  private at(bank: SampleBank, x: number, z: number, pitch = 1, volume = 1): boolean {
    const l = this.listener;
    const dx = x - l.position.x;
    const dz = z - l.position.z;
    const dist = Math.hypot(dx, dz);
    const gain = Math.max(0.15, 1 - dist / MIX.falloffDistance);
    // Proyección sobre la derecha de la cámara: positivo = a la derecha.
    const rx = Math.cos(l.yaw);
    const rz = -Math.sin(l.yaw);
    const side = dist > 0.01 ? (dx * rx + dz * rz) / dist : 0;
    return this.audio.playSample(bank, { volume: gain * volume, pitch, pan: side * MIX.panAmount });
  }

  /** Pasos: suenan cada vez que la fase de caminata cruza medio ciclo. */
  update(): void {
    const p = this.world.player;
    const step = Math.floor(p.walk / Math.PI);
    if (step !== this.lastStep) {
      this.lastStep = step;
      if ((p.state === 'move' || p.state === 'idle') && p.vel.length() > 1) {
        this.audio.playSample('step', { volume: Math.min(1, p.vel.length() / 6) });
      }
    }
  }
}
