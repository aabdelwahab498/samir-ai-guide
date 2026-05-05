import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Globe, Heart } from "lucide-react";

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function load() {
    const { data } = await supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(50);
    setPosts(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function post() {
    if (!user || !title || !body) return;
    await supabase.from("community_posts").insert({ user_id: user.id, title, body });
    setTitle(""); setBody(""); load();
  }
  async function like(p: any) {
    await supabase.from("community_posts").update({ likes: (p.likes ?? 0) + 1 }).eq("id", p.id); load();
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3"><Globe className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Community</h1></div>
      {user && (
        <Card className="p-4 space-y-2">
          <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Share your thoughts…" value={body} onChange={e => setBody(e.target.value)} />
          <Button onClick={post} className="gradient-primary">Post</Button>
        </Card>
      )}
      {posts.map(p => (
        <Card key={p.id} className="p-4">
          <div className="font-semibold">{p.title}</div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{p.body}</div>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={() => like(p)}><Heart className="h-3 w-3 mr-1" />{p.likes}</Button>
            <span>{new Date(p.created_at).toLocaleDateString()}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}