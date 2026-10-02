import { describe, expect, it } from 'vitest';
import { areaContains } from './areas';

const DEG = Math.PI / 180;

describe('Áreas', () => {
  it('círculo', () => {
    const c = { kind: 'circle', radius: 3 } as const;
    expect(areaContains(c, 0, 0, 0, 2.9, 0)).toBe(true);
    expect(areaContains(c, 0, 0, 0, 3.2, 0)).toBe(false);
    expect(areaContains(c, 0, 0, 0, 3.2, 0, 0.3)).toBe(true);
  });

  it('arco de 160° hacia adelante', () => {
    const a = { kind: 'arc', radius: 5, angle: 160 * DEG } as const;
    expect(areaContains(a, 0, 0, 0, 0, 4)).toBe(true); // adelante
    expect(areaContains(a, 0, 0, 0, 3.5, 1)).toBe(true); // al costado (74°), dentro de 80°
    expect(areaContains(a, 0, 0, 0, 4, 0.3)).toBe(false); // 86°: afuera
    expect(areaContains(a, 0, 0, 0, 0, -4)).toBe(false); // atrás
    expect(areaContains(a, 0, 0, 0, 0, 5.5)).toBe(false); // fuera de alcance
  });

  it('línea', () => {
    const l = { kind: 'line', length: 12, width: 2 } as const;
    expect(areaContains(l, 0, 0, 0, 0.5, 8)).toBe(true);
    expect(areaContains(l, 0, 0, 0, 1.5, 8)).toBe(false);
    expect(areaContains(l, 0, 0, 0, 0, 13)).toBe(false);
    expect(areaContains(l, 0, 0, Math.PI / 2, 8, 0.5)).toBe(true); // apuntando a +X
  });

  it('anillo', () => {
    const r = { kind: 'ring', inner: 10, outer: 11 } as const;
    expect(areaContains(r, 0, 0, 0, 10.5, 0)).toBe(true);
    expect(areaContains(r, 0, 0, 0, 5, 0)).toBe(false);
    expect(areaContains(r, 0, 0, 0, 12, 0)).toBe(false);
    expect(areaContains(r, 0, 0, 0, 9.8, 0, 0.45)).toBe(true);
  });
});
