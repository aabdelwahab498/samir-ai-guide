import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_RULE = `LANGUAGE RULE (highest priority):
- Always reply in the SAME language the user wrote their last message in.
- Detect the language automatically from the user's message (Arabic, English, French, Spanish, German, Turkish, Urdu, Hindi, Chinese, Japanese, etc. — any language).
- If the user mixes languages, mirror the dominant language. Keep proper nouns, code, and math in their original form.
- Use the script and direction natural to that language (e.g., RTL for Arabic).`;

const DEFAULT_SYSTEMS: Record<string, string> = {
  tutor: `You are SAMIR Tutor — a warm, expert teacher. Use the provided PDF context as your primary source. You may augment with general knowledge but mark anything not in the PDF clearly. Be encouraging and structured.\n\n${LANG_RULE}`,
  detective: `You are SAMIR Detective — teach the user HOW to investigate, search, and reason. Walk them through clues, ask Socratic questions, then reveal a structured search plan before answering.\n\n${LANG_RULE}`,
  strict: `You are SAMIR Strict-PDF Tutor. You MUST answer using ONLY the provided context chunks from the user's PDF.
Rules:
- If the answer is not in the chunks, reply with the equivalent of "This information is not in the provided PDF." in the user's language.
- Cite sources inline as [p.<page>] when possible.
- Never invent facts beyond the context.\n\n${LANG_RULE}`,
  cloud: `You are SAMIR AI Tutor. Be helpful, concise, and accurate.\n\n${LANG_RULE}`,
  offline: `You are SAMIR AI Tutor. Be helpful, concise, and accurate.\n\n${LANG_RULE}`,
};

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

async function loadPromptSetting(mode: string): Promise<{ system: string; model: string }> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("missing service creds");
    const admin = createClient(url, key);
    const { data } = await admin.from("prompt_settings").select("system_prompt, model").eq("mode", mode).maybeSingle();
    if (data?.system_prompt) {
      return {
        system: `${data.system_prompt}\n\n${LANG_RULE}`,
        model: data.model || DEFAULT_MODEL,
      };
    }
  } catch (e) {
    console.error("prompt_settings load failed", e);
  }
  return { system: DEFAULT_SYSTEMS[mode] ?? DEFAULT_SYSTEMS.tutor, model: DEFAULT_MODEL };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { mode = "tutor", messages = [], context = "", pdfTitle = "", lang = "" } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const lookupMode = mode === "offline" ? "tutor" : mode;
    const { system: sys, model } = await loadPromptSetting(lookupMode);
    const langHint = lang ? `\n\nUser interface language hint: "${lang}". If the user's message itself is in another language, follow the user's message language instead.` : "";
    const ctxBlock = context ? `\n\n--- PDF CONTEXT${pdfTitle ? ` (${pdfTitle})` : ""} ---\n${context}\n--- END CONTEXT ---` : "";

    const fullMessages = [
      { role: "system", content: sys + langHint + ctxBlock },
      ...messages,
    ];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: fullMessages, stream: true }),
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