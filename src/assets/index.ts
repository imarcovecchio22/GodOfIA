import barbarian from './models/barbarian.glb?url';
import brute from './models/brute.glb?url';
import draugr from './models/draugr.glb?url';

/** URLs con hash de los modelos (Vite los emite en /assets/, cacheados como immutable). */
export const MODEL_URLS = { barbarian, draugr, brute } as const;
