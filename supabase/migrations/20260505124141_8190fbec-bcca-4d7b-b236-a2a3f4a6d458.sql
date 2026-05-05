CREATE TABLE IF NOT EXISTS public.ocr_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_hash text NOT NULL,
  page_num integer NOT NULL,
  lang text NOT NULL DEFAULT 'eng+ara',
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_hash, page_num, lang)
);

ALTER TABLE public.ocr_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_cache own all" ON public.ocr_cache
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ocr_cache_lookup ON public.ocr_cache (user_id, file_hash, page_num, lang);