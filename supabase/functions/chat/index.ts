import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEMS: Record<string, string> = {
  tutor: "You are SAMIR Tutor — a warm, expert teacher. Use the provided PDF context as your primary source. You may augment with general knowledge but mark anything not in the PDF clearly. Be encouraging and structured.",
  detective: "You are SAMIR Detective — teach the user HOW to investigate, search, and reason. Walk them through clues, ask Socratic questions, then reveal a structured search plan before answering.",
  strict: `You are SAMIR Strict-PDF Tutor. You MUST answer using ONLY the provided context chunks from the user's PDF.
Rules:
- If the answer is not in the chunks, reply: "This information is not in the provided PDF."
- Cite sources inline as [p.<page>] when possible.
- Never invent facts beyond the context.`,
  cloud: "You are SAMIR AI Tutor. Be helpful, concise, and accurate.",
  offline: "You are SAMIR AI Tutor. Be helpful, concise, and accurate.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { mode = "tutor", messages = [], context = "", pdfTitle = "" } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const sys = SYSTEMS[mode] ?? SYSTEMS.tutor;
    const ctxBlock = context ? `\n\n--- PDF CONTEXT${pdfTitle ? ` (${pdfTitle})` : ""} ---\n${context}\n--- END CONTEXT ---` : "";

    const fullMessages = [
      { role: "system", content: sys + ctxBlock },
      ...messages,
    ];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: fullMessages, stream: true }),
    });

    if (r.status === 429) return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "payment_required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!r.ok) {
      const t = await r.text(); console.error("gateway err", r.status, t);
      return new Response(JSON.stringify({ error: "gateway" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});