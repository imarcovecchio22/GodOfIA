/**
 * Analiza los clips de ataque de los GLB generados: muestrea la trayectoria de la mano derecha
 * (`handslot.r`) y reporta cuándo va más rápido y cuándo está más baja. Sirve para elegir el
 * cuadro de contacto de cada clip (`contact` en `src/data/animations.ts`).
 *
 * Uso: `node scripts/analyze-clips.mjs [personaje] [clip]`.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [onlyChar, onlyClip] = process.argv.slice(2);
const ATTACKS = /Attack|Throw|Spawn|Death|Hit|Dodge|Spellcast|PickUp|Jump|Taunt/;

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

/** GLB sin texturas ni compresión, para que GLTFLoader lo lea en Node. */
async function loadForNode(file) {
  const doc = await io.read(file);
  for (const t of doc.getRoot().listTextures()) t.dispose();
  for (const ext of doc.getRoot().listExtensionsUsed()) ext.dispose();
  const glb = await io.writeBinary(doc);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength),
      '',
      resolve,
      reject,
    );
  });
}

for (const name of ['barbarian', 'draugr', 'brute', 'jarl']) {
  if (onlyChar && name !== onlyChar) continue;
  const gltf = await loadForNode(join(ROOT, 'src', 'assets', 'models', `${name}.glb`));
  const scene = gltf.scene;
  // Three saca los puntos de los nombres de nodo: 'handslot.r' → 'handslotr'.
  const hand = scene.getObjectByName('handslotr');
  const mixer = new AnimationMixer(scene);
  console.log(`\n=== ${name}`);
  for (const clip of gltf.animations) {
    if (onlyClip ? clip.name !== onlyClip : !ATTACKS.test(clip.name)) continue;
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).play();
    action.paused = true;
    const dt = 1 / 120;
    const prev = new Vector3();
    const p = new Vector3();
    let peak = { t: 0, v: 0 };
    let low = { t: 0, y: Infinity };
    const rows = [];
    for (let t = 0; t <= clip.duration + 1e-6; t += dt) {
      action.time = t;
      mixer.update(0);
      scene.updateMatrixWorld(true);
      hand.getWorldPosition(p);
      if (t > 0) {
        const v = p.distanceTo(prev) / dt;
        if (v > peak.v) peak = { t, v };
      }
      if (p.y < low.y) low = { t, y: p.y };
      prev.copy(p);
      if (Math.abs(t / 0.05 - Math.round(t / 0.05)) < 1e-3) {
        rows.push(`${t.toFixed(2)}:(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`);
      }
    }
    console.log(
      `${clip.name.padEnd(34)} dur ${clip.duration.toFixed(3)}  mano más rápida ${peak.t.toFixed(3)} (${peak.v.toFixed(1)} u/s)  más baja ${low.t.toFixed(3)} (y ${low.y.toFixed(2)})`,
    );
    if (onlyClip) console.log(rows.join('  '));
  }
}
