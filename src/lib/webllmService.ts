// Lazy-loaded WebLLM (offline) wrapper. Loads only when explicitly invoked.
let enginePromise: Promise<any> | null = null;

export async function getWebLLM() {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        // @ts-ignore - dynamic ESM import from CDN at runtime (lazy, never bundled)
        const mod: any = await import(/* @vite-ignore */ ("https://esm.run/@mlc-ai/web-llm"));
        const engine = await mod.CreateMLCEngine("TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC");
        return engine;
      } catch (e) {
        console.error("WebLLM unavailable, falling back to cloud", e);
        return null;
      }
    })();
  }
  return enginePromise;
}

export async function webllmChat(messages: { role: string; content: string }[]): Promise<string | null> {
  const engine = await getWebLLM();
  if (!engine) return null;
  const reply = await engine.chat.completions.create({ messages, stream: false });
  return reply.choices?.[0]?.message?.content ?? null;
}