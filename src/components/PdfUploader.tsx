import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Loader2 } from "lucide-react";
import { processPdf } from "@/lib/pdfService";
import { embedAndStoreChunks } from "@/services/ragService";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function PdfUploader({ onDone }: { onDone?: (pdfId: string, title: string) => void }) {
  const { user, isGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [pct, setPct] = useState(0);

  async function handleFile(file: File) {
    if (!user) { toast.error("Sign in to upload PDFs (guests can chat without PDF)."); return; }
    setBusy(true); setPct(0); setStage("reading");
    try {
      const result = await processPdf(file, ({ stage, page, total }) => {
        setStage(stage);
        if (page && total) setPct(Math.round((page / total) * 70));
      });
      setStage("uploading"); setPct(75);
      const path = `${user.id}/${Date.now()}-${file.name}`;
      await supabase.storage.from("pdfs").upload(path, file, { upsert: false });
      const { data: pdfRow, error } = await supabase.from("pdfs").insert({
        user_id: user.id, title: file.name, storage_path: path,
        pages: result.pages, total_chars: result.totalChars, used_ocr: result.usedOcr, status: "ready",
      }).select().single();
      if (error) throw error;
      setStage("indexing"); setPct(85);
      await embedAndStoreChunks(pdfRow.id, user.id, result.chunks);
      setPct(100); setStage("done");
      toast.success(`Indexed ${result.chunks.length} chunks from ${file.name}`);
      onDone?.(pdfRow.id, file.name);
    } catch (e: any) {
      console.error(e); toast.error(e?.message ?? "Upload failed");
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-6 border-dashed border-2 hover:border-primary/50 transition-colors">
      <div className="text-center space-y-3">
        <div className="h-12 w-12 mx-auto rounded-xl gradient-primary grid place-items-center"><FileText className="h-6 w-6 text-primary-foreground" /></div>
        <div>
          <h3 className="font-semibold">Upload a PDF</h3>
          <p className="text-xs text-muted-foreground">Text + OCR + RAG indexing happens automatically.</p>
        </div>
        <label>
          <input type="file" accept="application/pdf" hidden disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <Button asChild disabled={busy} className="gradient-primary shadow-glow">
            <span>{busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{stage}…</> : <><Upload className="h-4 w-4 mr-2" />Choose PDF</>}</span>
          </Button>
        </label>
        {busy && <Progress value={pct} className="mt-2" />}
        {isGuest && <p className="text-xs text-warning">Guest mode: sign in to save PDFs.</p>}
      </div>
    </Card>
  );
}