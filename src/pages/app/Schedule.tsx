import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Plus, Trash2 } from "lucide-react";

export default function Schedule() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("schedule_items").select("*").order("starts_at");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [user]);

  async function add() {
    if (!user || !title || !when) return;
    await supabase.from("schedule_items").insert({ user_id: user.id, title, starts_at: new Date(when).toISOString() });
    setTitle(""); setWhen(""); load();
  }
  async function toggle(id: string, done: boolean) { await supabase.from("schedule_items").update({ done: !done }).eq("id", id); load(); }
  async function del(id: string) { await supabase.from("schedule_items").delete().eq("id", id); load(); }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3"><Calendar className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Schedule</h1></div>
      <Card className="p-4 flex gap-2 flex-wrap">
        <Input placeholder="Study task" value={title} onChange={e => setTitle(e.target.value)} className="flex-1 min-w-[160px]" />
        <Input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="w-auto" />
        <Button onClick={add} className="gradient-primary"><Plus className="h-4 w-4 mr-1" />Add</Button>
      </Card>
      {items.map(it => (
        <Card key={it.id} className="p-3 flex items-center gap-3">
          <Checkbox checked={it.done} onCheckedChange={() => toggle(it.id, it.done)} />
          <div className="flex-1"><div className={it.done ? "line-through text-muted-foreground" : ""}>{it.title}</div>
            <div className="text-xs text-muted-foreground">{new Date(it.starts_at).toLocaleString()}</div></div>
          <Button variant="ghost" size="icon" onClick={() => del(it.id)}><Trash2 className="h-4 w-4" /></Button>
        </Card>
      ))}
      {items.length === 0 && <p className="text-sm text-muted-foreground text-center">Nothing scheduled.</p>}
    </div>
  );
}