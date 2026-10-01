import { describe, expect, it } from 'vitest';
import { Fsm, type StateTable } from './Fsm';

type S = 'a' | 'b';
interface Ctx {
  log: string[];
}

const table: StateTable<S, Ctx> = {
  a: {
    enter: (c) => c.log.push('enter a'),
    exit: (c) => c.log.push('exit a'),
    update: () => undefined,
  },
  b: {
    enter: (c) => c.log.push('enter b'),
    update: () => 'a',
  },
};

describe('Fsm', () => {
  it('acumula tiempo en el estado y lo reinicia al cambiar', () => {
    const ctx: Ctx = { log: [] };
    const fsm = new Fsm(table, 'a');
    fsm.update(ctx, 0.1);
    fsm.update(ctx, 0.1);
    expect(fsm.t).toBeCloseTo(0.2);
    fsm.go('b', ctx);
    expect(fsm.t).toBe(0);
    expect(ctx.log).toEqual(['exit a', 'enter b']);
  });

  it('transiciona según lo que devuelve update', () => {
    const ctx: Ctx = { log: [] };
    const fsm = new Fsm(table, 'b');
    fsm.update(ctx, 0.016);
    expect(fsm.state).toBe('a');
    expect(fsm.t).toBe(0);
  });
});
