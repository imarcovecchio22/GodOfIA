import {
  Mesh,
  MeshBasicMaterial,
  SkinnedMesh,
  type AnimationClip,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/** Personaje cargado y preparado una sola vez; las instancias se clonan de acá. */
export interface CharacterTemplate {
  scene: Object3D;
  clips: AnimationClip[];
}

function meshesOf(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o as Mesh);
  });
  return out;
}

/**
 * Ajustes comunes a todos los personajes:
 * - Sombras: proyectan y reciben (los ojos no proyectan).
 * - Sin frustum culling: con skinning la caja del bind pose no sigue a la animación.
 */
export function prepareTemplate(gltf: GLTF): CharacterTemplate {
  for (const o of meshesOf(gltf.scene)) {
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
  }
  return { scene: gltf.scene, clips: gltf.animations };
}

export interface CharacterInstance {
  root: Object3D;
  /** Material del cuerpo, propio de la instancia (para el destello y el tinte). */
  body: MeshStandardMaterial;
  bodyMesh: SkinnedMesh;
  /** Material de los ojos, si el modelo los tiene aparte. */
  eyes: MeshBasicMaterial | null;
  eyesMesh: Mesh | null;
}

/** Clona un personaje con materiales propios. `eyesNode` pasa a un material plano que brilla. */
export function instantiate(
  template: CharacterTemplate,
  opts: { tint: number; eyesNode?: string; exclude?: string[] },
): CharacterInstance {
  const root = cloneSkinned(template.scene);
  let body: MeshStandardMaterial | null = null;
  let bodyMesh: SkinnedMesh | null = null;
  let eyes: MeshBasicMaterial | null = null;
  let eyesMesh: Mesh | null = null;
  const exclude = new Set(opts.exclude ?? []);
  for (const o of meshesOf(root)) {
    if (exclude.has(o.name)) continue;
    if (opts.eyesNode && o.name === opts.eyesNode) {
      // El material original lo comparte la plantilla: se reemplaza, no se libera.
      eyes = new MeshBasicMaterial({ color: 0xffffff });
      o.material = eyes;
      o.castShadow = false;
      eyesMesh = o;
      continue;
    }
    if (!(o instanceof SkinnedMesh)) continue;
    const m = (o.material as MeshStandardMaterial).clone();
    m.color.setHex(opts.tint);
    o.material = m;
    body = m;
    bodyMesh = o;
  }
  if (!body || !bodyMesh) throw new Error('El modelo no tiene un mesh con skinning');
  return { root, body, bodyMesh, eyes, eyesMesh };
}
