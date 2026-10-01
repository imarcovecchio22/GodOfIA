import type { AudioManager } from './AudioManager';

/** Sonidos sintetizados del prototipo, con los mismos parámetros. */
export function createSynthBank(a: AudioManager) {
  return {
    hit(heavy: boolean) {
      a.noise(heavy ? 0.28 : 0.15, heavy ? 900 : 1700, 1, heavy ? 0.9 : 0.6);
      a.tone('sine', heavy ? 120 : 170, 40, heavy ? 0.32 : 0.18, heavy ? 0.9 : 0.55);
    },
    whoosh: () => a.noise(0.17, 500, 2.5, 0.22, 'bandpass', 2600),
    slam() {
      a.noise(0.5, 500, 0.8, 0.9, 'lowpass', 80);
      a.tone('sine', 90, 30, 0.5, 0.9);
    },
    throwAxe: () => a.noise(0.32, 300, 3, 0.3, 'bandpass', 2000),
    recall() {
      a.noise(0.5, 2400, 4, 0.18, 'bandpass', 600);
      a.tone('sine', 300, 900, 0.45, 0.08);
    },
    catchAxe() {
      a.tone('square', 900, 700, 0.07, 0.1);
      a.tone('sine', 1400, 1250, 0.45, 0.2);
      a.noise(0.07, 3500, 1, 0.35, 'highpass');
    },
    freeze() {
      a.tone('sine', 1800, 3200, 0.35, 0.12);
      a.noise(0.35, 5000, 2, 0.2, 'highpass');
    },
    hurt() {
      a.tone('sawtooth', 190, 60, 0.28, 0.32);
      a.noise(0.2, 700, 1, 0.4);
    },
    die() {
      a.tone('sawtooth', 130, 38, 0.6, 0.22);
      a.noise(0.4, 300, 1, 0.3);
    },
    heal() {
      a.tone('sine', 520, 1040, 0.3, 0.18);
      a.tone('sine', 780, 1560, 0.3, 0.1);
    },
    wave() {
      a.tone('sawtooth', 72, 55, 1.3, 0.3);
      a.tone('sine', 144, 110, 1.3, 0.28);
    },
    clink() {
      a.tone('triangle', 1200, 900, 0.15, 0.18);
      a.noise(0.08, 3000, 2, 0.3, 'bandpass');
    },
    dodge: () => a.noise(0.22, 300, 1.5, 0.18, 'bandpass', 900),
  };
}
