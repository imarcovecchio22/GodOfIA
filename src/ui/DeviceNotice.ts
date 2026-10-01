/** El juego pide mouse y teclado: en dispositivos sin puntero fino mostramos un aviso. */
export function needsDeviceNotice(): boolean {
  return !window.matchMedia('(pointer: fine)').matches && navigator.maxTouchPoints > 0;
}

export function showDeviceNotice(parent: HTMLElement): void {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = `
    <div class="card">
      <h1 class="display">Furia del Norte</h1>
      <p class="sub">Este juego pide mouse y teclado. Abrilo desde una computadora.</p>
      <button class="btn" type="button">Entrar igual</button>
    </div>`;
  el.querySelector('button')?.addEventListener('click', () => {
    el.remove();
  });
  parent.append(el);
}
