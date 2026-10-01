import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import './style.css';

import { Loop } from './core/Loop';
import { Time } from './core/Time';
import { loadRapier } from './physics/rapier';
import { DebugOverlay, debugEnabled } from './render/DebugOverlay';
import { Renderer } from './render/Renderer';
import { BootScene } from './scenes/BootScene';
import { needsDeviceNotice, showDeviceNotice } from './ui/DeviceNotice';

const app = document.getElementById('app');
if (!app) throw new Error('Falta #app en index.html');

const time = new Time();
const boot = new BootScene();
const renderer = new Renderer(app, boot.camera);
const overlay = debugEnabled() ? new DebugOverlay(app) : null;

const loop = new Loop(time, {
  update(step) {
    boot.update(step);
  },
  render(alpha, realDt) {
    boot.render(alpha);
    renderer.gl.render(boot.scene, boot.camera);
    overlay?.update(realDt, renderer.gl, loop.lastSteps);
  },
});
loop.start();

if (needsDeviceNotice()) showDeviceNotice(app);

overlay?.set('rapier', 'cargando…');
loadRapier()
  .then((rapier) => overlay?.set('rapier', `OK ${rapier.version()}`))
  .catch((err: unknown) => {
    overlay?.set('rapier', 'ERROR');
    console.error('No se pudo inicializar Rapier', err);
  });
