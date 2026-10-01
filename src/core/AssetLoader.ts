import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export type Progress = (fraction: number) => void;

/** Descarga con progreso por bytes (usa Content-Length; si no viene, avanza al terminar). */
async function fetchWithProgress(url: string, onBytes: (loaded: number, total: number) => void) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`No se pudo descargar ${url}: ${res.status}`);
  const total = Number(res.headers.get('Content-Length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onBytes(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  onBytes(loaded, loaded);
  return out.buffer;
}

/**
 * Carga de assets con progreso real. Cada tarea pesa lo mismo en la barra; dentro de una descarga
 * el avance es por bytes.
 */
export class AssetLoader {
  private readonly gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly fractions: number[] = [];

  constructor(private readonly onProgress: Progress) {}

  private report(): void {
    const sum = this.fractions.reduce((a, b) => a + b, 0);
    this.onProgress(this.fractions.length ? sum / this.fractions.length : 1);
  }

  /** Registra una tarea que no informa progreso parcial (por ejemplo, el WASM de la física). */
  task<T>(promise: Promise<T>): Promise<T> {
    const i = this.fractions.push(0) - 1;
    this.report();
    return promise.then((v) => {
      this.fractions[i] = 1;
      this.report();
      return v;
    });
  }

  gltfModel(url: string): Promise<GLTF> {
    const i = this.fractions.push(0) - 1;
    this.report();
    return fetchWithProgress(url, (loaded, total) => {
      this.fractions[i] = total > 0 ? Math.min(loaded / total, 0.99) : 0;
      this.report();
    })
      .then((buf) => this.gltf.parseAsync(buf, ''))
      .then((g) => {
        this.fractions[i] = 1;
        this.report();
        return g;
      });
  }
}
