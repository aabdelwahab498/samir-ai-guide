import { supabase } from "@/lib/supabaseClient";

export interface RetrievedChunk { id: string; pdf_id: string; content: string; page: number | null; similarity: number }

export async function retrieve(query: string, opts: { pdfId?: string; userId?: string; k?: number } = {}): Promise<RetrievedChunk[]> {
  // Server-side: get embedding then call match function
  const { data: emb, error: e1 } = await supabase.functions.invoke("embed", { body: { input: query } });
  if (e1 || !emb?.embedding) return [];
  const { data, error } = await supabase.rpc("match_pdf_chunks", {
    query_embedding: emb.embedding,
    match_count: opts.k ?? 5,
    p_pdf_id: opts.pdfId ?? null,
    p_user_id: opts.userId ?? null,
  });
  if (error) { console.error(error); return []; }
  return (data ?? []) as RetrievedChunk[];
}

export async function embedAndStoreChunks(pdfId: string, userId: string, chunks: { content: string; page?: number; index: number }[]) {
  // Batch embed via edge function
  const BATCH = 16;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const { data, error } = await supabase.functions.invoke("embed", { body: { inputs: batch.map(b => b.content) } });
    if (error) throw error;
    const rows = batch.map((c, j) => ({
      pdf_id: pdfId,
      user_id: userId,
      chunk_index: c.index,
      page: c.page ?? null,
      content: c.content,
      embedding: data.embeddings?.[j] ?? null,
    }));
    const { error: insErr } = await supabase.from("pdf_chunks").insert(rows);
    if (insErr) throw insErr;
  }
}