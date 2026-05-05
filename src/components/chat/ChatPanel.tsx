import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, FileText, Loader2 } from "lucide-react";
import { streamChat, type ChatMode, type AIMessage } from "@/services/aiService";
import { retrieve } from "@/services/ragService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BACKEND_ENABLED, backendChat } from "@/lib/backendClient";

interface Props { mode: ChatMode; pdfId?: string; pdfTitle?: string; title: string; subtitle: string; }

export default function ChatPanel({ mode, pdfId, pdfTitle, title, subtitle }: Props) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const userMsg: AIMessage = { role: "user", content: text };
    setMessages(p => [...p, userMsg, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      // Server-side path: backend does RAG + AI in one call.
      if (BACKEND_ENABLED) {
        const r = await backendChat({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          document_id: pdfId,
          mode: mode === "offline" ? "tutor" : (mode as any),
        });
        setMessages(p => { const c = [...p]; c[c.length-1] = { role: "assistant", content: r.answer }; return c; });
        setBusy(false);
        return;
      }

      let context = "";
      if (pdfId || mode === "strict") {
        const chunks = await retrieve(text, { pdfId, userId: user?.id, k: 5 });
        context = chunks.map((c, i) => `[Chunk ${i+1}${c.page ? ` p.${c.page}` : ""}]\n${c.content}`).join("\n\n");
        if (mode === "strict" && !context) {
          setMessages(p => { const c = [...p]; c[c.length-1] = { role: "assistant", content: "This information is not in the provided PDF." }; return c; });
          setBusy(false); return;
        }
      }
      let acc = "";
      await streamChat(
        { mode, messages: [...messages, userMsg], context, pdfTitle },
        (delta) => {
          acc += delta;
          setMessages(p => { const c = [...p]; c[c.length-1] = { role: "assistant", content: acc }; return c; });
        }
      );
    } catch (e: any) {
      toast.error(e?.message ?? "AI request failed");
      setMessages(p => p.slice(0, -1));
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-card/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-primary grid place-items-center"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {pdfTitle && <Badge variant="secondary" className="ml-auto"><FileText className="h-3 w-3 mr-1" />{pdfTitle}</Badge>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <Card className="p-8 text-center bg-secondary/30 border-dashed">
            <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
            <p className="text-sm text-muted-foreground">{t("chat.askStart")}</p>
          </Card>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === "user" ? "gradient-primary text-primary-foreground shadow-glow" : "bg-card border shadow-card"
            }`}>
              {m.content || (busy && i === messages.length - 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : "…")}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t p-4 bg-card/50 backdrop-blur">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={t("chat.placeholder")}
            className="min-h-[52px] max-h-40 resize-none"
          />
          <Button onClick={send} disabled={busy || !input.trim()} size="lg" className="gradient-primary shadow-glow">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}