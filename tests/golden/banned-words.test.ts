// spec: F02-AC7, 10.1 banned-words (intent 27/28). Mamnoo alfaz kisi page/data mein nahin.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BANNED = [/guarantee/i, /100\s*%/, /pakki\s+naukri/i, /sab\s+se\s+behtareen/i];
const SCAN_DIRS = ['src', 'public'];
const EXT = /\.(astro|tsx?|jsx?|json|md|mdx|html|txt|webmanifest)$/;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : EXT.test(p) ? [p] : [];
  });
}

describe('banned-words', () => {
  it('src/ aur public/ mein mamnoo alfaz nahin', () => {
    const hits: string[] = [];
    for (const d of SCAN_DIRS) {
      for (const file of walk(join(process.cwd(), d))) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          for (const re of BANNED) {
            if (re.test(line)) hits.push(`${relative(process.cwd(), file)}:${i + 1} -> ${re}`);
          }
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
