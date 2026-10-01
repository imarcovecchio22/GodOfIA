/**
 * Bus de eventos tipado y sincrónico. Desacopla combate de audio, FX y HUD.
 * Los eventos son puntuales (golpes, muertes, oleadas), no por frame.
 */
export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, ((payload: never) => void)[]>();

  on<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): () => void {
    let list = this.listeners.get(type);
    if (!list) {
      list = [];
      this.listeners.set(type, list);
    }
    list.push(fn);
    return () => {
      const l = this.listeners.get(type);
      if (!l) return;
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    };
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const list = this.listeners.get(type);
    if (!list) return;
    for (const fn of list) (fn as (payload: Events[K]) => void)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
