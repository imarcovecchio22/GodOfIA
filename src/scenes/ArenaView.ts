import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  DoubleSide,
  FogExp2,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RepeatWrapping,
  RingGeometry,
  TorusGeometry,
  type Scene,
} from 'three';
import { ARENA, LIGHTING, pillarPositions, torchPositions } from '../data/arena';
import { box, cyl, mat } from '../render/primitives';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

const EMBER_COUNT = 260;
const EMBER_RADIUS = 26;
const EMBER_HEIGHT = 12;

interface Torch {
  light: PointLight;
  flame: Mesh;
  inner: Mesh;
  seed: number;
}

/** Textura procedural de losas de piedra (igual que en el prototipo). */
function stoneTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D no disponible');
  g.fillStyle = '#3a3d40';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = (40 + Math.random() * 30) | 0;
    g.fillStyle = `rgba(${v},${v + 2},${v + 5},0.5)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  g.strokeStyle = 'rgba(14,15,17,.85)';
  g.lineWidth = 3;
  let y = 0;
  while (y < 512) {
    const h = 48 + Math.random() * 40;
    let x = -Math.random() * 60;
    while (x < 512) {
      const w = 60 + Math.random() * 70;
      const v = (48 + Math.random() * 26) | 0;
      g.fillStyle = `rgba(${v},${v},${v + 4},0.28)`;
      g.fillRect(x + 2, y + 2, w - 4, h - 4);
      g.strokeRect(x, y, w, h);
      x += w;
    }
    y += h;
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(5, 5);
  t.anisotropy = 4;
  return t;
}

/**
 * Escenario estático: plataforma, runas, rocas y árboles instanciados, columnas, antorchas
 * con luces que titilan y brasas flotando.
 */
export class ArenaView {
  private readonly torches: Torch[] = [];
  private readonly emberGeo: BufferGeometry;

  constructor(scene: Scene) {
    const R = ARENA.radius;
    scene.background = new Color(LIGHTING.fogColor);
    scene.fog = new FogExp2(LIGHTING.fogColor, LIGHTING.fogDensity);

    scene.add(new HemisphereLight(LIGHTING.hemiSky, LIGHTING.hemiGround, LIGHTING.hemiIntensity));
    const moon = new DirectionalLight(LIGHTING.moonColor, LIGHTING.moonIntensity);
    moon.position.set(-14, 26, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, {
      left: -28,
      right: 28,
      top: 28,
      bottom: -28,
      near: 1,
      far: 80,
    });
    moon.shadow.bias = -0.0006;
    moon.shadow.radius = 2;
    scene.add(moon);

    // Piso exterior y plataforma.
    const outer = new Mesh(new CircleGeometry(80, 48), mat(0x1f2420, { roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.3;
    outer.receiveShadow = true;
    scene.add(outer);
    const plat = new Mesh(
      new CylinderGeometry(R, R + 0.8, 0.6, 64),
      mat(0x8a8d92, { map: stoneTexture(), roughness: 0.95 }),
    );
    plat.position.y = -0.3;
    plat.receiveShadow = true;
    scene.add(plat);

    // Runas: tres anillos y 16 marcas instanciadas.
    const runeMat = new MeshBasicMaterial({
      color: 0x4fc6d8,
      transparent: true,
      opacity: 0.45,
      side: DoubleSide,
      depthWrite: false,
    });
    for (const [a, b] of [
      [3, 3.12],
      [4.2, 4.28],
      [R - 1.2, R - 1.05],
    ] as const) {
      const m = new Mesh(new RingGeometry(a, b, 96), runeMat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.012;
      scene.add(m);
    }
    const marks = new InstancedMesh(new PlaneGeometry(0.12, 0.5), runeMat, 16);
    const dummy = new Object3D();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      dummy.position.set(Math.sin(a) * 3.65, 0.013, Math.cos(a) * 3.65);
      dummy.rotation.set(-Math.PI / 2, 0, a);
      dummy.updateMatrix();
      marks.setMatrixAt(i, dummy.matrix);
    }
    scene.add(marks);

    // Rocas del borde (una draw call).
    const rocks = new InstancedMesh(
      new DodecahedronGeometry(1, 0),
      mat(0x4a4d52, { roughness: 1, flatShading: true }),
      46,
    );
    rocks.castShadow = rocks.receiveShadow = true;
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rand(-0.05, 0.05);
      const r = R + rand(0.6, 3.2);
      const s = rand(0.8, 2.4);
      dummy.position.set(Math.sin(a) * r, s * 0.35, Math.cos(a) * r);
      dummy.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    scene.add(rocks);

    // Bosque (una draw call). Cono unitario escalado por instancia.
    const trees = new InstancedMesh(
      new ConeGeometry(0.28, 1, 7),
      new MeshLambertMaterial({ color: 0x111a18 }),
      70,
    );
    const m4 = new Matrix4();
    for (let i = 0; i < 70; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(30, 55);
      const h = rand(6, 13);
      m4.makeScale(h, h, h).setPosition(Math.sin(a) * r, h / 2 - 0.3, Math.cos(a) * r);
      trees.setMatrixAt(i, m4);
    }
    scene.add(trees);

    // Columnas.
    const pillarM = mat(0x55595f, { roughness: 0.95 });
    const glowM = new MeshBasicMaterial({ color: 0x5fd4e6 });
    for (const p of pillarPositions()) {
      const col = cyl(0.8, 0.95, 4.6, pillarM, 9);
      col.position.set(p.x, 2.3, p.z);
      scene.add(col);
      const cap = box(2.1, 0.4, 2.1, pillarM);
      cap.position.set(p.x, 4.75, p.z);
      scene.add(cap);
      const ring = new Mesh(new TorusGeometry(0.84, 0.045, 6, 28), glowM);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, 2.1, p.z);
      scene.add(ring);
    }

    // Antorchas.
    const darkM = mat(0x2a2522);
    const bowlM = mat(0x6a5a48, { metalness: 0.5 });
    const flameM = new MeshBasicMaterial({ color: 0xffa040 });
    const flameInM = new MeshBasicMaterial({ color: 0xfff0b0 });
    for (const t of torchPositions()) {
      const pole = cyl(0.07, 0.09, 2.3, darkM, 6);
      pole.position.set(t.x, 1.15, t.z);
      scene.add(pole);
      const bowl = cyl(0.3, 0.14, 0.22, bowlM, 8);
      bowl.position.set(t.x, 2.36, t.z);
      scene.add(bowl);
      const flame = new Mesh(new ConeGeometry(0.2, 0.6, 7), flameM);
      flame.position.set(t.x, 2.7, t.z);
      scene.add(flame);
      const inner = new Mesh(new ConeGeometry(0.1, 0.35, 6), flameInM);
      inner.position.set(t.x, 2.62, t.z);
      scene.add(inner);
      const light = new PointLight(
        LIGHTING.torchColor,
        LIGHTING.torchIntensity,
        LIGHTING.torchDistance,
        1,
      );
      light.position.set(t.x, 2.9, t.z);
      scene.add(light);
      this.torches.push({ light, flame, inner, seed: rand(0, 10) });
    }

    // Brasas flotando.
    const pos = new Float32Array(EMBER_COUNT * 3);
    for (let i = 0; i < EMBER_COUNT; i++) {
      const a = rand(0, 6.28);
      const r = Math.sqrt(Math.random()) * EMBER_RADIUS;
      pos[i * 3] = Math.sin(a) * r;
      pos[i * 3 + 1] = rand(0, EMBER_HEIGHT);
      pos[i * 3 + 2] = Math.cos(a) * r;
    }
    this.emberGeo = new BufferGeometry();
    this.emberGeo.setAttribute('position', new BufferAttribute(pos, 3));
    scene.add(
      new Points(
        this.emberGeo,
        new PointsMaterial({
          color: 0xffa850,
          size: 0.09,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      ),
    );
  }

  /** Brasas y antorchas: corren en tiempo real, también durante el hit-stop. */
  update(dt: number, time: number): void {
    const attr = this.emberGeo.getAttribute('position') as BufferAttribute;
    const p = attr.array as Float32Array;
    for (let i = 0; i < EMBER_COUNT; i++) {
      const y = i * 3 + 1;
      p[y] = (p[y] ?? 0) + dt * (0.3 + (i % 5) * 0.1);
      p[i * 3] = (p[i * 3] ?? 0) + Math.sin(time + i) * dt * 0.2;
      if ((p[y] ?? 0) > EMBER_HEIGHT) p[y] = 0;
    }
    attr.needsUpdate = true;
    for (const t of this.torches) {
      const f =
        Math.sin(time * 13 + t.seed) * 0.18 +
        Math.sin(time * 7.3 + t.seed * 2) * 0.12 +
        Math.random() * 0.1;
      t.light.intensity = LIGHTING.torchIntensity + f * LIGHTING.torchFlicker;
      t.flame.scale.set(1, 1 + f * 0.8, 1);
      t.inner.scale.set(1, 1 + f, 1);
    }
  }
}
