import { DEFAULT_QUALITY, QUALITY, type Quality } from '../data/graphics';

/** Preferencias del jugador. Se guardan en localStorage; si no hay acceso, valen por la sesión. */
export interface Settings {
  /** Multiplicador de la sensibilidad del mouse. */
  sensitivity: number;
  invertY: boolean;
  /** Volúmenes en [0, 1]. */
  master: number;
  music: number;
  sfx: number;
  quality: Quality;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  sensitivity: 1,
  invertY: false,
  master: 0.8,
  music: 0.6,
  sfx: 0.9,
  quality: DEFAULT_QUALITY,
};

const KEY = 'furia-settings';

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** Valida lo leído: cualquier campo ausente o inválido vuelve a su valor por defecto. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const d = DEFAULT_SETTINGS;
  const sens =
    typeof r.sensitivity === 'number' && Number.isFinite(r.sensitivity)
      ? r.sensitivity
      : d.sensitivity;
  return {
    sensitivity: Math.min(3, Math.max(0.2, sens)),
    invertY: typeof r.invertY === 'boolean' ? r.invertY : d.invertY,
    master: clamp01(r.master, d.master),
    music: clamp01(r.music, d.music),
    sfx: clamp01(r.sfx, d.sfx),
    quality:
      typeof r.quality === 'string' && r.quality in QUALITY ? (r.quality as Quality) : d.quality,
  };
}

export function loadSettings(): Settings {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Almacenamiento bloqueado: los ajustes valen solo para esta sesión.
  }
}
