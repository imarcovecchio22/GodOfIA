/**
 * Audio con Web Audio API. Por ahora sintetiza los sonidos del prototipo; en la fase 4 se suman
 * samples y este sintetizado queda como respaldo.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private master: GainNode | null = null;
  muted = false;
  private volume = 1;

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
    const len = (this.ctx.sampleRate * 0.6) | 0;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  toggleMute(): void {
    this.muted = !this.muted;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private ready(): { ctx: AudioContext; out: GainNode; noise: AudioBuffer } | null {
    if (this.muted || !this.ctx || !this.master || !this.noiseBuf) return null;
    return { ctx: this.ctx, out: this.master, noise: this.noiseBuf };
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
    const r = this.ready();
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
    const r = this.ready();
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
