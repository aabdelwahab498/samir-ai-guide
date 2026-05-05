import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Coins, Clock, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Tracker() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [weak, setWeak] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  async function load() {
    if (!user) return;
    const [p, a, w, s] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("quiz_attempts").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("weak_topics").select("*").limit(20),
      supabase.from("study_sessions").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setProfile(p.data); setAttempts(a.data ?? []); setWeak(w.data ?? []); setSessions(s.data ?? []);
  }
  useEffect(() => { load(); }, [user]);

  async function logSession() {
    if (!user) return;
    await supabase.from("study_sessions").insert({ user_id: user.id, duration_minutes: 25, topic: "Pomodoro" });
    await supabase.from("profiles").update({ study_minutes: (profile?.study_minutes ?? 0) + 25, coins: (profile?.coins ?? 0) + 5 }).eq("id", user.id);
    load();
  }

  const totalMin = sessions.reduce((s, x) => s + x.duration_minutes, 0);
  const avgScore = attempts.length ? Math.round(attempts.reduce((s, x) => s + (x.score / x.total) * 100, 0) / attempts.length) : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Tracker Dashboard</h1>
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { icon: Coins, label: "Coins", val: profile?.coins ?? 0 },
          { icon: Clock, label: "Study min", val: profile?.study_minutes ?? 0 },
          { icon: Target, label: "Avg score", val: `${avgScore}%` },
          { icon: TrendingUp, label: "Quizzes", val: attempts.length },
        ].map((s, i) => (
          <Card key={i} className="p-5 shadow-card">
            <div className="flex items-center justify-between mb-2"><s.icon className="h-5 w-5 text-primary" /></div>
            <div className="text-3xl font-bold">{s.val}</div><div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>
      <Button onClick={logSession} className="gradient-primary shadow-glow">Log 25-min Pomodoro (+5 coins)</Button>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5"><h3 className="font-semibold mb-3">Weak topics</h3>
          <div className="flex flex-wrap gap-2">{weak.length === 0 ? <p className="text-sm text-muted-foreground">No weak topics yet.</p> :
            weak.map(w => <span key={w.id} className="px-2 py-1 rounded-full bg-warning/20 text-xs">{w.topic}</span>)}</div></Card>
        <Card className="p-5"><h3 className="font-semibold mb-3">Recent quiz attempts</h3>
          <div className="space-y-2">{attempts.length === 0 ? <p className="text-sm text-muted-foreground">No attempts yet.</p> :
            attempts.map(a => <div key={a.id} className="flex justify-between text-sm"><span>{new Date(a.created_at).toLocaleDateString()}</span><span className="font-medium">{a.score}/{a.total}</span></div>)}</div></Card>
      </div>
    </div>
  );
}