import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, BarChart3, MessagesSquare, ShieldCheck, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { user, isGuest, enableGuest } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">SAMIR AI Tutor</span>
        </div>
        <div className="flex gap-2">
          {user || isGuest ? (
            <Button asChild className="gradient-primary shadow-glow"><Link to="/app">Open app</Link></Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
              <Button asChild className="gradient-primary shadow-glow"><Link to="/auth">Get started</Link></Button>
            </>
          )}
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs font-medium mb-6">
          <Sparkles className="h-3 w-3 text-primary" /> Offline-first AI learning
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          Learn anything,<br /><span className="text-gradient">grounded in your PDFs.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Upload textbooks, papers, or notes. SAMIR extracts, OCRs, indexes, and answers — strictly from your sources, with multiple AI tutoring modes.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          {user || isGuest ? (
            <Button asChild size="lg" className="gradient-primary shadow-glow"><Link to="/app">Open app</Link></Button>
          ) : (
            <>
              <Button asChild size="lg" className="gradient-primary shadow-glow"><Link to="/auth">Create account</Link></Button>
              <Button size="lg" variant="outline" onClick={() => { enableGuest(); window.location.href = "/app"; }}>Try as guest</Button>
            </>
          )}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { icon: FileText, title: "PDF + OCR pipeline", desc: "Tesseract OCR fallback when PDFs are scanned. Async, no UI freeze." },
          { icon: ShieldCheck, title: "Strict PDF mode", desc: "Zero hallucination — answers strictly cite your uploaded content." },
          { icon: Search, title: "Detective mode", desc: "Learn HOW to investigate, not just answers." },
          { icon: MessagesSquare, title: "Multi-mode chats", desc: "Tutor, Strict, Detective, Offline (WebLLM), Cloud fallback." },
          { icon: BarChart3, title: "Tracker & rewards", desc: "Quizzes, weak topics, study time, coins." },
          { icon: Sparkles, title: "Built on Lovable Cloud", desc: "Auth, Postgres, RLS, vector search, edge functions." },
        ].map((f, i) => (
          <div key={i} className="p-6 rounded-2xl border bg-card shadow-card">
            <div className="h-10 w-10 rounded-lg gradient-primary grid place-items-center mb-3"><f.icon className="h-5 w-5 text-primary-foreground" /></div>
            <h3 className="font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
