import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANK_SIZES } from '../data/audio';

describe('Bancos de audio', () => {
  it('cada banco tiene exactamente los archivos que genera `npm run audio`', () => {
    const files = readdirSync(join(process.cwd(), 'src', 'assets', 'audio'));
    for (const [bank, n] of Object.entries(BANK_SIZES)) {
      const found = files.filter((f) => new RegExp(String.raw`^${bank}_\d+\.mp3$`).test(f)).length;
      expect(found, bank).toBe(n);
    }
  });
});
