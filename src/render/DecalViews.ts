import {
  AdditiveBlending,
  Color,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  type Scene,
} from 'three';
import type { AreaShape } from '../combat/areas';
import { DECALS } from '../data/bossView';
import type { Hazards } from '../game/Hazards';
import type { Telegraphs } from '../game/Telegraphs';

const KIND = { arc: 0, circle: 1, line: 2, ring: 3 } as const;
const STYLE = { telegraph: 0, burn: 1, cold: 2 } as const;

/**
 * El área se evalúa en el fragment shader con la misma forma que usa `areaContains`, así que el
 * decal muestra exactamente lo que pega. Un quad horizontal por aviso, sin regenerar geometría.
 */
const vertexShader = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragmentShader = /* glsl */ `
  uniform int uKind;
  uniform int uStyle;
  uniform vec2 uOrigin;
  uniform float uDir;
  uniform vec2 uParams;
  uniform float uProgress;
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uLevels;
  uniform float uEdge;
  uniform float uBand;
  varying vec2 vWorld;

  // Ruido barato para las grietas y la escarcha.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    vec2 d = vWorld - uOrigin;
    float len = length(d);
    vec2 f = vec2(sin(uDir), cos(uDir));
    float along = dot(d, f);
    float side = d.x * f.y - d.y * f.x;

    // Distancia con signo al borde del área (negativa adentro) y avance radial de la carga.
    float sd; float reach;
    if (uKind == 0) {
      float ang = acos(clamp(along / max(len, 1e-4), -1.0, 1.0)) - uParams.y * 0.5;
      sd = max(len - uParams.x, ang * len);
      reach = len / uParams.x;
    } else if (uKind == 1) {
      sd = len - uParams.x;
      reach = len / max(uParams.x, 1e-4);
    } else if (uKind == 2) {
      sd = max(max(-along, along - uParams.x), abs(side) - uParams.y * 0.5);
      reach = along / uParams.x;
    } else {
      sd = max(uParams.x - len, len - uParams.y);
      reach = 1.0;
    }
    if (sd > uEdge) discard;

    float inside = 1.0 - smoothstep(-uEdge * 0.25, 0.0, sd);
    float edge = 1.0 - smoothstep(0.0, uEdge, abs(sd + uEdge * 0.5));
    float a;
    vec3 col = uColor;
    if (uStyle == 0) {
      // Se llena desde el origen hacia afuera a medida que se acerca el golpe; parpadea al final.
      float charged = step(reach, uProgress);
      float pulse = uProgress > 0.8 ? 0.5 + 0.5 * sin(uTime * 40.0) : 0.0;
      a = inside * (uLevels.x + uLevels.y * charged) + edge * uLevels.z;
      col *= 1.0 + pulse * 0.6;
    } else if (uStyle == 1) {
      float cracks = smoothstep(0.62, 0.7, noise(vWorld * 2.6)) + smoothstep(0.55, 0.62, noise(vWorld * 5.3 + 7.0)) * 0.6;
      float fade = 1.0 - smoothstep(0.75, 1.0, uProgress);
      a = (inside * (uLevels.x + cracks * 0.7) + edge * uLevels.z * 0.6) * fade;
    } else {
      float depth = clamp((len - uParams.x) / uBand, 0.0, 1.0);
      float frost = 0.6 + 0.4 * noise(vWorld * 1.7 + uTime * 0.05);
      a = inside * uLevels.x * (0.35 + 0.65 * depth) * frost + edge * uLevels.z;
    }
    gl_FragColor = vec4(col * a, a);
  }
`;

function makeUniforms() {
  return {
    uKind: { value: 0 },
    uStyle: { value: 0 },
    uOrigin: { value: new Vector2() },
    uDir: { value: 0 },
    uParams: { value: new Vector2() },
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uColor: { value: new Color() },
    uLevels: { value: new Color() },
    uEdge: { value: DECALS.edgeWidth },
    uBand: { value: 1 },
  };
}

interface Slot {
  mesh: Mesh;
  u: ReturnType<typeof makeUniforms>;
}

const geo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const tmpColor = new Color();

/** Avisos y zonas de peligro dibujados en el piso, con pool fijo. Solo lee la simulación. */
export class DecalViews {
  private readonly slots: Slot[] = [];
  private used = 0;

  constructor(scene: Scene) {
    for (let i = 0; i < DECALS.max; i++) {
      const u = makeUniforms();
      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: u,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new Mesh(geo, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      scene.add(mesh);
      this.slots.push({ mesh, u });
    }
  }

  update(telegraphs: Telegraphs, hazards: Hazards, time: number): void {
    this.used = 0;
    for (const h of hazards.pool) {
      if (!h.active) continue;
      const style = h.kind === 'burn' ? DECALS.burn : DECALS.cold;
      const progress = Number.isFinite(h.life) ? h.t / (h.t + h.life) : 0;
      this.draw(h.shape, h.x, h.z, 0, progress, h.kind === 'burn' ? 'burn' : 'cold', style, time);
    }
    for (const tg of telegraphs.pool) {
      if (!tg.active) continue;
      const progress = tg.duration > 0 ? Math.min(1, tg.t / tg.duration) : 1;
      this.draw(tg.shape, tg.x, tg.z, tg.dir, progress, 'telegraph', DECALS.telegraph, time);
    }
    for (let i = this.used; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s) s.mesh.visible = false;
    }
  }

  private draw(
    shape: AreaShape,
    x: number,
    z: number,
    dir: number,
    progress: number,
    style: keyof typeof STYLE,
    look: {
      color: number;
      glow: number;
      fill: number;
      edge: number;
      charge?: number;
      band?: number;
    },
    time: number,
  ): void {
    const slot = this.slots[this.used];
    if (!slot) return;
    this.used++;
    const u = slot.u;
    let extent: number;
    let p0: number;
    let p1: number;
    switch (shape.kind) {
      case 'arc':
        extent = shape.radius;
        p0 = shape.radius;
        p1 = shape.angle;
        break;
      case 'circle':
        extent = shape.radius;
        p0 = shape.radius;
        p1 = 0;
        break;
      case 'line':
        extent = Math.max(shape.length, shape.width);
        p0 = shape.length;
        p1 = shape.width;
        break;
      case 'ring':
        extent = Math.min(shape.outer, style === 'cold' ? DECALS.coldExtent : shape.outer);
        p0 = shape.inner;
        p1 = shape.outer;
        break;
    }
    if (extent <= 0) {
      slot.mesh.visible = false;
      return;
    }
    u.uKind.value = KIND[shape.kind];
    u.uStyle.value = STYLE[style];
    u.uOrigin.value.set(x, z);
    u.uDir.value = dir;
    u.uParams.value.set(p0, p1);
    u.uProgress.value = progress;
    u.uTime.value = time;
    u.uColor.value.copy(tmpColor.setHex(look.color)).multiplyScalar(look.glow);
    u.uLevels.value.setRGB(look.fill, look.charge ?? 0, look.edge);
    u.uBand.value = look.band ?? 1;
    const pad = DECALS.edgeWidth * 2;
    slot.mesh.position.set(x, DECALS.y, z);
    slot.mesh.scale.set((extent + pad) * 2, 1, (extent + pad) * 2);
    slot.mesh.visible = true;
  }
}
