const KEY = 'furia-best';

export interface BestRecord {
  wave: number;
  kills: number;
}

/** Récord en localStorage. Si el almacenamiento no está disponible, el juego sigue sin récord. */
export function loadBest(): BestRecord {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { wave: 0, kills: 0 };
    const b = JSON.parse(raw) as Partial<BestRecord>;
    if (typeof b.wave === 'number' && typeof b.kills === 'number') {
      return { wave: b.wave, kills: b.kills };
    }
  } catch {
    // Almacenamiento bloqueado o dato corrupto.
  }
  return { wave: 0, kills: 0 };
}

export function saveBest(best: BestRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    // Almacenamiento bloqueado: el récord vale solo para esta sesión.
  }
}

/** Mejor oleada; a igual oleada, más bajas. */
export function isNewBest(best: BestRecord, run: BestRecord): boolean {
  return run.wave > best.wave || (run.wave === best.wave && run.kills > best.kills);
}
