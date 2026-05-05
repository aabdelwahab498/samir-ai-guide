import { pdfjsLib } from "@/config/pdfConfig";
import { ocrPdfPage } from "@/services/ocrService";
import { chunkText, type Chunk } from "@/utils/chunking";

export interface ProcessedPdf {
  pages: number;
  chunks: Chunk[];
  usedOcr: boolean;
  totalChars: number;
}

export async function processPdf(
  file: File,
  onProgress?: (p: { stage: string; page?: number; total?: number }) => void
): Promise<ProcessedPdf> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const allChunks: Chunk[] = [];
  let usedOcr = false;
  let totalChars = 0;
  let runningIndex = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.({ stage: "extracting", page: p, total: pdf.numPages });
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let text = tc.items.map((it: any) => it.str).join(" ").trim();

    if (text.length < 40) {
      onProgress?.({ stage: "ocr", page: p, total: pdf.numPages });
      try { text = await ocrPdfPage(buf.slice(0), p); usedOcr = true; } catch (e) { console.error("OCR failed", e); }
    }

    totalChars += text.length;
    const pageChunks = chunkText(text, p);
    for (const c of pageChunks) { c.index = runningIndex++; allChunks.push(c); }
    // yield to UI
    await new Promise(r => setTimeout(r, 0));
  }
  return { pages: pdf.numPages, chunks: allChunks, usedOcr, totalChars };
}