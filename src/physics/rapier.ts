/**
 * Carga diferida de Rapier. La versión `-compat` trae el WASM embebido en base64 (~4 MB sin
 * comprimir), así que se importa dinámicamente para que quede fuera del bundle inicial.
 */
export type Rapier = (typeof import('@dimforge/rapier3d-compat'))['default'];

let pending: Promise<Rapier> | undefined;

export function loadRapier(): Promise<Rapier> {
  pending ??= import('@dimforge/rapier3d-compat').then(async ({ default: rapier }) => {
    await rapier.init();
    return rapier;
  });
  return pending;
}
