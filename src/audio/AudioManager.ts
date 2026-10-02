import { BANKS, BANK_SIZES, MIX, type SampleBank } from '../data/audio';
import { WarDrums } from './WarDrums';

export interface PlayOptions {
  /** Multiplicador de volumen (por ejemplo, por distancia). */
  volume?: number;
  /** Multiplicador de pitch sobre el rango del banco. */
  pitch?: number;
  /** Paneo estéreo en [−1, 1]. */
  pan?: number;
}

/**
 * Audio con Web Audio API. Tres buses (efectos, música, ambiente) bajo un master.
 * Los samples se cargan en diferido: hasta que llegan, quien llama puede usar el sintetizado
 * (`playSample` devuelve false).
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private ambient: GainNode | null = null;
  private drums: WarDrums | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private readonly buffers = new Map<SampleBank, AudioBuffer[]>();
  private readonly voices = new Map<SampleBank, number>();
  private readonly lastIndex = new Map<SampleBank, number>();
  private volumes = { master: 0.8, music: 0.6, sfx: 0.9 };
  muted = false;

  /** Tiene que llamarse desde un gesto del usuario (click) por la política de autoplay. */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    const ctx = this.ctx;
    const len = (ctx.sampleRate * 0.6) | 0;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.ambient = ctx.createGain();
    this.ambient.connect(this.master);
    this.drums = new WarDrums(ctx, this.music, this.noiseBuf, MIX.drumsBpm);
    this.applyVolumes();
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  // ─────────────────────── Volumen ───────────────────────

  setVolumes(v: { master: number; music: number; sfx: number }): void {
    this.volumes = { ...v };
    this.applyVolumes();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.sfx || !this.music || !this.ambient) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, t, 0.02);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.02);
    this.music.gain.setTargetAtTime(this.volumes.music, t, 0.02);
    this.ambient.gain.setTargetAtTime(this.volumes.music * MIX.ambientVolume, t, 0.02);
  }

  // ─────────────────────── Samples ───────────────────────

  /** Descarga y decodifica todos los bancos. No bloquea el juego: se llama en segundo plano. */
  async loadSamples(urls: Record<string, string>): Promise<void> {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const jobs: Promise<void>[] = [];
    for (const bank of Object.keys(BANK_SIZES) as SampleBank[]) {
      const list: AudioBuffer[] = [];
      this.buffers.set(bank, list);
      for (let i = 0; i < BANK_SIZES[bank]; i++) {
        const url = urls[`${bank}_${i}`];
        if (!url) continue;
        jobs.push(
          fetch(url)
            .then((r) => r.arrayBuffer())
            .then((b) => ctx.decodeAudioData(b))
            .then((buf) => {
              list.push(buf);
            })
            .catch(() => {
              // Si un sample falla, ese banco sigue con los demás (o con el sintetizado).
            }),
        );
      }
    }
    await Promise.all(jobs);
  }

  /** Reproduce una variación del banco. Devuelve false si no hay samples cargados. */
  playSample(bank: SampleBank, opts: PlayOptions = {}): boolean {
    const ctx = this.ctx;
    const list = this.buffers.get(bank);
    if (!ctx || !this.sfx || this.muted || !list || list.length === 0) return false;
    const tune = BANKS[bank];
    const active = this.voices.get(bank) ?? 0;
    if (active >= tune.maxVoices) return true;

    // Variación al azar, sin repetir la anterior.
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.lastIndex.get(bank)) i = (i + 1) % list.length;
    this.lastIndex.set(bank, i);
    const buf = list[i];
    if (!buf) return false;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const pitch = tune.pitchMin + Math.random() * (tune.pitchMax - tune.pitchMin);
    src.playbackRate.value = pitch * (opts.pitch ?? 1);
    const g = ctx.createGain();
    const jitter = 1 + (Math.random() * 2 - 1) * tune.volumeJitter;
    g.gain.value = tune.volume * jitter * (opts.volume ?? 1);
    let node: AudioNode = g;
    if (opts.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      node = p;
    }
    src.connect(g);
    node.connect(this.sfx);
    this.voices.set(bank, active + 1);
    src.onended = () => {
      this.voices.set(bank, Math.max(0, (this.voices.get(bank) ?? 1) - 1));
    };
    src.start();
    return true;
  }

  // ─────────────────────── Música y ambiente ───────────────────────

  /** Ambientación en loop (si ya cargó). Se recorta el relleno del MP3 para que no haya corte. */
  startAmbient(): void {
    const ctx = this.ctx;
    const buf = this.buffers.get('ambient')?.[0];
    if (!ctx || !this.ambient || !buf || this.ambientSource) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0.05;
    src.loopEnd = buf.duration - 0.05;
    src.connect(this.ambient);
    src.start(0, 0.05);
    this.ambientSource = src;
  }

  /** Tambores de oleada; `boss` = la versión rápida de la pelea con el jefe. */
  setDrums(on: boolean, boss = false): void {
    const d = this.drums;
    if (!d) return;
    d.bpm = boss ? MIX.bossDrumsBpm : MIX.drumsBpm;
    d.setLevel(on ? (boss ? MIX.bossDrumsVolume : MIX.drumsVolume) : 0, MIX.drumsFade);
  }

  // ─────────────────────── Sintetizado ───────────────────────

  private synthReady(): { ctx: AudioContext; out: GainNode; noise: AudioBuffer } | null {
    if (this.muted || !this.ctx || !this.sfx || !this.noiseBuf) return null;
    return { ctx: this.ctx, out: this.sfx, noise: this.noiseBuf };
  }

  private envelope(g: GainNode, t: number, peak: number, dur: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.006 + dur);
  }

  noise(
    dur: number,
    freq: number,
    q: number,
    vol: number,
    type: BiquadFilterType = 'lowpass',
    sweep?: number,
  ): void {
    const r = this.synthReady();
    if (!r) return;
    const t = r.ctx.currentTime;
    const src = r.ctx.createBufferSource();
    src.buffer = r.noise;
    const f = r.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    f.Q.value = q;
    const g = r.ctx.createGain();
    this.envelope(g, t, vol, dur);
    src.connect(f);
    f.connect(g);
    g.connect(r.out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const r = this.synthReady();
    if (!r) return;
    const t = r.ctx.currentTime;
    const o = r.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = r.ctx.createGain();
    this.envelope(g, t, vol, dur);
    o.connect(g);
    g.connect(r.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
