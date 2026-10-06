# 🎓 SAMIR AI Tutor — Project Documentation

A production-grade AI learning platform that turns any PDF into an interactive learning experience: chat with your documents, generate quizzes, track progress, and study with others — in any language, on any device.

---

## Table of Contents

1. [Overview](#overview)
2. [Feature Modules](#feature-modules)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Database Schema](#database-schema)
6. [Edge Functions](#edge-functions)
7. [PDF + OCR Pipeline](#pdf--ocr-pipeline)
8. [RAG System](#rag-system)
9. [Chat Modes](#chat-modes)
10. [Internationalization (i18n)](#internationalization-i18n)
11. [Theming](#theming)
12. [PWA & Mobile (Capacitor)](#pwa--mobile-capacitor)
13. [Admin Panel](#admin-panel)
14. [Security & RLS](#security--rls)
15. [Optional FastAPI Backend](#optional-fastapi-backend)
16. [Environment Variables](#environment-variables)
17. [Local Development](#local-development)
18. [Deployment](#deployment)

---

## Overview

SAMIR AI Tutor is a multi-tenant SaaS learning platform. A student uploads a PDF → the app extracts text (with OCR fallback for scanned pages) → chunks and embeds it → the student can chat with the document in 5 AI modes, generate quizzes, track weak topics, schedule study sessions, and collaborate in groups and a community feed.

Everything runs on **Lovable Cloud** (Postgres + RLS + Edge Functions + Storage + AI Gateway). No external server is required. An optional Python/FastAPI backend exists as a separate deployable for server-side OCR and heavier processing.

---

## Feature Modules

| Module | Route | Description |
|---|---|---|
| Landing | `/` | Public marketing page |
| Auth | `/auth` | Email/password sign up & sign in, guest mode |
| Home | `/app` | PDF library, chat mode selector, previous chats, main chat panel |
| Tutor | `/app/tutor` | Dedicated tutor-mode chat |
| Detective | `/app/detective` | Socratic/investigative learning chat |
| Quiz | `/app/quiz` | AI-generated quizzes from PDFs, attempts & scoring |
| Tracker | `/app/tracker` | Study sessions, minutes, weak topics, coins |
| Multi Chats | `/app/chats` | Manage multiple conversations |
| Schedule | `/app/schedule` | Study schedule / calendar items |
| Groups | `/app/groups` | Study groups with members & roles |
| Community | `/app/community` | Public posts with likes |
| About | `/app/about` | About page |
| Admin | `/app/admin` | Prompt & model management per mode + live prompt testing (admin only) |

---

## Architecture

```
React 18 + Vite (SPA)
    │
    ├── src/pages/            ← route pages (public + /app/*)
    ├── src/components/       ← UI (PdfUploader, ChatPanel, AppShell, …)
    ├── src/services/         ← aiService, ragService, ocrService
    ├── src/lib/              ← supabaseClient, pdfService, webllmService, backendClient
    ├── src/hooks/            ← useAuth, useTheme, useIsAdmin
    ├── src/i18n/             ← i18next + locales (en, ar, fr, es)
    │
    ▼
Lovable Cloud (Supabase)
    ├── Postgres + pgvector   ← pdfs, pdf_chunks, chats, messages, quizzes, …
    ├── Row Level Security    ← per-user isolation on every table
    ├── Storage bucket: pdfs  ← private PDF files
    ├── Auth                  ← email/password (auto-confirm enabled), guest mode
    └── Edge Functions (Deno)
            ├── chat        ← streams from Lovable AI Gateway (Gemini default)
            ├── embed       ← embeddings for RAG
            └── hf-fallback ← HuggingFace fallback (needs HF_API_KEY)
```

---

## Tech Stack

- **Frontend:** React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui, react-router-dom, TanStack Query
- **i18n:** i18next + react-i18next (browser detection, RTL support)
- **PDF:** pdfjs-dist (static Vite worker, no CDN)
- **OCR:** Tesseract.js — fully offline (worker + WASM core + lang packs bundled in `/public/tesseract/`)
- **Offline AI:** WebLLM (TinyLlama loaded lazily from CDN at runtime, never bundled)
- **Backend:** Lovable Cloud — Postgres + pgvector, RLS, Storage, Edge Functions (Deno)
- **AI:** Lovable AI Gateway (Google Gemini default, GPT-5 variants available), HuggingFace fallback
- **PWA/Mobile:** vite-plugin-pwa (service worker + caching), Capacitor for native iOS/Android

---

## Database Schema

All tables live in `public` with RLS enabled. Every user-facing table is scoped by `user_id = auth.uid()`.

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | User profile | `id`, `display_name`, `avatar_url`, `coins`, `study_minutes` |
| `user_roles` | Role assignment | `user_id`, `role` (`admin` / `user`) |
| `pdfs` | Uploaded documents | `title`, `storage_path`, `pages`, `total_chars`, `used_ocr`, `status` |
| `pdf_chunks` | RAG chunks | `pdf_id`, `chunk_index`, `page`, `content`, `embedding` (vector) |
| `ocr_cache` | OCR results cache | `file_hash`, `page_num`, `lang`, `text` |
| `chats` | Conversations | `title`, `mode`, `pdf_id` |
| `messages` | Chat messages | `chat_id`, `role`, `content`, `citations` (jsonb) |
| `quizzes` | Generated quizzes | `pdf_id`, `title`, `questions` (jsonb) |
| `quiz_attempts` | Quiz results | `score`, `total`, `answers`, `weak_topics` |
| `weak_topics` | Per-user weak topics | `topic`, `weight` |
| `study_sessions` | Study time log | `duration_minutes`, `topic` |
| `schedule_items` | Calendar | `title`, `starts_at`, `ends_at`, `done` |
| `groups` / `group_members` | Study groups | `owner_id`, `name` / `group_id`, `role` |
| `community_posts` | Community feed | `title`, `body`, `likes` |
| `prompt_settings` | Admin prompt config | `mode`, `system_prompt`, `model` (admin-managed) |

**Helper functions:** `has_role(user_id, role)`, `is_group_member(group_id, user_id)`, `match_pdf_chunks(query_embedding, match_count, p_pdf_id, p_user_id)` (cosine similarity search), `handle_new_user()` trigger (creates profile + role on signup), `set_updated_at()` trigger.

---

## Edge Functions

Located in `supabase/functions/`.

### `chat`
- Streams chat completions from the Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`).
- Loads the per-mode system prompt + model from `prompt_settings` (admin-editable), falling back to built-in defaults.
- Injects a **LANGUAGE RULE**: always reply in the language of the user's last message (any language), plus a `lang` hint from the browser.
- Injects RAG context block (`--- PDF CONTEXT ---`) when provided.
- Returns `429` on rate limit, `402` on exhausted AI credits.

### `embed`
- Generates embeddings for text input(s). Currently a deterministic hash-trigram embedding (768-dim) so RAG works out of the box; swap in a real embedding model later.

### `hf-fallback`
- HuggingFace inference fallback when the gateway fails. Inert until `HF_API_KEY` secret is added.

---

## PDF + OCR Pipeline

Implemented in `src/lib/pdfService.ts` + `src/services/ocrService.ts` + `src/components/PdfUploader.tsx`.

1. **Upload** — file validated (type/size), stored in the private `pdfs` bucket, row created in `pdfs`.
2. **Text extraction** — pdfjs-dist extracts text per page.
3. **OCR fallback** — pages with no extractable text are rendered to images and OCR'd with Tesseract.js.
4. **Offline OCR** — worker, WASM core, and language packs (`eng`, `ara`) are served locally from `/public/tesseract/`; no CDN needed.
5. **Pre-flight check** — before OCR starts, the app verifies all Tesseract files exist and shows a clear warning listing missing files/languages.
6. **Progress + cancel** — page-by-page progress callback (no UI freeze), instant cancel button that terminates workers and resets state safely.
7. **Retry** — failed pages retry automatically (max 2 attempts, worker reset + backoff); per-page failures are logged with `pageNum` and reason.
8. **Cache** — OCR results are stored in `ocr_cache` keyed by SHA-256 file hash + page number + language, so re-uploading the same file skips OCR entirely.
9. **Concurrency** — single worker (`MAX_OCR_WORKERS = 1`) with a serial queue; worker fully terminated after each PDF, on language switch, cancel, or unmount.
10. **Summary** — after processing, the uploader shows: pages count, cached vs OCR'd pages, chunks, characters, elapsed time, and failed pages.
11. **Language selection** — per-PDF OCR language (`eng` / `ara` / `eng+ara`) with local availability verification.

---

## RAG System

`src/services/ragService.ts`:

- `embedAndStoreChunks(pdfId, userId, chunks)` — batches (16) through the `embed` function, inserts into `pdf_chunks` with embeddings.
- `retrieve(query, { pdfId, userId, k })` — embeds the query, calls `match_pdf_chunks` RPC (cosine distance `<=>`), returns top-k chunks with similarity scores.
- Retrieved chunks are injected into the chat system prompt as the PDF context block.

---

## Chat Modes

| Mode | Behavior |
|---|---|
| 🎓 `tutor` | Warm expert teacher; PDF context is primary source, general knowledge clearly marked |
| 🕵️ `detective` | Teaches HOW to investigate: Socratic questions, clues, structured search plan |
| 📄 `strict` | Answers ONLY from PDF chunks; cites `[p.<page>]`; refuses out-of-PDF questions |
| 🤖 `offline` | WebLLM (TinyLlama) in-browser; falls back to cloud if unavailable |
| ☁️ `cloud` | General helpful assistant |

Streaming is parsed from SSE in `src/services/aiService.ts`. Messages persist to `messages` table per `chat_id`; previous chats are listed and reloadable from the Home sidebar.

---

## Internationalization (i18n)

- i18next with browser-language detection and localStorage persistence.
- Locales: **English, العربية (RTL), Français, Español** in `src/i18n/locales/`.
- Switching to Arabic flips the document to `dir="rtl"` automatically.
- **AI responses follow the user's message language — any language**, not just the 4 UI locales (enforced by the LANGUAGE RULE in the chat edge function).
- To add a UI language: create `src/i18n/locales/<code>.json` and register it in `src/i18n/index.ts`.

---

## Theming

- Light / Dark / System via `ThemeProvider` (`src/hooks/useTheme.tsx`); default follows the device.
- All colors are semantic tokens in `src/index.css` + `tailwind.config.ts` — never hardcoded utilities.
- Theme menu in the app header (sun/moon/monitor).

---

## PWA & Mobile (Capacitor)

- **PWA:** `vite-plugin-pwa` with `autoUpdate`. Service worker registers only in production (disabled in Lovable preview/iframes).
  - HTML: `NetworkFirst` (3s timeout → cache fallback)
  - JS/CSS/fonts/workers: `StaleWhileRevalidate`
  - Images: `CacheFirst` (30 days, 200 entries)
  - Tesseract OCR files: `CacheFirst` (60 days) → OCR works offline after first use
- **Responsive:** bottom tab navigation on mobile, sidebar on desktop.
- **Native:** `capacitor.config.ts` is ready. To build native apps:
  ```bash
  npm install
  npx cap add ios        # and/or: npx cap add android
  npm run build && npx cap sync
  npx cap run ios        # or: npx cap run android
  ```

---

## Admin Panel

Route `/app/admin`, visible only to users with the `admin` role (`user_roles` table, checked via `useIsAdmin`).

- Edit the **system prompt** and **model** per chat mode (stored in `prompt_settings`, enforced by the `chat` edge function).
- **"Test the prompt"** button per mode: saves the prompt, sends a sample question through the real chat pipeline, and streams the response inline.
- Available models: `google/gemini-3-flash-preview` (default), `google/gemini-2.5-flash`, `google/gemini-2.5-flash-lite`, `google/gemini-2.5-pro`, GPT-5 variants.

To make a user admin:
```sql
insert into public.user_roles (user_id, role) values ('<user-uuid>', 'admin');
```

---

## Security & RLS

- RLS enabled on every table; policies scope all user data to `auth.uid()`.
- `prompt_settings` and `user_roles` are admin-only via the `has_role()` SECURITY DEFINER function.
- Private `pdfs` storage bucket — files are only accessible to their owner.
- Upload validation: file type and size limits, input sanitization.
- Guest mode: uploads disabled, clear sign-up CTAs, exit-guest button.
- Known linter notes (accepted by design): pgvector extension lives in `public` (required by `pdf_chunks.embedding`), and the SECURITY DEFINER helpers (`has_role`, `is_group_member`, `match_pdf_chunks`) must be callable by authenticated users to function.

---

## Optional FastAPI Backend

A full Python/FastAPI backend (server-side PyMuPDF + Tesseract OCR, RAG, chat orchestration, quiz generation) is available as a separate deployable package. The frontend integrates via `src/lib/backendClient.ts`:

- Set `VITE_BACKEND_URL` → uploads/chat route to FastAPI.
- Leave it empty → the app uses Edge Functions + in-browser OCR (default, fully functional).

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` | `.env` (auto-generated, do not edit) | Lovable Cloud connection |
| `VITE_BACKEND_URL` | `.env` (optional) | FastAPI backend URL |
| `LOVABLE_API_KEY` | Cloud secret (auto) | AI Gateway access for edge functions |
| `HF_API_KEY` | Cloud secret (optional) | HuggingFace fallback |

---

## Local Development

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build
npm run test       # vitest
```

---

## Deployment

1. Click **Publish** in Lovable → get a public `*.lovable.app` URL (PWA + service worker activate here).
2. Optional: connect a custom domain.
3. Optional native apps: export to GitHub and follow the Capacitor steps above.
