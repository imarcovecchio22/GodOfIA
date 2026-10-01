import { describe, expect, it } from 'vitest';
import { EventBus } from './EventBus';

interface TestEvents {
  ping: { n: number };
  pong: undefined;
}

describe('EventBus', () => {
  it('entrega el payload a todos los suscriptores', () => {
    const bus = new EventBus<TestEvents>();
    const got: number[] = [];
    bus.on('ping', (p) => got.push(p.n));
    bus.on('ping', (p) => got.push(p.n * 10));
    bus.emit('ping', { n: 2 });
    expect(got).toEqual([2, 20]);
  });

  it('permite desuscribirse', () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    const off = bus.on('pong', () => count++);
    bus.emit('pong', undefined);
    off();
    bus.emit('pong', undefined);
    expect(count).toBe(1);
  });
});
