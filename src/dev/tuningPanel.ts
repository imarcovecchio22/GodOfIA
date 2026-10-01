import GUI from 'lil-gui';
import { HEAVY, LIGHT_COMBO, THROW, COMBAT } from '../data/attacks';
import { AXE } from '../data/axe';
import { CAMERA } from '../data/camera';
import { BRUTE, DRAUGR, ENEMY } from '../data/enemies';
import { ANIMATION, ENEMY_MODELS, PLAYER_MODEL } from '../data/models';
import { POSTFX } from '../data/graphics';
import { PLAYER } from '../data/player';
import { COMBO, ORBS, WAVES } from '../data/waves';

/** Agrega al panel todos los números y booleanos de un objeto (y sus subobjetos). */
function addAll(folder: GUI, obj: object): void {
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'number' || typeof value === 'boolean') {
      folder.add(record, key);
    } else if (value && typeof value === 'object') {
      // Los arreglos (ventanas activas) entran como objetos con claves "0", "1".
      addAll(folder.addFolder(key).close(), value);
    }
  }
}

/**
 * Panel de tuning (solo desarrollo). Edita en vivo los objetos de `src/data/`: los cambios se
 * aplican al próximo uso del valor (por ejemplo, la vida de un enemigo, al próximo spawn).
 */
export function createTuningPanel(onPostFx: () => void): GUI {
  const gui = new GUI({ title: 'Tuning' });
  gui.close();
  addAll(gui.addFolder('Jugador').close(), PLAYER);
  const combo = gui.addFolder('Ataques').close();
  for (const def of LIGHT_COMBO) addAll(combo.addFolder(def.id).close(), def);
  addAll(combo.addFolder(HEAVY.id).close(), HEAVY);
  addAll(combo.addFolder('throw').close(), THROW);
  addAll(combo.addFolder('general').close(), COMBAT);
  addAll(gui.addFolder('Hacha').close(), AXE);
  addAll(gui.addFolder('Draugr').close(), DRAUGR);
  addAll(gui.addFolder('Bruto').close(), BRUTE);
  addAll(gui.addFolder('Enemigos').close(), ENEMY);
  addAll(gui.addFolder('Oleadas').close(), WAVES);
  addAll(gui.addFolder('Orbes').close(), ORBS);
  addAll(gui.addFolder('Combo').close(), COMBO);
  addAll(gui.addFolder('Cámara').close(), CAMERA);
  const post = gui.addFolder('Post-procesado').close();
  addAll(post, POSTFX);
  post.onChange(onPostFx);
  const anim = gui.addFolder('Animación').close();
  addAll(anim.addFolder('Jugador').close(), PLAYER_MODEL);
  addAll(anim.addFolder('Draugr').close(), ENEMY_MODELS.draugr);
  addAll(anim.addFolder('Bruto').close(), ENEMY_MODELS.brute);
  addAll(anim.addFolder('General').close(), ANIMATION);
  return gui;
}
