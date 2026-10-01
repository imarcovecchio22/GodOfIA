/**
 * Pipeline de audio: descarga packs CC0 (Kenney y OpenGameArt), elige las variaciones de cada
 * banco y las convierte a MP3 mono en `src/assets/audio/`.
 *
 * Requiere `ffmpeg` en el PATH. Los MP3 generados se commitean, así el deploy no lo necesita.
 * Uso: `npm run audio`.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.asset-cache', 'audio');
const OUT = join(ROOT, 'src', 'assets', 'audio');

const SOURCES = {
  impact: {
    url: 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
    zip: true,
  },
  rpg: {
    url: 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip',
    zip: true,
  },
  creatures: {
    url: 'https://opengameart.org/sites/default/files/80-CC0-creature-SFX_0.zip',
    zip: true,
  },
  ambient: { url: 'https://opengameart.org/sites/default/files/dungeon_ambient_1.ogg', zip: false },
};

const range = (prefix, n, pad = 3, start = 0) =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i + start).padStart(pad, '0')}.ogg`);

/** Banco → [fuente, archivos]. Cada archivo pasa a `<banco>_<i>.mp3`. */
const BANKS = {
  hit_bone: ['impact', range('impactWood_medium_', 5)],
  hit_flesh: ['impact', range('impactPunch_medium_', 5)],
  hit_heavy: ['impact', range('impactPunch_heavy_', 5)],
  slam: ['impact', range('impactMining_', 5)],
  bone_break: ['impact', range('impactWood_heavy_', 5)],
  clink_metal: ['impact', range('impactMetal_light_', 5)],
  clink_floor: ['impact', range('impactSoft_heavy_', 5)],
  catch: ['impact', range('impactMetal_medium_', 5)],
  freeze: ['impact', range('impactGlass_light_', 5)],
  step: ['impact', range('footstep_concrete_', 5)],
  cloth: ['rpg', ['cloth1.ogg', 'cloth2.ogg', 'cloth3.ogg', 'cloth4.ogg']],
  growl: ['creatures', range('grunt_', 5, 2, 1)],
  rise: [
    'creatures',
    ['monster_01.ogg', 'monster_03.ogg', 'monster_04.ogg', 'monster_06.ogg', 'monster_07.ogg'],
  ],
  groan: ['creatures', ['troll_01.ogg', 'troll_02.ogg', 'troll_03.ogg']],
  ambient: ['ambient', ['dungeon_ambient_1.ogg']],
};

/** Bitrate por banco (la ambientación es larga y no necesita más). */
const BITRATE = { ambient: '64k' };

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** `unzip` si está; si no, el `tar` del sistema (bsdtar en Windows y macOS abre zips). */
function extractZip(dir) {
  try {
    execFileSync('unzip', ['-oq', 'source.zip'], { cwd: dir });
  } catch {
    execFileSync('tar', ['-xf', 'source.zip'], { cwd: dir });
  }
}

async function fetchSource(name) {
  const src = SOURCES[name];
  const dir = join(CACHE, name);
  if (await exists(dir)) return dir;
  await mkdir(dir, { recursive: true });
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`No se pudo descargar ${src.url}: ${res.status}`);
  const file = join(dir, src.zip ? 'source.zip' : src.url.split('/').pop());
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  if (src.zip) extractZip(dir);
  console.log(`  descargado ${name}`);
  return dir;
}

/** Busca un archivo por nombre en cualquier subcarpeta (los zips traen estructuras distintas). */
async function findFile(dir, name) {
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name === name)
      return join(entry.parentPath ?? entry.path, entry.name);
  }
  throw new Error(`No se encontró ${name} en ${dir}`);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
let total = 0;
for (const [bank, [source, files]] of Object.entries(BANKS)) {
  const dir = await fetchSource(source);
  for (const [i, f] of files.entries()) {
    const input = await findFile(dir, f);
    const output = join(OUT, `${bank}_${i}.mp3`);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      input,
      '-ac',
      '1',
      '-ar',
      '44100',
      '-c:a',
      'libmp3lame',
      '-b:a',
      BITRATE[bank] ?? '96k',
      output,
    ]);
    total += (await stat(output)).size;
  }
  console.log(`  ${bank}: ${files.length}`);
}
console.log(`→ ${OUT} (${(total / 1024).toFixed(0)} KB)`);
