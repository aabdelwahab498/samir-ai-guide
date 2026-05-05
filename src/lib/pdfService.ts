import { pdfjsLib } from "@/config/pdfConfig";
import { ocrPdfPage, sha256Hex, OcrCancelledError, type OcrLang, type OcrController, terminateOcr } from "@/services/ocrService";
import { chunkText, type Chunk } from "@/utils/chunking";

export interface PageFailure { page: number; error: string; attempts: number }

export interface ProcessedPdf {
  pages: number;
  chunks: Chunk[];
  usedOcr: boolean;
  totalChars: number;
  fileHash: string;
  ocrPagesRun: number;
  ocrPagesCached: number;
  failures: PageFailure[];
  durationMs: number;
}

export interface ProcessOptions {
  lang?: OcrLang;
  userId?: string | null;
  controller?: OcrController;
  onProgress?: (p: { stage: string; page?: number; total?: number; pct?: number }) => void;
}

export async function processPdf(file: File, opts: ProcessOptions = {}): Promise<ProcessedPdf> {
  const { lang = "eng+ara", userId = null, controller, onProgress } = opts;
  const start = performance.now();
  const buf = await file.arrayBuffer();
  const fileHash = await sha256Hex(buf.slice(0));
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const allChunks: Chunk[] = [];
  let usedOcr = false;
  let totalChars = 0;
  let runningIndex = 0;
  let ocrPagesRun = 0;
  let ocrPagesCached = 0;
  const failures: PageFailure[] = [];

  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      if (controller?.cancelled) throw new OcrCancelledError();
      onProgress?.({ stage: "extracting", page: p, total: pdf.numPages, pct: Math.round(((p - 1) / pdf.numPages) * 100) });
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      let text = tc.items.map((it: any) => it.str).join(" ").trim();

      if (text.length < 40) {
        onProgress?.({ stage: "ocr", page: p, total: pdf.numPages, pct: Math.round(((p - 1) / pdf.numPages) * 100) });
        try {
          const r = await ocrPdfPage(buf.slice(0), p, lang, { fileHash, userId, controller });
          text = r.text;
          usedOcr = true;
          if (r.fromCache) ocrPagesCached++;
          else ocrPagesRun++;
          if (r.error) failures.push({ page: p, error: r.error, attempts: r.attempts });
        } catch (e: any) {
          if (e instanceof OcrCancelledError) throw e;
          failures.push({ page: p, error: String(e?.message ?? e), attempts: 0 });
          console.error("OCR failed page", p, e);
        }
      }

      totalChars += text.length;
      const pageChunks = chunkText(text, p);
      for (const c of pageChunks) { c.index = runningIndex++; allChunks.push(c); }
      await new Promise((r) => setTimeout(r, 0));
    }
    onProgress?.({ stage: "done", pct: 100 });
    return {
      pages: pdf.numPages, chunks: allChunks, usedOcr, totalChars, fileHash,
      ocrPagesRun, ocrPagesCached, failures, durationMs: Math.round(performance.now() - start),
    };
  } finally {
    await terminateOcr().catch(() => {});
  }
}
