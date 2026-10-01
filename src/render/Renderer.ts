import {
  NoToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import { QUALITY, type Quality } from '../data/graphics';
import { PostFX } from './PostFX';

/**
 * WebGLRenderer + post-procesado: canvas a pantalla completa, resize, pixel ratio según la
 * calidad. El antialiasing lo hace el composer (MSAA), no el canvas.
 */
export class Renderer {
  readonly gl: WebGLRenderer;
  readonly post: PostFX;
  private quality: Quality;

  constructor(
    container: HTMLElement,
    scene: Scene,
    private readonly camera: PerspectiveCamera,
    quality: Quality,
  ) {
    this.quality = quality;
    this.gl = new WebGLRenderer({
      antialias: false,
      stencil: false,
      depth: false,
      powerPreference: 'high-performance',
    });
    this.gl.outputColorSpace = SRGBColorSpace;
    // El tone mapping lo hace el post-procesado.
    this.gl.toneMapping = NoToneMapping;
    this.gl.shadowMap.enabled = true;
    // PCFSoftShadowMap ya no existe en Three; PCF con radio da un resultado parecido.
    this.gl.shadowMap.type = PCFShadowMap;
    // Con varias pasadas por frame, las estadísticas se reinician a mano una vez por frame.
    this.gl.info.autoReset = false;
    container.prepend(this.gl.domElement);
    this.post = new PostFX(this.gl, scene, camera, quality);
    this.applyPixelRatio();
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  get canvas(): HTMLCanvasElement {
    return this.gl.domElement;
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    this.post.setQuality(quality);
    this.applyPixelRatio();
    this.resize();
  }

  private applyPixelRatio(): void {
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[this.quality].maxPixelRatio));
  }

  private readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.gl.setSize(w, h);
    this.post.setSize(w, h);
  };

  render(dt: number): void {
    this.gl.info.reset();
    this.post.render(dt);
  }
}
