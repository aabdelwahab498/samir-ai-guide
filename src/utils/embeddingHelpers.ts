// Cosine similarity helpers used for client-side fallback ranking.
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

export function topK<T>(items: T[], scoreFn: (t: T) => number, k: number): T[] {
  return [...items].map(t => ({ t, s: scoreFn(t) }))
    .sort((a,b) => b.s - a.s).slice(0, k).map(x => x.t);
}