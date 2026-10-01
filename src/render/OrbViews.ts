import { IcosahedronGeometry, Mesh, MeshBasicMaterial, type Scene } from 'three';
import { ORBS } from '../data/waves';
import type { Orbs } from '../entities/Orbs';

const geo = new IcosahedronGeometry(0.2, 1);
const coreM = new MeshBasicMaterial({ color: 0x6dff9a });
const haloM = new MeshBasicMaterial({
  color: 0x6dff9a,
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
});

/** Un mesh por orbe del pool de la simulación; flotan, giran y titilan antes de desaparecer. */
export class OrbViews {
  private readonly meshes: Mesh[] = [];

  constructor(private readonly scene: Scene) {}

  update(orbs: Orbs, dt: number): void {
    while (this.meshes.length < orbs.pool.length) {
      const m = new Mesh(geo, coreM);
      const halo = new Mesh(geo, haloM);
      halo.scale.setScalar(1.9);
      m.add(halo);
      m.visible = false;
      this.scene.add(m);
      this.meshes.push(m);
    }
    for (let i = 0; i < orbs.pool.length; i++) {
      const o = orbs.pool[i];
      const m = this.meshes[i];
      if (!o || !m) continue;
      if (!o.active) {
        m.visible = false;
        continue;
      }
      m.position.set(o.x, orbs.heightAt(o), o.z);
      m.rotation.y += dt * 2;
      m.visible = o.t < ORBS.blinkAfter || Math.floor(o.t * 8) % 2 === 0;
    }
  }
}
