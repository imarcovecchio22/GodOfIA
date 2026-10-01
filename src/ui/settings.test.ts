import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

describe('Ajustes', () => {
  it('sin datos devuelve los valores por defecto', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('basura')).toEqual(DEFAULT_SETTINGS);
  });

  it('acota valores fuera de rango y descarta tipos inválidos', () => {
    const s = sanitizeSettings({
      sensitivity: 50,
      invertY: 'sí',
      master: 2,
      music: -1,
      sfx: Number.NaN,
      quality: 'ultra',
    });
    expect(s.sensitivity).toBe(3);
    expect(s.invertY).toBe(false);
    expect(s.master).toBe(1);
    expect(s.music).toBe(0);
    expect(s.sfx).toBe(DEFAULT_SETTINGS.sfx);
    expect(s.quality).toBe(DEFAULT_SETTINGS.quality);
  });

  it('respeta valores válidos', () => {
    const s = sanitizeSettings({ sensitivity: 1.5, invertY: true, quality: 'high', music: 0.2 });
    expect(s).toMatchObject({ sensitivity: 1.5, invertY: true, quality: 'high', music: 0.2 });
  });
});
