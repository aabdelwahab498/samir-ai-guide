import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Deterministic 768-dim embedding using hashed-trigram bag-of-words.
// Works with the pgvector(768) match function. Replaceable with a real embeddings provider later.
const DIM = 768;

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function embed(text: string): number[] {
  const v = new Float32Array(DIM);
  const tokens = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    v[hash(t) % DIM] += 1;
    if (i < tokens.length - 1) v[hash(t + "_" + tokens[i+1]) % DIM] += 0.5;
    for (let n = 0; n < t.length - 2; n++) v[hash(t.slice(n, n+3)) % DIM] += 0.25;
  }
  let norm = 0; for (let i = 0; i < DIM; i++) norm += v[i]*v[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(v, x => x / norm);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { input, inputs } = await req.json();
    if (Array.isArray(inputs)) {
      return new Response(JSON.stringify({ embeddings: inputs.map((t: string) => embed(t || "")) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ embedding: embed(String(input || "")) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});