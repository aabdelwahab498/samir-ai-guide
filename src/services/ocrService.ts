import { createWorker } from "tesseract.js";
import { pageToImageDataUrl } from "@/utils/pdfToImage";
import { supabase } from "@/integrations/supabase/client";

// ===== Fully offline OCR =====
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

const assetsCache = new Map<string, { ok: boolean; missing: string[] }>();

export async function checkOcrAssets(lang: OcrLang = "eng+ara") {
  if (assetsCache.has(lang)) return assetsCache.get(lang)!;
  const langs = lang.split("+");
  const targets = [...REQUIRED_FILES, ...langs.map((l) => LANG_FILES[l]).filter(Boolean)];
  const missing: string[] = [];
  await Promise.all(
    targets.map(async (url) => {
      try {
        const r = await fetch(url, { method: "HEAD" });
        if (!r.ok) missing.push(url);
      } catch { missing.push(url); }
    })
  );
  const result = { ok: missing.length === 0, missing };
  assetsCache.set(lang, result);
  return result;
}

// ===== Single-worker pool with serial queue =====
export const MAX_OCR_WORKERS = 1;
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
  const p = workerPromise;
  workerPromise = null;
  workerLang = null;
  if (p) {
    try { const w = await p; await w.terminate(); } catch {}
  }
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

// ===== Hashing =====
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ===== Cache =====
async function cacheGet(userId: string | null, fileHash: string, page: number, lang: OcrLang) {
  if (!userId) return null;
  const { data } = await supabase
    .from("ocr_cache" as any)
    .select("text")
    .eq("user_id", userId).eq("file_hash", fileHash).eq("page_num", page).eq("lang", lang)
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
  constructor() { super("OCR cancelled"); (this as any).name = "OcrCancelledError"; }
}
export interface OcrController {
  cancelled: boolean;
  cancel(): void;
  onCancel(cb: () => void): void;
}
export function createOcrController(): OcrController {
  const cbs: Array<() => void> = [];
  const c: OcrController = {
    cancelled: false,
    cancel() {
      if (c.cancelled) return;
      c.cancelled = true;
      cbs.splice(0).forEach((fn) => { try { fn(); } catch {} });
    },
    onCancel(cb) { c.cancelled ? cb() : cbs.push(cb); },
  };
  return c;
}

function throwIfCancelled(c?: OcrController) {
  if (c?.cancelled) throw new OcrCancelledError();
}

// ===== OCR a single page =====
export interface OcrPageOptions {
  fileHash?: string;
  userId?: string | null;
  controller?: OcrController;
  maxRetries?: number; // default 2
}
export interface OcrPageResult {
  text: string;
  fromCache: boolean;
  attempts: number;
  error?: string;
}

export async function ocrPdfPage(
  file: File | ArrayBuffer,
  pageNum: number,
  lang: OcrLang = "eng+ara",
  opts: OcrPageOptions = {}
): Promise<OcrPageResult> {
  const { fileHash, userId = null, controller, maxRetries = 2 } = opts;
  throwIfCancelled(controller);

  if (fileHash) {
    const cached = await cacheGet(userId, fileHash, pageNum, lang);
    if (cached !== null) return { text: cached, fromCache: true, attempts: 0 };
  }

  const assets = await checkOcrAssets(lang);
  if (!assets.ok) throw new Error(`OCR assets missing locally: ${assets.missing.join(", ")}`);

  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    throwIfCancelled(controller);
    try {
      const text = await enqueue(async () => {
        throwIfCancelled(controller);
        const dataUrl = await pageToImageDataUrl(file, pageNum, 2);
        throwIfCancelled(controller);
        const worker = await getWorker(lang);
        // race against cancel for instant abort
        const racer = new Promise<never>((_, rej) => controller?.onCancel(() => rej(new OcrCancelledError())));
        const { data } = await Promise.race([worker.recognize(dataUrl), racer]) as any;
        return (data?.text as string) || "";
      });
      if (fileHash) await cachePut(userId, fileHash, pageNum, lang, text);
      return { text, fromCache: false, attempts: attempt };
    } catch (e: any) {
      if (e instanceof OcrCancelledError) throw e;
      lastErr = e;
      console.warn(`OCR page ${pageNum} attempt ${attempt} failed:`, e?.message ?? e);
      // reset worker on error before retry
      await terminateOcr().catch(() => {});
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  return { text: "", fromCache: false, attempts: maxRetries + 1, error: String(lastErr?.message ?? lastErr) };
}
