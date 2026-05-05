import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Plus, MessagesSquare, Trash2 } from "lucide-react";
import ChatPanel from "@/components/chat/ChatPanel";
import type { ChatMode } from "@/services/aiService";

export default function MultiChats() {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("chats").select("*").order("updated_at", { ascending: false });
    setChats(data ?? []);
  }
  useEffect(() => { load(); }, [user]);

  async function create() {
    if (!user) return;
    const { data } = await supabase.from("chats").insert({ user_id: user.id, title: "New chat", mode: "tutor" }).select().single();
    if (data) { setChats(c => [data, ...c]); setActive(data); }
  }
  async function remove(id: string) {
    await supabase.from("chats").delete().eq("id", id);
    setChats(c => c.filter(x => x.id !== id));
    if (active?.id === id) setActive(null);
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] h-screen">
      <aside className="border-r p-3 space-y-2 overflow-y-auto bg-card/30">
        <Button onClick={create} className="w-full gradient-primary shadow-glow"><Plus className="h-4 w-4 mr-2" />New chat</Button>
        {chats.map(c => (
          <Card key={c.id} className={`p-3 cursor-pointer flex items-center justify-between ${active?.id === c.id ? "border-primary" : ""}`} onClick={() => setActive(c)}>
            <div className="flex items-center gap-2 min-w-0"><MessagesSquare className="h-4 w-4 shrink-0" /><span className="text-sm truncate">{c.title}</span></div>
            <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); remove(c.id); }}><Trash2 className="h-3 w-3" /></Button>
          </Card>
        ))}
        {chats.length === 0 && <p className="text-xs text-muted-foreground p-2 text-center">No chats yet</p>}
      </aside>
      {active ? (
        <ChatPanel key={active.id} mode={active.mode as ChatMode} pdfId={active.pdf_id} title={active.title} subtitle={`${active.mode} chat`} />
      ) : (
        <div className="grid place-items-center text-muted-foreground">Select or create a chat</div>
      )}
    </div>
  );
}