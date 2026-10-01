import type { WebGLRenderer } from 'three';

/** Se muestra siempre en desarrollo, y en producción con `?debug` en la URL. */
export function debugEnabled(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
}

const SAMPLE_WINDOW = 0.5;

/** Overlay de FPS, tiempo de frame, draw calls y líneas extra (estado de sistemas). */
export class DebugOverlay {
  private readonly el: HTMLElement;
  private frames = 0;
  private elapsed = 0;
  private fps = 0;
  private frameMs = 0;
  private readonly extra = new Map<string, string>();

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'debug-overlay';
    parent.append(this.el);
  }

  set(key: string, value: string): void {
    this.extra.set(key, value);
  }

  /** Llamar después de renderizar, para leer las draw calls del frame. */
  update(realDt: number, gl: WebGLRenderer, steps: number): void {
    this.frames++;
    this.elapsed += realDt;
    if (this.elapsed < SAMPLE_WINDOW) return;
    this.fps = this.frames / this.elapsed;
    this.frameMs = (this.elapsed / this.frames) * 1000;
    this.frames = 0;
    this.elapsed = 0;

    const { calls, triangles } = gl.info.render;
    const lines = [
      `${this.fps.toFixed(0)} fps · ${this.frameMs.toFixed(1)} ms`,
      `draw calls ${calls} · tris ${triangles}`,
      `sim steps/frame ${steps}`,
    ];
    for (const [k, v] of this.extra) lines.push(`${k} ${v}`);
    this.el.textContent = lines.join('\n');
  }
}
