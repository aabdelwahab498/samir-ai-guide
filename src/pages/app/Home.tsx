import { useEffect, useState } from "react";
import PdfUploader from "@/components/PdfUploader";
import ChatPanel from "@/components/chat/ChatPanel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { FileText, MessagesSquare, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatMode } from "@/services/aiService";

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [pdfs, setPdfs] = useState<{ id: string; title: string }[]>([]);
  const [pdfId, setPdfId] = useState<string | undefined>();
  const [mode, setMode] = useState<ChatMode>("tutor");
  const [chats, setChats] = useState<{ id: string; title: string; mode: string; pdf_id: string | null }[]>([]);
  const [chatId, setChatId] = useState<string | undefined>();

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("pdfs").select("id,title").order("created_at", { ascending: false });
    setPdfs(data ?? []);
  }
  async function loadChats() {
    if (!user) return;
    const { data } = await supabase.from("chats").select("id,title,mode,pdf_id").order("updated_at", { ascending: false }).limit(50);
    setChats(data ?? []);
  }
  useEffect(() => { load(); loadChats(); }, [user]);

  async function newChat() {
    if (!user) return;
    const { data } = await supabase.from("chats").insert({ user_id: user.id, title: "New chat", mode, pdf_id: pdfId ?? null }).select().single();
    if (data) { setChats(c => [data as any, ...c]); setChatId(data.id); }
  }
  async function openChat(c: { id: string; mode: string; pdf_id: string | null }) {
    setChatId(c.id); setMode(c.mode as ChatMode); setPdfId(c.pdf_id ?? undefined);
  }
  async function deleteChat(id: string) {
    await supabase.from("messages").delete().eq("chat_id", id);
    await supabase.from("chats").delete().eq("id", id);
    setChats(c => c.filter(x => x.id !== id));
    if (chatId === id) setChatId(undefined);
  }

  const pdfTitle = pdfs.find(p => p.id === pdfId)?.title;

  return (
    <div className="grid lg:grid-cols-[340px_1fr] h-screen">
      <aside className="border-r p-4 space-y-4 overflow-y-auto bg-card/30">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{t("home.library")}</h2>
        <PdfUploader onDone={(id) => { setPdfId(id); load(); }} />
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">{t("home.chatMode")}</label>
          <Select value={mode} onValueChange={v => setMode(v as ChatMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutor">{t("home.modes.tutor")}</SelectItem>
              <SelectItem value="detective">{t("home.modes.detective")}</SelectItem>
              <SelectItem value="strict">{t("home.modes.strict")}</SelectItem>
              <SelectItem value="offline">{t("home.modes.offline")}</SelectItem>
              <SelectItem value="cloud">{t("home.modes.cloud")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("home.activePdf")}</label>
          <Card className="p-2 max-h-72 overflow-y-auto space-y-1">
            <Button variant={!pdfId ? "secondary" : "ghost"} size="sm" className="w-full justify-start" onClick={() => setPdfId(undefined)}>{t("home.none")}</Button>
            {pdfs.map(p => (
              <Button key={p.id} variant={pdfId === p.id ? "secondary" : "ghost"} size="sm" className="w-full justify-start text-xs"
                onClick={() => setPdfId(p.id)}>
                <FileText className="h-3 w-3 mr-2" />{p.title}
              </Button>
            ))}
            {pdfs.length === 0 && <p className="text-xs text-muted-foreground p-2">{t("home.uploadHint")}</p>}
          </Card>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">{t("home.previousChats")}</label>
            <Button size="sm" variant="ghost" onClick={newChat}><Plus className="h-3 w-3 mr-1" />{t("home.newChat")}</Button>
          </div>
          <Card className="p-2 max-h-72 overflow-y-auto space-y-1">
            {chats.map(c => (
              <div key={c.id} className={`flex items-center gap-1 rounded ${chatId === c.id ? "bg-secondary" : ""}`}>
                <Button variant="ghost" size="sm" className="flex-1 justify-start text-xs min-w-0" onClick={() => openChat(c)}>
                  <MessagesSquare className="h-3 w-3 mr-2 shrink-0" /><span className="truncate">{c.title}</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteChat(c.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {chats.length === 0 && <p className="text-xs text-muted-foreground p-2">{t("home.noChats")}</p>}
          </Card>
        </div>
      </aside>
      <ChatPanel key={chatId ?? "ephemeral"} chatId={chatId} mode={mode} pdfId={pdfId} pdfTitle={pdfTitle} title={t("chat.title")} subtitle={`${t("chat.modeSuffix", { mode: mode.toUpperCase() })}${pdfTitle ? ` • ${pdfTitle}` : ""}`} />
    </div>
  );
}