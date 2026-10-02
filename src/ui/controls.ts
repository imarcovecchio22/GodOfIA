/** Controles del juego: una sola lista para el menú y la pausa. */
const CONTROLS: [string, string][] = [
  ['WASD', 'moverse, con Shift corrés'],
  ['Mouse', 'cámara y puntería'],
  ['Click izquierdo', 'combo de tres hachazos'],
  ['Click derecho', 'golpe pesado contra el piso'],
  ['Q', 'tirar el hacha, congela al que toca'],
  ['Q o E', 'llamar al hacha de vuelta'],
  ['Espacio', 'rodar, sos invulnerable mientras rodás'],
  ['Tab o click del medio', 'fijar o soltar un objetivo'],
];

export function renderControls(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-controls]')) {
    el.replaceChildren(
      ...CONTROLS.flatMap(([key, desc]) => {
        const k = document.createElement('kbd');
        k.textContent = key;
        const s = document.createElement('span');
        s.textContent = desc;
        return [k, s];
      }),
    );
  }
}
