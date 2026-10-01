import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, type Scene } from 'three';
import { FX } from '../data/fx';

interface Ring {
  mesh: Mesh;
  material: MeshBasicMaterial;
  t: number;
  duration: number;
  maxRadius: number;
  active: boolean;
}

const geo = new RingGeometry(0.85, 1, 48);

/** Ondas expansivas sobre el piso, con pool fijo. */
export class Rings {
  private readonly pool: Ring[] = [];

  constructor(scene: Scene) {
    for (let i = 0; i < FX.maxRings; i++) {
      const material = new MeshBasicMaterial({
        transparent: true,
        opacity: FX.ringOpacity,
        side: DoubleSide,
        depthWrite: false,
      });
      const mesh = new Mesh(geo, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, material, t: 0, duration: 0, maxRadius: 0, active: false });
    }
  }

  spawn(x: number, z: number, color: number, maxRadius: number, duration: number): void {
    const r = this.pool.find((p) => !p.active);
    if (!r) return;
    r.active = true;
    r.t = 0;
    r.duration = duration;
    r.maxRadius = maxRadius;
    r.material.color.setHex(color);
    r.mesh.position.set(x, 0.05, z);
    r.mesh.visible = true;
    this.updateRing(r);
  }

  update(dt: number): void {
    for (const r of this.pool) {
      if (!r.active) continue;
      r.t += dt;
      this.updateRing(r);
    }
  }

  private updateRing(r: Ring): void {
    const u = r.t / r.duration;
    if (u >= 1) {
      r.active = false;
      r.mesh.visible = false;
      return;
    }
    r.mesh.scale.setScalar(0.5 + u * r.maxRadius);
    r.material.opacity = FX.ringOpacity * (1 - u);
  }

  clear(): void {
    for (const r of this.pool) {
      r.active = false;
      r.mesh.visible = false;
    }
  }
}
