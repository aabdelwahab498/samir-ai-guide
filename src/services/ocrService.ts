import { createWorker } from "tesseract.js";
import { pageToImageDataUrl } from "@/utils/pdfToImage";
import { supabase } from "@/integrations/supabase/client";

// ===== Fully offline OCR =====
// All assets served from /public/tesseract — never CDN.

export type OcrLang = "eng" | "ara" | "eng+ara";

const REQUIRED_FILES = [
  "/tesseract/worker/worker.min.js",
  "/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "/tesseract/core/tesseract-core-simd-lstm.wasm",
];
const LANG_FILES: Record<string, string> = {
  eng: "/tesseract/tessdata/eng.traineddata.gz",
  ara: "/tesseract/tessdata/ara.traineddata.gz",
};

let assetsChecked: { ok: boolean; missing: string[] } | null = null;

export async function checkOcrAssets(lang: OcrLang = "eng+ara") {
  if (assetsChecked) return assetsChecked;
  const langs = lang.split("+");
  const targets = [...REQUIRED_FILES, ...langs.map((l) => LANG_FILES[l]).filter(Boolean)];
  const missing: string[] = [];
  await Promise.all(
    targets.map(async (url) => {
      try {
        const r = await fetch(url, { method: "HEAD" });
        if (!r.ok) missing.push(url);
      } catch {
        missing.push(url);
      }
    })
  );
  assetsChecked = { ok: missing.length === 0, missing };
  return assetsChecked;
}

// ===== Single-worker pool with queue =====
let workerPromise: Promise<any> | null = null;
let workerLang: string | null = null;
let queue: Promise<any> = Promise.resolve();

async function getWorker(lang: OcrLang) {
  if (workerPromise && workerLang === lang) return workerPromise;
  if (workerPromise) await terminateOcr();
  workerLang = lang;
  workerPromise = createWorker(lang, 1, {
    workerPath: "/tesseract/worker/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/tessdata",
    gzip: true,
    cacheMethod: "none",
  } as any);
  return workerPromise;
}

export async function terminateOcr() {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {}
  }
  workerPromise = null;
  workerLang = null;
}

// Serialize OCR work (single-worker pool)
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

// ===== Hashing for cache key =====
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ===== Supabase cache lookup / write =====
async function cacheGet(userId: string | null, fileHash: string, page: number, lang: OcrLang) {
  if (!userId) return null;
  const { data } = await supabase
    .from("ocr_cache" as any)
    .select("text")
    .eq("user_id", userId)
    .eq("file_hash", fileHash)
    .eq("page_num", page)
    .eq("lang", lang)
    .maybeSingle();
  return (data as any)?.text ?? null;
}
async function cachePut(userId: string | null, fileHash: string, page: number, lang: OcrLang, text: string) {
  if (!userId) return;
  await supabase.from("ocr_cache" as any).upsert(
    { user_id: userId, file_hash: fileHash, page_num: page, lang, text },
    { onConflict: "user_id,file_hash,page_num,lang" }
  );
}

// ===== Cancellation =====
export class OcrCancelledError extends Error {
  constructor() { super("OCR cancelled"); }
}
export interface OcrController { cancel(): void; cancelled: boolean }
export function createOcrController(): OcrController {
  const c: OcrController = { cancelled: false, cancel() { c.cancelled = true; } };
  return c;
}

// ===== Public: OCR a single page (with cache + queue) =====
export async function ocrPdfPage(
  file: File | ArrayBuffer,
  pageNum: number,
  lang: OcrLang = "eng+ara",
  opts: { fileHash?: string; userId?: string | null; controller?: OcrController } = {}
): Promise<string> {
  const { fileHash, userId = null, controller } = opts;
  if (controller?.cancelled) throw new OcrCancelledError();

  if (fileHash) {
    const cached = await cacheGet(userId, fileHash, pageNum, lang);
    if (cached !== null) return cached;
  }

  const assets = await checkOcrAssets(lang);
  if (!assets.ok) {
    throw new Error(`OCR assets missing locally: ${assets.missing.join(", ")}`);
  }

  return enqueue(async () => {
    if (controller?.cancelled) throw new OcrCancelledError();
    const dataUrl = await pageToImageDataUrl(file, pageNum, 2);
    if (controller?.cancelled) throw new OcrCancelledError();
    const worker = await getWorker(lang);
    const { data } = await worker.recognize(dataUrl);
    const text = data.text || "";
    if (fileHash) await cachePut(userId, fileHash, pageNum, lang, text);
    return text;
  });
}
