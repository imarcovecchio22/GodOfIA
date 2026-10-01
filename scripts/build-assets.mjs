/**
 * Pipeline de assets: descarga los packs CC0 de KayKit (commits fijos) y genera los GLB del juego
 * en `src/assets/models/`.
 *
 * Por personaje:
 *  1. Saca los accesorios que no usamos y cuelga armas de la mano.
 *  2. Une todas las piezas en un solo mesh con skinning (las piezas rígidas se pegan a su hueso con
 *     peso 1), para que cada personaje sea una draw call. Algunas piezas quedan aparte a propósito
 *     (el hacha del jugador, que se lanza; los ojos de los esqueletos, que cambian de color).
 *  3. Se queda solo con las animaciones que usa el juego y les saca el desplazamiento de la raíz
 *     (la posición la maneja la simulación).
 *  4. Comprime con Meshopt.
 *
 * Uso: `npm run assets`. Los GLB generados se commitean; la caché de descargas no.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, joinPrimitives, meshopt, mergeDocuments, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { Matrix3, Matrix4, Vector3 } from 'three';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.asset-cache');
const OUT = join(ROOT, 'src', 'assets', 'models');

const PACKS = {
  adventurers: {
    repo: 'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0',
    sha: '672074b73ba276876a19e8816ecdc5241817ab47',
    base: 'addons/kaykit_character_pack_adventures',
  },
  skeletons: {
    repo: 'KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0',
    sha: '15b62b9bad122f72926c10fb14d622c73819fa54',
    base: 'addons/kaykit_character_pack_skeletons',
  },
};

/** Clips compartidos por los dos esqueletos. */
const SKELETON_CLIPS = [
  'Idle_Combat',
  'Walking_D_Skeletons',
  'Running_C',
  'Hit_A',
  'Death_C_Skeletons',
  'Spawn_Ground_Skeletons',
];

const CHARACTERS = [
  {
    out: 'barbarian',
    pack: 'adventurers',
    file: 'Characters/gltf/Barbarian.glb',
    // Sin gorro ni capa: desde la cámara sobre el hombro tapaban toda la animación.
    remove: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '2H_Axe', 'Mug', 'Barbarian_Cape'],
    separate: ['1H_Axe'],
    attach: [],
    clips: [
      'Idle',
      'Walking_A',
      'Running_A',
      '1H_Melee_Attack_Slice_Diagonal',
      '1H_Melee_Attack_Slice_Horizontal',
      '1H_Melee_Attack_Chop',
      '2H_Melee_Attack_Chop',
      'Throw',
      'Dodge_Forward',
      'Hit_A',
      'Death_A',
      '1H_Ranged_Aiming',
    ],
    rootMotion: [],
  },
  {
    out: 'draugr',
    pack: 'skeletons',
    file: 'Characters/gltf/Skeleton_Minion.glb',
    remove: [],
    separate: ['Skeleton_Minion_Eyes'],
    attach: [{ file: 'Assets/gltf/Skeleton_Blade.gltf', bone: 'handslot.r' }],
    clips: [...SKELETON_CLIPS, '1H_Melee_Attack_Chop'],
    rootMotion: ['Spawn_Ground_Skeletons', 'Death_C_Skeletons'],
  },
  {
    out: 'brute',
    pack: 'skeletons',
    file: 'Characters/gltf/Skeleton_Warrior.glb',
    remove: [],
    separate: ['Skeleton_Warrior_Eyes'],
    attach: [{ file: 'Assets/gltf/Skeleton_Axe.gltf', bone: 'handslot.r' }],
    clips: [...SKELETON_CLIPS, '2H_Melee_Attack_Chop'],
    rootMotion: ['Spawn_Ground_Skeletons', 'Death_C_Skeletons'],
  },
];

// ───────────────────────── Descarga con caché ─────────────────────────

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchToCache(packName, relPath) {
  const pack = PACKS[packName];
  const local = join(CACHE, packName, relPath);
  if (await exists(local)) return local;
  const url = `https://raw.githubusercontent.com/${pack.repo}/${pack.sha}/${pack.base}/${relPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: ${res.status}`);
  await mkdir(dirname(local), { recursive: true });
  await writeFile(local, Buffer.from(await res.arrayBuffer()));
  console.log(`  descargado ${packName}/${relPath}`);
  return local;
}

/** Un .gltf trae su .bin y texturas al lado: los baja también. */
async function fetchGltfWithResources(packName, relPath) {
  const local = await fetchToCache(packName, relPath);
  if (!relPath.endsWith('.gltf')) return local;
  const json = JSON.parse(await readFile(local, 'utf8'));
  const dir = dirname(relPath);
  const uris = [...(json.buffers ?? []), ...(json.images ?? [])]
    .map((x) => x.uri)
    .filter((u) => u && !u.startsWith('data:'));
  for (const uri of uris) await fetchToCache(packName, `${dir}/${decodeURIComponent(uri)}`);
  return local;
}

