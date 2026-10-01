/**
 * Tambores de guerra procedurales: un patrón de toms graves que entra durante las oleadas.
 * Se programa con anticipación sobre el reloj de audio (no sobre setInterval) para que el ritmo
 * no tenga jitter aunque el hilo principal esté ocupado.
 */
const LOOKAHEAD = 0.2;
const TICK_MS = 50;
/** 16 corcheas: 1 = tom grave, 2 = tom medio, 3 = golpe de marco (ruido). */
const PATTERN = [1, 0, 0, 3, 2, 0, 1, 0, 1, 0, 3, 1, 2, 0, 3, 0];

export class WarDrums {
  private readonly out: GainNode;
  private nextTime = 0;
  private step = 0;
  private timer: number | null = null;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly noise: AudioBuffer,
    private readonly bpm: number,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
  }

  /** Volumen objetivo (0 = apagados) con fundido de `fade` segundos. */
  setLevel(level: number, fade: number): void {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(level, t + Math.max(0.01, fade));
    if (level > 0) this.start();
  }

  private start(): void {
    if (this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => {
      this.schedule();
    }, TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const eighth = 60 / this.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      const hit = PATTERN[this.step % PATTERN.length] ?? 0;
      if (hit === 1) this.tom(this.nextTime, 62, 0.9);
      else if (hit === 2) this.tom(this.nextTime, 92, 0.6);
      else if (hit === 3) this.frame(this.nextTime);
      this.nextTime += eighth;
      this.step++;
    }
  }

  private tom(t: number, freq: number, vol: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g);
    g.connect(this.out);
    o.start(t);
    o.stop(t + 0.6);
  }

  private frame(t: number): void {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 220;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(f);
    f.connect(g);
    g.connect(this.out);
    s.start(t);
    s.stop(t + 0.2);
  }
}
