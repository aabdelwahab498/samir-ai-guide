import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Users, Plus } from "lucide-react";

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [name, setName] = useState("");

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    setGroups(data ?? []);
  }
  useEffect(() => { load(); }, [user]);

  async function create() {
    if (!user || !name) return;
    const { data } = await supabase.from("groups").insert({ owner_id: user.id, name }).select().single();
    if (data) { await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id, role: "owner" }); setName(""); load(); }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3"><Users className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Study Groups</h1></div>
      <Card className="p-4 flex gap-2">
        <Input placeholder="New group name" value={name} onChange={e => setName(e.target.value)} />
        <Button onClick={create} className="gradient-primary"><Plus className="h-4 w-4 mr-1" />Create</Button>
      </Card>
      {groups.map(g => <Card key={g.id} className="p-4"><div className="font-semibold">{g.name}</div><div className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleDateString()}</div></Card>)}
      {groups.length === 0 && <p className="text-sm text-muted-foreground text-center">You're not in any groups yet.</p>}
    </div>
  );
}