// ───────────────────────── Transformaciones ─────────────────────────

const toM4 = (arr) => new Matrix4().fromArray(arr);

function findNode(doc, name) {
  const n = doc
    .getRoot()
    .listNodes()
    .find((x) => x.getName() === name);
  if (!n) throw new Error(`No existe el nodo ${name}`);
  return n;
}

/** Hueso más cercano hacia arriba en la jerarquía. */
function nearestJoint(node, joints) {
  for (let n = node.getParentNode(); n; n = n.getParentNode()) if (joints.includes(n)) return n;
  return null;
}

/**
 * Convierte un mesh rígido colgado de un hueso en geometría con skinning sobre ese hueso, en el
 * espacio de bind del skin: v' = IBM⁻¹ · (huesoMundo⁻¹ · nodoMundo) · v.
 */
function bakeRigidIntoSkin(doc, node, skin) {
  const joints = skin.listJoints();
  const bone = nearestJoint(node, joints);
  if (!bone) throw new Error(`${node.getName()} no cuelga de ningún hueso`);
  const j = joints.indexOf(bone);
  const ibm = skin.getInverseBindMatrices();
  const ibmJ = toM4(Array.from(ibm.getArray().slice(j * 16, j * 16 + 16)));
  const offset = toM4(bone.getWorldMatrix()).invert().multiply(toM4(node.getWorldMatrix()));
  const m = ibmJ.clone().invert().multiply(offset);
  const nm = new Matrix3().getNormalMatrix(m);
  const v = new Vector3();
  const prims = [];
  for (const prim of node.getMesh().listPrimitives()) {
    const p = prim.clone();
    const pos = p.getAttribute('POSITION').clone();
    const arr = pos.getArray();
    for (let i = 0; i < arr.length; i += 3) {
      v.set(arr[i], arr[i + 1], arr[i + 2]).applyMatrix4(m);
      arr.set([v.x, v.y, v.z], i);
    }
    p.setAttribute('POSITION', pos);
    const nor = p.getAttribute('NORMAL')?.clone();
    if (nor) {
      const a = nor.getArray();
      for (let i = 0; i < a.length; i += 3) {
        v.set(a[i], a[i + 1], a[i + 2])
          .applyMatrix3(nm)
          .normalize();
        a.set([v.x, v.y, v.z], i);
      }
      p.setAttribute('NORMAL', nor);
    }
    const count = pos.getCount();
    const jointsArr = new Uint16Array(count * 4);
    const weightsArr = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      jointsArr[i * 4] = j;
      weightsArr[i * 4] = 1;
    }
    const buffer = doc.getRoot().listBuffers()[0];
    p.setAttribute(
      'JOINTS_0',
      doc.createAccessor().setType('VEC4').setArray(jointsArr).setBuffer(buffer),
    );
    p.setAttribute(
      'WEIGHTS_0',
      doc.createAccessor().setType('VEC4').setArray(weightsArr).setBuffer(buffer),
    );
    prims.push(p);
  }
  return prims;
}

/** JOINTS_0 en u16 y WEIGHTS_0 en f32 para que todas las primitivas sean compatibles al unirlas. */
function normalizeSkinAttributes(doc, prim) {
  const buffer = doc.getRoot().listBuffers()[0];
  const jo = prim.getAttribute('JOINTS_0');
  if (jo && !(jo.getArray() instanceof Uint16Array)) {
    prim.setAttribute(
      'JOINTS_0',
      jo.clone().setArray(new Uint16Array(jo.getArray())).setBuffer(buffer),
    );
  }
  const we = prim.getAttribute('WEIGHTS_0');
  if (we && !(we.getArray() instanceof Float32Array)) {
    const src = we.getArray();
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) out[i] = we.getNormalized() ? src[i] / 255 : src[i];
    prim.setAttribute('WEIGHTS_0', we.clone().setArray(out).setNormalized(false).setBuffer(buffer));
  }
}

/**
 * Saca los canales de animación que nunca se mueven de la pose de reposo del nodo: no cambian
 * nada y cada uno cuesta dos accessors en el JSON del GLB.
 */
function removeRestPoseChannels(root) {
  const EPS = 1e-4;
  let removed = 0;
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      const path = ch.getTargetPath();
      const rest =
        path === 'translation'
          ? node.getTranslation()
          : path === 'rotation'
            ? node.getRotation()
            : path === 'scale'
              ? node.getScale()
              : null;
      if (!rest) continue;
      const out = ch.getSampler().getOutput().getArray();
      const n = rest.length;
      let still = true;
      for (let i = 0; i < out.length && still; i++) {
        let d = Math.abs(out[i] - rest[i % n]);
        // q y −q son la misma rotación.
        if (path === 'rotation') d = Math.min(d, Math.abs(out[i] + rest[i % n]));
        if (d > EPS) still = false;
      }
      if (still) {
        const sampler = ch.getSampler();
        ch.dispose();
        sampler.dispose();
        removed++;
      }
    }
  }
  return removed;
}

