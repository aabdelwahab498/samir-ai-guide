import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Sparkles, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Q { question: string; choices: string[]; answer: number; explanation: string; topic?: string }

export default function Quiz() {
  const { user } = useAuth();
  const [pdfs, setPdfs] = useState<{ id: string; title: string }[]>([]);
  const [pdfId, setPdfId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { (async () => {
    if (!user) return;
    const { data } = await supabase.from("pdfs").select("id,title");
    setPdfs(data ?? []);
  })(); }, [user]);

  async function generate() {
    if (!pdfId) { toast.error("Pick a PDF first"); return; }
    setBusy(true); setQuestions([]); setSubmitted(false);
    try {
      const { data: chunks } = await supabase.from("pdf_chunks").select("content").eq("pdf_id", pdfId).limit(8);
      const ctx = (chunks ?? []).map((c: any) => c.content).join("\n\n");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ mode: "tutor", context: ctx, messages: [
          { role: "user", content: `Generate exactly 5 multiple-choice questions from the context. Return ONLY valid JSON array: [{"question":"...","choices":["a","b","c","d"],"answer":0,"explanation":"...","topic":"..."}]. No prose, no markdown.` }
        ] }) });
      let acc = ""; const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim(); if (j === "[DONE]") break;
          try { const p = JSON.parse(j); acc += p.choices?.[0]?.delta?.content ?? ""; } catch {}
        }
      }
      const m = acc.match(/\[[\s\S]*\]/);
      const arr = JSON.parse(m ? m[0] : acc);
      setQuestions(arr); setAnswers(new Array(arr.length).fill(-1));
    } catch (e: any) { toast.error("Failed to generate"); console.error(e); }
    finally { setBusy(false); }
  }

  async function submit() {
    setSubmitted(true);
    const score = answers.reduce((s, a, i) => s + (a === questions[i].answer ? 1 : 0), 0);
    const weak = questions.filter((q, i) => answers[i] !== q.answer).map(q => q.topic || q.question.slice(0, 40));
    if (user) {
      const { data: quiz } = await supabase.from("quizzes").insert({ user_id: user.id, pdf_id: pdfId, title: `Quiz ${new Date().toLocaleString()}`, questions: questions as any }).select().single();
      if (quiz) {
        await supabase.from("quiz_attempts").insert({ quiz_id: quiz.id, user_id: user.id, score, total: questions.length, answers: answers as any, weak_topics: weak });
        for (const t of weak) await supabase.from("weak_topics").insert({ user_id: user.id, topic: t, weight: 1 });
        await supabase.rpc("set_updated_at" as any).catch(() => {});
        // award coins
        const { data: prof } = await supabase.from("profiles").select("coins").eq("id", user.id).single();
        await supabase.from("profiles").update({ coins: (prof?.coins ?? 0) + score * 10 }).eq("id", user.id);
      }
    }
    toast.success(`Score ${score}/${questions.length} — +${score * 10} coins`);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl gradient-primary grid place-items-center"><ListChecks className="h-5 w-5 text-primary-foreground" /></div>
        <div><h1 className="text-2xl font-bold">Quiz Generator</h1><p className="text-sm text-muted-foreground">AI-generated quizzes from your PDFs</p></div></div>
      <Card className="p-4 flex items-center gap-3">
        <Select value={pdfId} onValueChange={setPdfId}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Choose a PDF" /></SelectTrigger>
          <SelectContent>{pdfs.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={generate} disabled={busy} className="gradient-primary shadow-glow">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-2" />Generate</>}
        </Button>
      </Card>
      {questions.map((q, i) => (
        <Card key={i} className="p-4 space-y-2">
          <div className="font-medium">{i + 1}. {q.question}</div>
          <div className="space-y-1">
            {q.choices.map((c, j) => {
              const correct = submitted && j === q.answer;
              const wrong = submitted && answers[i] === j && j !== q.answer;
              return (
                <Button key={j} variant={answers[i] === j ? "secondary" : "outline"} size="sm"
                  className={`w-full justify-start ${correct ? "border-success text-success" : ""} ${wrong ? "border-destructive text-destructive" : ""}`}
                  onClick={() => !submitted && setAnswers(a => { const n = [...a]; n[i] = j; return n; })}>
                  {String.fromCharCode(65 + j)}. {c}
                </Button>
              );
            })}
          </div>
          {submitted && <p className="text-xs text-muted-foreground">{q.explanation}</p>}
        </Card>
      ))}
      {questions.length > 0 && !submitted && <Button onClick={submit} className="w-full gradient-primary shadow-glow">Submit answers</Button>}
    </div>
  );
}