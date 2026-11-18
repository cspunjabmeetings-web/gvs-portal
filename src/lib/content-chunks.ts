// spec: 8.7 ("import ke waqt client chhote tukron mein POST"), FX-03, F11-AC3 (sirf sahih hisse), F11-AC7 (ek jaisa sawal)
// Pure (browser + server). Server inhi hadon se tukra jaanchta hai (content-import.ts).
import { qHash, type ParsedItem, type ParsedMcq } from './parser';

/** Ek request mein: 25 sawal, ya 1 mock (≤ 100 sawal), ya 5 notes — free tier ki CPU/query hadein (FX-03) */
export const CHUNK = { mcqs: 25, notes: 5 } as const;
/** 9.4: content import body ≤ 600 KB */
export const IMPORT_BODY_LIMIT = 600 * 1024;
/** 9.4: .txt upload ≤ 512 KB */
export const UPLOAD_LIMIT = 512 * 1024;

export type ChunkKind = 'MCQ' | 'MOCK' | 'NOTE';
export interface Chunk {
  kind: ChunkKind;
  /** Paste mein in cheezon ki jagah (index) — progress aur "kya save hua" ke liye */
  indexes: number[];
  /** Server ko jane wala text (asal source) */
  text: string;
}

/** Sahih cheezon ke tukre; JOB (Jobs tab, Qadam 13) shamil nahin */
export function buildChunks(items: ParsedItem[]): Chunk[] {
  const out: Chunk[] = [];
  let mcq: number[] = [];
  let notes: number[] = [];
  const flush = (kind: ChunkKind, list: number[]) => {
    if (list.length) out.push({ kind, indexes: list, text: list.map((i) => items[i].source).join('\n') });
  };
  items.forEach((it, i) => {
    if (it.kind === 'MCQ') {
      mcq.push(i);
      if (mcq.length === CHUNK.mcqs) (flush('MCQ', mcq), (mcq = []));
    } else if (it.kind === 'NOTE') {
      notes.push(i);
      if (notes.length === CHUNK.notes) (flush('NOTE', notes), (notes = []));
    } else if (it.kind === 'MOCK') {
      flush('MOCK', [i]);
    }
  });
  flush('MCQ', mcq);
  flush('NOTE', notes);
  return out;
}

/** Paste ke saare sawal (mock ke andar wale bhi) */
export function allMcqs(items: ParsedItem[]): ParsedMcq[] {
  return items.flatMap((it) => (it.kind === 'MCQ' ? [it] : it.kind === 'MOCK' ? it.mcqs : []));
}

/** Har sawal ka hash + paste ke andar dohraye hue (pehle wale ka number) */
export async function hashMcqs(items: ParsedItem[]): Promise<{ hashes: Map<ParsedMcq, string>; repeats: Map<ParsedMcq, number> }> {
  const list = allMcqs(items);
  const hashes = new Map<ParsedMcq, string>();
  const repeats = new Map<ParsedMcq, number>();
  const first = new Map<string, number>();
  for (const q of list) {
    const h = await qHash(q.question);
    hashes.set(q, h);
    if (first.has(h)) repeats.set(q, first.get(h)!);
    else first.set(h, q.number);
  }
  return { hashes, repeats };
}
