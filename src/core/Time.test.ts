import { describe, expect, it } from 'vitest';
import { Time } from './Time';

function runFrame(time: Time, dt: number): number {
  time.beginFrame(dt);
  let steps = 0;
  while (time.consumeStep()) steps++;
  return steps;
}

describe('Time', () => {
  it('simula pasos fijos de 1/60 independientemente del framerate', () => {
    const t60 = new Time(60, 0.05);
    const t144 = new Time(60, 0.05);
    for (let i = 0; i < 60; i++) runFrame(t60, 1 / 60);
    for (let i = 0; i < 144; i++) runFrame(t144, 1 / 144);
    expect(t60.tick).toBe(60);
    expect(Math.abs(t144.tick - 60)).toBeLessThanOrEqual(1);
  });

  it('limita el delta real por frame', () => {
    const t = new Time(60, 0.05);
    expect(runFrame(t, 1)).toBe(3);
    expect(t.alpha).toBeLessThan(1);
  });

  it('el hit-stop congela la simulación el tiempo real pedido', () => {
    const t = new Time(60, 0.05);
    t.hitStop(0.05);
    expect(runFrame(t, 0.03)).toBe(0);
    expect(t.frozen).toBe(true);
    // Quedan 0,02 s de hit-stop; el resto del frame (0,03) avanza la simulación.
    expect(runFrame(t, 0.05)).toBe(1);
    expect(t.frozen).toBe(false);
  });

  it('el hit-stop no se acumula: gana el más largo', () => {
    const t = new Time(60, 0.05);
    t.hitStop(0.05);
    t.hitStop(0.035);
    runFrame(t, 0.04);
    expect(t.frozen).toBe(true);
    runFrame(t, 0.01);
    expect(t.frozen).toBe(false);
  });

  it('un hit-stop pedido a mitad de frame frena los pasos que faltan', () => {
    const t = new Time(60, 0.05);
    t.beginFrame(0.05);
    expect(t.consumeStep()).toBe(true);
    t.hitStop(0.1);
    expect(t.consumeStep()).toBe(false);
  });

  it('timeScale ralentiza la simulación', () => {
    const t = new Time(60, 0.05);
    t.timeScale = 0.3;
    for (let i = 0; i < 60; i++) runFrame(t, 1 / 60);
    expect(t.simTime).toBeCloseTo(0.3, 1);
  });

  it('en pausa no simula pero el tiempo real sigue', () => {
    const t = new Time(60, 0.05);
    t.paused = true;
    expect(runFrame(t, 0.02)).toBe(0);
    expect(t.realTime).toBeCloseTo(0.02);
  });
});
