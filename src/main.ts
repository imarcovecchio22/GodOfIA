import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import './style.css';

import { MODEL_URLS } from './assets';
import { AssetLoader } from './core/AssetLoader';
import { Game } from './Game';
import { loadRapier } from './physics/rapier';
import { prepareTemplate } from './render/characters';
import { DebugOverlay, debugEnabled } from './render/DebugOverlay';
import { needsDeviceNotice, showDeviceNotice } from './ui/DeviceNotice';

const app = document.getElementById('app');
if (!app) throw new Error('Falta #app en index.html');

if (needsDeviceNotice()) showDeviceNotice(app);

// Pantalla de carga con progreso real (física + modelos). El audio se baja después, en diferido.
const loading = document.getElementById('loading');
const loadingFill = document.getElementById('loadingFill');
const loadingTxt = document.getElementById('loadingTxt');
const loader = new AssetLoader((f) => {
  const pct = Math.round(f * 100);
  if (loadingFill) loadingFill.style.transform = `scaleX(${f.toFixed(3)})`;
  if (loadingTxt) loadingTxt.textContent = `${pct}%`;
  loading?.setAttribute('aria-valuenow', String(pct));
});
let assets;
try {
  const [rapier, player, draugr, brute] = await Promise.all([
    loader.task(loadRapier()),
    loader.gltfModel(MODEL_URLS.barbarian),
    loader.gltfModel(MODEL_URLS.draugr),
    loader.gltfModel(MODEL_URLS.brute),
  ]);
  assets = {
    rapier,
    player: prepareTemplate(player),
    enemies: { draugr: prepareTemplate(draugr), brute: prepareTemplate(brute) },
  };
} catch (err: unknown) {
  if (loadingTxt) loadingTxt.textContent = 'No se pudo cargar el juego. Recargá la página.';
  throw err;
}

const game = new Game(app, assets);

declare global {
  interface Window {
    /** Solo con debug activo: acceso al juego desde la consola y los tests de navegador. */
    __furia?: Game;
  }
}

if (debugEnabled()) {
  window.__furia = game;
  const overlay = new DebugOverlay(app);
  game.overlay = overlay;
  overlay.set('rapier', assets.rapier.version());
}

// Atajo de desarrollo: F8 salta a la oleada del jefe (también en la preview con ?debug).
if (import.meta.env.DEV || debugEnabled()) {
  window.addEventListener('keydown', (ev) => {
    if (ev.code !== 'F8') return;
    ev.preventDefault();
    game.devJumpToBoss();
  });
}

if (import.meta.env.DEV) {
  void import('./dev/tuningPanel').then(({ createTuningPanel }) => {
    createTuningPanel(() => {
      game.renderer.post.syncTuning();
    });
  });
}

game.start();
loading?.classList.add('fade-out');
