export interface Chunk { content: string; page?: number; index: number }

export function chunkText(text: string, page?: number, size = 800, overlap = 120): Chunk[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: Chunk[] = [];
  let i = 0; let idx = 0;
  while (i < clean.length) {
    const end = Math.min(i + size, clean.length);
    out.push({ content: clean.slice(i, end), page, index: idx++ });
    if (end === clean.length) break;
    i = end - overlap;
  }
  return out;
}