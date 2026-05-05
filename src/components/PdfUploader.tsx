import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, X, AlertTriangle } from "lucide-react";
import { processPdf } from "@/lib/pdfService";
import { embedAndStoreChunks } from "@/services/ragService";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { checkOcrAssets, createOcrController, terminateOcr, type OcrLang } from "@/services/ocrService";

export default function PdfUploader({ onDone }: { onDone?: (pdfId: string, title: string) => void }) {
  const { user, isGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [pageInfo, setPageInfo] = useState<{ p: number; t: number } | null>(null);
  const [pct, setPct] = useState(0);
  const [lang, setLang] = useState<OcrLang>("eng+ara");
  const [missing, setMissing] = useState<string[]>([]);
  const controllerRef = useRef(createOcrController());

  useEffect(() => {
    checkOcrAssets(lang).then((r) => setMissing(r.ok ? [] : r.missing));
  }, [lang]);

  useEffect(() => () => { terminateOcr().catch(() => {}); }, []);

  function cancel() {
    controllerRef.current.cancel();
    toast.message("Cancelling…");
  }

  async function handleFile(file: File) {
    if (!user) { toast.error("Sign in to upload PDFs (guests can chat without PDF)."); return; }
    const assets = await checkOcrAssets(lang);
    if (!assets.ok) {
      toast.error(`Missing OCR files: ${assets.missing.join(", ")}`);
      setMissing(assets.missing);
      return;
    }
    controllerRef.current = createOcrController();
    setBusy(true); setPct(0); setStage("reading"); setPageInfo(null);
    try {
      const result = await processPdf(file, {
        lang,
        userId: user.id,
        controller: controllerRef.current,
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
          <p className="text-xs text-muted-foreground">Text + OCR + RAG indexing happens automatically.</p>
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
        {isGuest && <p className="text-xs text-warning">Guest mode: sign in to save PDFs.</p>}
      </div>
    </Card>
  );
}
