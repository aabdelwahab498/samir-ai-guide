import { supabase } from "@/integrations/supabase/client";

/**
 * Optional FastAPI backend (samir-backend).
 * Enabled when VITE_BACKEND_URL is set. Otherwise the app falls back to
 * Supabase Edge Functions + client-side processing.
 */
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");
export const BACKEND_ENABLED = Boolean(BACKEND_URL);

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BACKEND_ENABLED) throw new Error("Backend URL not configured");
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...(init.headers as Record<string, string> | undefined),
  };
  const r = await fetch(`${BACKEND_URL}${path}`, { ...init, headers });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Backend ${r.status}: ${text || r.statusText}`);
  }
  return r.json() as Promise<T>;
}

// ---------- PDF ----------
export interface BackendUploadResult {
  document_id: string;
  chunks_count: number;
  pages: number;
  used_ocr: boolean;
  processing_time_ms: number;
}
export async function backendUploadPdf(file: File): Promise<BackendUploadResult> {
  const headers = await authHeader();
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${BACKEND_URL}/api/pdf/upload`, { method: "POST", headers, body: fd });
  if (!r.ok) throw new Error(`Backend ${r.status}: ${await r.text().catch(() => "")}`);
  return r.json();
}

// ---------- RAG ----------
export interface BackendChunk {
  id: string; pdf_id: string; content: string; page: number | null; similarity: number;
}
export function backendRagQuery(query: string, document_id?: string, top_k = 5) {
  return request<{ chunks: BackendChunk[]; elapsed_ms: number }>("/api/rag/query", {
    method: "POST",
    body: JSON.stringify({ query, document_id, top_k }),
  });
}

// ---------- Chat ----------
export interface BackendChatMessage { role: "user" | "assistant" | "system"; content: string }
export function backendChat(args: {
  messages: BackendChatMessage[];
  document_id?: string;
  mode?: "tutor" | "detective" | "strict" | "cloud";
  chat_id?: string;
}) {
  return request<{ answer: string; citations: BackendChunk[] }>("/api/chat", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

// ---------- Quiz ----------
export function backendGenerateQuiz(args: {
  document_id: string; num_questions?: number;
  difficulty?: "easy" | "medium" | "hard";
}) {
  return request<{ quiz_id: string; questions: any[] }>("/api/quiz/generate", {
    method: "POST",
    body: JSON.stringify(args),
  });
}