async function buildCharacter(io, c) {
  console.log(`\n${c.out}`);
  const doc = await io.read(await fetchGltfWithResources(c.pack, c.file));
  const root = doc.getRoot();
  const skin = root.listSkins()[0];

  // 1. Accesorios.
  for (const name of c.remove) findNode(doc, name).dispose();
  for (const a of c.attach) {
    const weaponDoc = await io.read(await fetchGltfWithResources(c.pack, a.file));
    const before = new Set(root.listNodes());
    mergeDocuments(doc, weaponDoc);
    const bone = findNode(doc, a.bone);
    for (const n of root.listNodes()) {
      if (!before.has(n) && n.getMesh() && !n.getParentNode()) bone.addChild(n);
    }
    for (const s of root.listScenes().slice(1)) s.dispose();
  }
  // Una sola copia de cada textura y material (las armas traen la suya).
  await doc.transform(dedup());

  // 2. Unión en un solo mesh con skinning.
  const separate = new Set(c.separate);
  const meshNodes = root.listNodes().filter((n) => n.getMesh());
  const skinnedNodes = meshNodes.filter((n) => n.getSkin() && !separate.has(n.getName()));
  const rigidNodes = meshNodes.filter((n) => !n.getSkin() && !separate.has(n.getName()));
  const prims = [];
  for (const n of skinnedNodes) prims.push(...n.getMesh().listPrimitives());
  for (const n of rigidNodes) prims.push(...bakeRigidIntoSkin(doc, n, skin));
  for (const p of prims) normalizeSkinAttributes(doc, p);
  for (const p of prims) {
    for (const sem of p.listSemantics()) {
      if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'].includes(sem)) {
        p.setAttribute(sem, null);
      }
    }
  }
  const joined = joinPrimitives(prims);
  const body = doc
    .createNode(`${c.out}_body`)
    .setMesh(doc.createMesh(`${c.out}_body`).addPrimitive(joined))
    .setSkin(skin);
  const parent = skinnedNodes[0].getParentNode();
  parent.addChild(body);
  for (const n of [...skinnedNodes, ...rigidNodes]) n.dispose();

  // 3. Animaciones.
  const keep = new Set(c.clips);
  for (const anim of root.listAnimations()) {
    if (!keep.has(anim.getName())) {
      // Borrar la animación no borra sus samplers: si quedan, retienen sus accessors.
      for (const ch of anim.listChannels()) ch.dispose();
      for (const sm of anim.listSamplers()) sm.dispose();
      anim.dispose();
      continue;
    }
    keep.delete(anim.getName());
    for (const ch of anim.listChannels()) {
      const target = ch.getTargetNode();
      if (!target) {
        ch.dispose();
        continue;
      }
      // Sin root motion horizontal: la simulación mueve al personaje.
      if (
        target.getName() === 'root' &&
        ch.getTargetPath() === 'translation' &&
        !c.rootMotion.includes(anim.getName())
      ) {
        const out = ch.getSampler().getOutput().clone();
        const a = out.getArray();
        for (let i = 0; i < a.length; i += 3) {
          a[i] = 0;
          a[i + 2] = 0;
        }
        ch.getSampler().setOutput(out);
      }
    }
  }
  if (keep.size > 0) throw new Error(`Faltan clips en ${c.out}: ${[...keep].join(', ')}`);
  const removed = removeRestPoseChannels(root);
  console.log(`  canales sin efecto eliminados: ${removed}`);

  // 4. Limpieza y compresión.
  await MeshoptEncoder.ready;
  await doc.transform(
    // Sin resample(): con tiempos densos todos los canales de un clip comparten el mismo arreglo
    // de tiempos (dedup), y meshopt comprime mejor los datos uniformes.
    prune(),
    dedup(),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
    // La cuantización de meshopt deja accessors huérfanos: otra pasada los saca.
    prune(),
  );

  const outPath = join(OUT, `${c.out}.glb`);
  await mkdir(OUT, { recursive: true });
  await io.write(outPath, doc);
  const size = (await stat(outPath)).size;
  const meshes = root.listMeshes().map((m) => m.getName());
  console.log(
    `  → ${outPath} ${(size / 1024).toFixed(0)} KB, meshes: ${meshes.join(', ')}, clips: ${root.listAnimations().length}`,
  );
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

for (const c of CHARACTERS) await buildCharacter(io, c);
