import { pdfjsLib } from "@/config/pdfConfig";
import { ocrPdfPage, sha256Hex, OcrCancelledError, type OcrLang, type OcrController, terminateOcr } from "@/services/ocrService";
import { chunkText, type Chunk } from "@/utils/chunking";

export interface ProcessedPdf {
  pages: number;
  chunks: Chunk[];
  usedOcr: boolean;
  totalChars: number;
  fileHash: string;
}

export interface ProcessOptions {
  lang?: OcrLang;
  userId?: string | null;
  controller?: OcrController;
  onProgress?: (p: { stage: string; page?: number; total?: number; pct?: number }) => void;
}

export async function processPdf(file: File, opts: ProcessOptions = {}): Promise<ProcessedPdf> {
  const { lang = "eng+ara", userId = null, controller, onProgress } = opts;
  const buf = await file.arrayBuffer();
  const fileHash = await sha256Hex(buf.slice(0));
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const allChunks: Chunk[] = [];
  let usedOcr = false;
  let totalChars = 0;
  let runningIndex = 0;

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
          text = await ocrPdfPage(buf.slice(0), p, lang, { fileHash, userId, controller });
          usedOcr = true;
        } catch (e) {
          if (e instanceof OcrCancelledError) throw e;
          console.error("OCR failed page", p, e);
        }
      }

      totalChars += text.length;
      const pageChunks = chunkText(text, p);
      for (const c of pageChunks) { c.index = runningIndex++; allChunks.push(c); }
      await new Promise((r) => setTimeout(r, 0)); // yield to UI
    }
    onProgress?.({ stage: "done", pct: 100 });
    return { pages: pdf.numPages, chunks: allChunks, usedOcr, totalChars, fileHash };
  } finally {
    // free OCR worker memory after each PDF
    await terminateOcr().catch(() => {});
  }
}
