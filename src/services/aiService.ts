import { supabase } from "@/lib/supabaseClient";
import { webllmChat } from "@/lib/webllmService";
import i18n from "@/i18n";

export type ChatMode = "tutor" | "detective" | "strict" | "offline" | "cloud";

export interface AIMessage { role: "user" | "assistant" | "system"; content: string }

export interface AIRequest {
  mode: ChatMode;
  messages: AIMessage[];
  context?: string; // injected RAG context
  pdfTitle?: string;
}

export async function streamChat(req: AIRequest, onDelta: (s: string) => void): Promise<void> {
  if (req.mode === "offline") {
    const out = await webllmChat(req.messages);
    if (out) { onDelta(out); return; }
    // fall through to cloud
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      mode: req.mode,
      messages: req.messages,
      context: req.context,
      pdfTitle: req.pdfTitle,
      lang: (typeof navigator !== "undefined" ? navigator.language : "") || i18n.language || "en",
    }),
  });

  if (resp.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
  if (resp.status === 402) throw new Error("AI credits exhausted. Add funds in Workspace Settings.");
  if (!resp.ok || !resp.body) {
    // Try HF fallback
    const fb = await supabase.functions.invoke("hf-fallback", { body: { messages: req.messages, context: req.context, mode: req.mode } });
    if (fb.data?.text) { onDelta(fb.data.text); return; }
    throw new Error("AI request failed");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = ""; let done = false;
  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {
        buf = line + "\n" + buf; break;
      }
    }
  }
}