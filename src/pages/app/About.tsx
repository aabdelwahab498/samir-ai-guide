import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
export default function About() {
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl gradient-primary grid place-items-center"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
        <h1 className="text-2xl font-bold">About SAMIR AI Tutor</h1></div>
      <Card className="p-6 space-y-3 text-sm leading-relaxed">
        <p>SAMIR is a production-grade AI learning platform combining offline-first WebLLM, cloud LLMs, RAG over your PDFs, OCR for scanned documents, multi-mode tutoring, quizzes, tracking, and community.</p>
        <p className="text-muted-foreground">Built on React + Vite + Tailwind, Lovable Cloud (Postgres + RLS + edge functions + pgvector), pdfjs-dist with a static Vite worker (no CDN), Tesseract.js for OCR, and the Lovable AI Gateway with HuggingFace fallback.</p>
      </Card>
    </div>
  );
}