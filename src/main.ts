// Primero: apaga la gestión de color antes de que cualquier módulo cree materiales.
import './render/colorSetup';
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

// El menú (HTML estático) ya se ve; el botón de entrar muestra el progreso real de la carga y se
// habilita cuando todo está listo.
const startBtn = document.getElementById('startBtn');
const loader = new AssetLoader((f) => {
  if (startBtn) startBtn.textContent = `Cargando… ${Math.round(f * 100)}%`;
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
  if (startBtn) startBtn.textContent = 'No se pudo cargar el juego. Recargá la página.';
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

if (import.meta.env.DEV) {
  void import('./dev/tuningPanel').then(({ createTuningPanel }) => {
    createTuningPanel();
  });
}

game.start();
