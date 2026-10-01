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

const game = new Game(app);

if (debugEnabled()) {
  const overlay = new DebugOverlay(app);
  game.overlay = overlay;
  // Rapier entra en la fase 2; mientras tanto, el overlay verifica que el WASM cargue.
  overlay.set('rapier', 'cargando…');
  loadRapier()
    .then((rapier) => {
      overlay.set('rapier', `OK ${rapier.version()}`);
    })
    .catch((err: unknown) => {
      overlay.set('rapier', 'ERROR');
      console.error('No se pudo inicializar Rapier', err);
    });
}

if (import.meta.env.DEV) {
  void import('./dev/tuningPanel').then(({ createTuningPanel }) => {
    createTuningPanel();
  });
}

if (needsDeviceNotice()) showDeviceNotice(app);

game.start();
