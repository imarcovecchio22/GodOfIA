import { describe, expect, it } from 'vitest';
import { Rng } from './Rng';
import { clamp, damp, lerpAngle } from './math';

describe('math', () => {
  it('clamp', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
  });

  it('damp converge igual a distintos framerates', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 60; i++) a += (1 - a) * damp(14, 1 / 60);
    for (let i = 0; i < 120; i++) b += (1 - b) * damp(14, 1 / 120);
    expect(a).toBeCloseTo(b, 6);
  });

  it('lerpAngle toma el camino más corto', () => {
    expect(lerpAngle(3, -3, 1)).toBeCloseTo(3 + (2 * Math.PI - 6), 6);
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });
});

describe('Rng', () => {
  it('es determinista con la misma semilla', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });

  it('range respeta los límites', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.range(0.4, 0.9);
      expect(v).toBeGreaterThanOrEqual(0.4);
      expect(v).toBeLessThan(0.9);
    }
  });
});
