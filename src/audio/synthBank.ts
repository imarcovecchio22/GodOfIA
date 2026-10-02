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

    // ─── Jefe (fase 5): cada carga tiene su sonido, para reconocerla sin mirar. ───
    roar() {
      a.tone('sawtooth', 95, 42, 1.6, 0.34);
      a.tone('square', 62, 38, 1.4, 0.12);
      a.noise(1.5, 420, 0.8, 0.5, 'lowpass', 160);
    },
    /** Tajo: el hacha toma envión, un silbido grave que sube. */
    windSweep: () => a.noise(0.8, 220, 3, 0.32, 'bandpass', 1300),
    /** Martillazo: tono que sube y se tensa hasta el golpe. */
    windHammer() {
      a.tone('sawtooth', 48, 120, 1.0, 0.22);
      a.noise(1.0, 1800, 6, 0.12, 'bandpass', 3800);
    },
    /** Embestida: resoplido y pisotón. */
    windCharge() {
      a.noise(0.5, 600, 1, 0.45, 'lowpass', 180);
      a.tone('sine', 70, 40, 0.5, 0.5);
    },
    /** Garfio: cadena revoleada. */
    windHook() {
      a.noise(0.65, 3200, 9, 0.28, 'bandpass', 4200);
      a.tone('triangle', 900, 1300, 0.65, 0.05);
    },
    /** Llamado de los ahogados: un lamento hueco. */
    windSummon() {
      a.tone('sine', 220, 110, 1.1, 0.2);
      a.tone('sine', 233, 117, 1.1, 0.14);
    },
    /** Furia: un golpe de aire corto por cada hachazo. */
    windFury: () => a.noise(0.45, 400, 3, 0.3, 'bandpass', 1800),
    /** Juicio del lago: se agacha y salta. */
    leap() {
      a.noise(0.8, 300, 1, 0.5, 'lowpass', 1200);
      a.tone('sine', 60, 180, 0.8, 0.3);
    },
    quake() {
      a.noise(0.9, 400, 0.8, 1, 'lowpass', 60);
      a.tone('sine', 70, 28, 0.9, 1);
    },
    ring: () => a.tone('sine', 140, 70, 0.6, 0.35),
    broken() {
      a.tone('square', 300, 90, 0.4, 0.18);
      a.noise(0.4, 2000, 1, 0.5, 'highpass');
    },
  };
}
