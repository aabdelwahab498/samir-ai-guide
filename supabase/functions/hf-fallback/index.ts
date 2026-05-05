import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HuggingFace Inference fallback — uses HF_API_KEY if configured (Llama 3 / Jais).
// If no key, returns a graceful message.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages = [], context = "", mode = "tutor" } = await req.json();
    const key = Deno.env.get("HF_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ text: "Cloud AI is temporarily unavailable. Please try again shortly." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const model = Deno.env.get("HF_MODEL") || "meta-llama/Meta-Llama-3-8B-Instruct";
    const sys = mode === "strict"
      ? "Answer ONLY using the provided PDF context. If missing, say 'This information is not in the provided PDF.'"
      : "You are SAMIR AI Tutor.";
    const prompt = `<|system|>\n${sys}${context ? "\n\nContext:\n" + context : ""}\n${messages.map((m: any) => `<|${m.role}|>\n${m.content}`).join("\n")}\n<|assistant|>\n`;
    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 512, temperature: 0.4, return_full_text: false } }),
    });
    const j = await r.json();
    const text = Array.isArray(j) ? (j[0]?.generated_text ?? "") : (j.generated_text ?? j.error ?? "");
    return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});