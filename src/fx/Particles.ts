import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Scene,
} from 'three';
import { FX, type BurstPreset } from '../data/fx';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const p = new Vector3();
const s = new Vector3();
const c = new Color();
const ZERO = new Matrix4().makeScale(0, 0, 0);

/**
 * Partículas cúbicas con pooling sobre un solo InstancedMesh (una draw call).
 * Estado en arreglos planos para no generar basura en el loop.
 */
export class Particles {
  private readonly mesh: InstancedMesh;
  private readonly cap: number;
  private readonly alive: Uint8Array;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly rot: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly gravity: Float32Array;
  private cursor = 0;

  constructor(scene: Scene, capacity = FX.maxParticles) {
    this.cap = capacity;
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, c.set(0xffffff));
    }
    scene.add(this.mesh);
    this.alive = new Uint8Array(capacity);
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.rot = new Float32Array(capacity * 2);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
  }

  private findFree(): number {
    for (let n = 0; n < this.cap; n++) {
      const i = (this.cursor + n) % this.cap;
      if (!this.alive[i]) {
        this.cursor = (i + 1) % this.cap;
        return i;
      }
    }
    return -1;
  }

  burst(x: number, y: number, z: number, b: BurstPreset, count = b.count): void {
    let colorDirty = false;
    for (let n = 0; n < count; n++) {
      const i = this.findFree();
      if (i < 0) break;
      this.alive[i] = 1;
      const i3 = i * 3;
      this.pos[i3] = x;
      this.pos[i3 + 1] = y;
      this.pos[i3 + 2] = z;
      p.set(Math.random() - 0.5, Math.random() * 0.8 + b.up, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(b.speed * rand(0.4, 1.2));
      this.vel[i3] = p.x;
      this.vel[i3 + 1] = p.y;
      this.vel[i3 + 2] = p.z;
      this.rot[i * 2] = rand(0, 3);
      this.rot[i * 2 + 1] = rand(0, 3);
      this.life[i] = this.maxLife[i] = b.life * rand(0.6, 1.2);
      this.size[i] = b.size * rand(0.6, 1.4);
      this.gravity[i] = b.gravity;
      this.mesh.setColorAt(i, c.setHex(b.color));
      colorDirty = true;
    }
    if (colorDirty && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** `dt` de simulación: las partículas se congelan durante el hit-stop, como en el prototipo. */
  update(dt: number): void {
    if (dt <= 0) return;
    let dirty = false;
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) continue;
      dirty = true;
      const i3 = i * 3;
      let vx = this.vel[i3] ?? 0;
      let vy = (this.vel[i3 + 1] ?? 0) - (this.gravity[i] ?? 0) * dt;
      let vz = this.vel[i3 + 2] ?? 0;
      const px = (this.pos[i3] ?? 0) + vx * dt;
      let py = (this.pos[i3 + 1] ?? 0) + vy * dt;
      const pz = (this.pos[i3 + 2] ?? 0) + vz * dt;
      if (py < FX.floorY) {
        py = FX.floorY;
        vy *= -FX.bounce;
        vx *= FX.floorFriction;
        vz *= FX.floorFriction;
      }
      this.vel[i3] = vx;
      this.vel[i3 + 1] = vy;
      this.vel[i3 + 2] = vz;
      this.pos[i3] = px;
      this.pos[i3 + 1] = py;
      this.pos[i3 + 2] = pz;
      const life = (this.life[i] ?? 0) - dt;
      this.life[i] = life;
      const rx = (this.rot[i * 2] ?? 0) + dt * FX.spinSpeed;
      this.rot[i * 2] = rx;
      if (life <= 0) {
        this.alive[i] = 0;
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      const sc = (this.size[i] ?? 0) * (life / (this.maxLife[i] ?? 1));
      q.setFromEuler(e.set(rx, this.rot[i * 2 + 1] ?? 0, 0));
      m4.compose(p.set(px, py, pz), q, s.set(sc, sc, sc));
      this.mesh.setMatrixAt(i, m4);
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.alive.fill(0);
    for (let i = 0; i < this.cap; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
