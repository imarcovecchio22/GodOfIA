import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterialParameters,
} from 'three';

/** Helpers para el greybox con primitivas, iguales a los del prototipo. */
export function mat(
  color: number,
  params: MeshStandardMaterialParameters = {},
): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.82, ...params });
}

export function shadowed<T extends Mesh>(m: T): T {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function mesh(geo: BufferGeometry, material: Material): Mesh {
  return shadowed(new Mesh(geo, material));
}

export function box(w: number, h: number, d: number, material: Material): Mesh {
  return mesh(new BoxGeometry(w, h, d), material);
}

export function cyl(rt: number, rb: number, h: number, material: Material, seg = 10): Mesh {
  return mesh(new CylinderGeometry(rt, rb, h, seg), material);
}

export function sph(r: number, material: Material, seg = 12): Mesh {
  return mesh(new SphereGeometry(r, seg, Math.max(6, (seg * 0.75) | 0)), material);
}
