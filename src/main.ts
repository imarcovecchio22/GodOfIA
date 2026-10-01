// Primero: apaga la gestión de color antes de que cualquier módulo cree materiales.
import './render/colorSetup';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import './style.css';

import { Game } from './Game';
import { loadRapier } from './physics/rapier';
import { DebugOverlay, debugEnabled } from './render/DebugOverlay';
import { needsDeviceNotice, showDeviceNotice } from './ui/DeviceNotice';

const app = document.getElementById('app');
if (!app) throw new Error('Falta #app en index.html');

if (needsDeviceNotice()) showDeviceNotice(app);

// El menú (HTML estático) ya se ve; el botón de entrar se habilita cuando la física está lista.
let rapier;
try {
  rapier = await loadRapier();
} catch (err: unknown) {
  const start = document.getElementById('startBtn');
  if (start) start.textContent = 'No se pudo cargar el juego. Recargá la página.';
  throw err;
}

const game = new Game(app, rapier);

if (debugEnabled()) {
  const overlay = new DebugOverlay(app);
  game.overlay = overlay;
  overlay.set('rapier', rapier.version());
}

if (import.meta.env.DEV) {
  void import('./dev/tuningPanel').then(({ createTuningPanel }) => {
    createTuningPanel();
  });
}

game.start();
