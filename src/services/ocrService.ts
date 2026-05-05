import { createWorker } from "tesseract.js";
import { pageToImageDataUrl } from "@/utils/pdfToImage";

// Fully offline OCR: all assets served from /public/tesseract (no CDN calls).
let workerPromise: Promise<any> | null = null;

async function getWorker(lang = "eng+ara") {
  if (workerPromise) return workerPromise;
  workerPromise = createWorker(lang, 1, {
    workerPath: "/tesseract/worker/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/tessdata",
    gzip: true,
    cacheMethod: "none",
  } as any);
  return workerPromise;
}

export async function ocrPdfPage(
  file: File | ArrayBuffer,
  pageNum: number,
  lang = "eng+ara"
): Promise<string> {
  const dataUrl = await pageToImageDataUrl(file, pageNum, 2);
  const worker = await getWorker(lang);
  const { data } = await worker.recognize(dataUrl);
  return data.text || "";
}

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}