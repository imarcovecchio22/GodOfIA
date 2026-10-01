import barbarian from './models/barbarian.glb?url';
import brute from './models/brute.glb?url';
import draugr from './models/draugr.glb?url';

/** URLs con hash de los modelos (Vite los emite en /assets/, cacheados como immutable). */
export const MODEL_URLS = { barbarian, draugr, brute } as const;

const audioModules = import.meta.glob<string>('./audio/*.mp3', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** URLs de los samples por nombre (`hit_bone_0`, …). Se descargan en diferido. */
export const AUDIO_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(audioModules).map(([path, url]) => [path.slice('./audio/'.length, -'.mp3'.length), url]),
);
