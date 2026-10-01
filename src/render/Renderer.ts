import { LinearSRGBColorSpace, PCFShadowMap, WebGLRenderer, type PerspectiveCamera } from 'three';
import { ENGINE } from '../data/engine';

/** Envuelve el WebGLRenderer: canvas a pantalla completa, resize y pixel ratio limitado. */
export class Renderer {
  readonly gl: WebGLRenderer;

  constructor(
    container: HTMLElement,
    private readonly camera: PerspectiveCamera,
  ) {
    this.gl = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, ENGINE.maxPixelRatio));
    this.gl.outputColorSpace = LinearSRGBColorSpace;
    this.gl.shadowMap.enabled = true;
    // PCFSoftShadowMap ya no existe en Three; PCF con radio da un resultado parecido.
    this.gl.shadowMap.type = PCFShadowMap;
    container.prepend(this.gl.domElement);
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  get canvas(): HTMLCanvasElement {
    return this.gl.domElement;
  }

  private readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.gl.setSize(w, h);
  };
}
