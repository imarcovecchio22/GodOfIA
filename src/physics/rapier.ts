/**
 * Carga diferida de Rapier. La versión `-compat` trae el WASM embebido en base64 (~4 MB sin
 * comprimir), así que se importa dinámicamente para que quede fuera del bundle inicial.
 */
export type Rapier = (typeof import('@dimforge/rapier3d-compat'))['default'];

let pending: Promise<Rapier> | undefined;
let loaded: Rapier | undefined;

export function loadRapier(): Promise<Rapier> {
  pending ??= import('@dimforge/rapier3d-compat').then(async ({ default: rapier }) => {
    await rapier.init();
    loaded = rapier;
    return rapier;
  });
  return pending;
}

/** Rapier ya inicializado. Falla si todavía no terminó `loadRapier()`. */
export function rapier(): Rapier {
  if (!loaded) throw new Error('Rapier no está inicializado: esperá loadRapier()');
  return loaded;
}
