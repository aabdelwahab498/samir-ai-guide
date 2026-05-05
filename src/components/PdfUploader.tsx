import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { processPdf, type ProcessedPdf } from "@/lib/pdfService";
import { embedAndStoreChunks } from "@/services/ragService";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { checkOcrAssets, createOcrController, terminateOcr, MAX_OCR_WORKERS, type OcrLang, type OcrController } from "@/services/ocrService";

export default function PdfUploader({ onDone }: { onDone?: (pdfId: string, title: string) => void }) {
  const { user, isGuest, disableGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [pageInfo, setPageInfo] = useState<{ p: number; t: number } | null>(null);
  const [pct, setPct] = useState(0);
  const [lang, setLang] = useState<OcrLang>("eng+ara");
  const [missing, setMissing] = useState<string[]>([]);
  const [summary, setSummary] = useState<(ProcessedPdf & { fileName: string }) | null>(null);
  const controllerRef = useRef<OcrController | null>(null);

  useEffect(() => {
    checkOcrAssets(lang).then((r) => setMissing(r.ok ? [] : r.missing));
    // language switch → recycle worker to free memory
    terminateOcr().catch(() => {});
  }, [lang]);

  useEffect(() => () => {
    controllerRef.current?.cancel();
    terminateOcr().catch(() => {});
  }, []);

  function cancel() {
    controllerRef.current?.cancel();
    toast.message("Cancelling…");
    terminateOcr().catch(() => {});
  }

  async function handleFile(file: File) {
    if (!user) { toast.error("Please sign up or sign in to upload PDFs."); return; }
    const assets = await checkOcrAssets(lang);
    if (!assets.ok) { toast.error(`Missing OCR files: ${assets.missing.join(", ")}`); setMissing(assets.missing); return; }

    const ctrl = createOcrController();
    controllerRef.current = ctrl;
    setBusy(true); setPct(0); setStage("reading"); setPageInfo(null); setSummary(null);
    try {
      const result = await processPdf(file, {
        lang, userId: user.id, controller: ctrl,
        onProgress: ({ stage, page, total, pct }) => {
          setStage(stage);
          if (page && total) setPageInfo({ p: page, t: total });
          if (typeof pct === "number") setPct(Math.min(70, pct));
        },
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
      setSummary({ ...result, fileName: file.name });
      toast.success(`Indexed ${result.chunks.length} chunks from ${file.name}`);
      onDone?.(pdfRow.id, file.name);
    } catch (e: any) {
      if (e?.name === "OcrCancelledError" || e?.message === "OCR cancelled") {
        toast.warning("Processing cancelled");
      } else {
        console.error(e); toast.error(e?.message ?? "Upload failed");
      }
    } finally {
      setBusy(false);
      controllerRef.current = null;
      await terminateOcr().catch(() => {});
    }
  }

  return (
    <Card className="p-6 border-dashed border-2 hover:border-primary/50 transition-colors">
      <div className="text-center space-y-3">
        <div className="h-12 w-12 mx-auto rounded-xl gradient-primary grid place-items-center">
          <FileText className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Upload a PDF</h3>
          <p className="text-xs text-muted-foreground">Text + OCR + RAG indexing happens automatically. (Workers: {MAX_OCR_WORKERS})</p>
        </div>

        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">OCR language:</span>
          <Select value={lang} onValueChange={(v) => setLang(v as OcrLang)} disabled={busy}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="eng">English</SelectItem>
              <SelectItem value="ara">Arabic</SelectItem>
              <SelectItem value="eng+ara">English + Arabic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {missing.length > 0 && (
          <div className="text-xs text-destructive flex items-center justify-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Missing: {missing.join(", ")}
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <label>
            <input type="file" accept="application/pdf" hidden disabled={busy || missing.length > 0}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }} />
            <Button asChild disabled={busy || missing.length > 0} className="gradient-primary shadow-glow">
              <span>{busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{stage}{pageInfo ? ` ${pageInfo.p}/${pageInfo.t}` : ""}…</> : <><Upload className="h-4 w-4 mr-2" />Choose PDF</>}</span>
            </Button>
          </label>
          {busy && (
            <Button variant="outline" size="sm" onClick={cancel}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          )}
        </div>

        {busy && <Progress value={pct} className="mt-2" />}
        {isGuest && !user && (
          <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
            <p className="font-medium">Guest mode — uploads are disabled</p>
            <p className="text-muted-foreground">Create a free account to upload PDFs, run OCR, and save your library.</p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" className="gradient-primary shadow-glow" asChild>
                <Link to="/auth" onClick={() => disableGuest()}>Sign up / Sign in</Link>
              </Button>
            </div>
          </div>
        )}

        {summary && (
          <div className="mt-3 text-left rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-3 w-3 text-success" />
              {summary.fileName}
            </div>
            <div>Pages: <b>{summary.pages}</b> · OCR run: <b>{summary.ocrPagesRun}</b> · From cache: <b>{summary.ocrPagesCached}</b></div>
            <div>Chunks: <b>{summary.chunks.length}</b> · Chars: <b>{summary.totalChars.toLocaleString()}</b> · Time: <b>{(summary.durationMs / 1000).toFixed(1)}s</b></div>
            {summary.failures.length > 0 && (
              <div className="text-destructive">
                Failed pages: {summary.failures.map((f) => `p${f.page}(${f.attempts}x)`).join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
