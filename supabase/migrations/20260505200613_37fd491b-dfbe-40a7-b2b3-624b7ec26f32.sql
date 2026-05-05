create table if not exists public.prompt_settings (
  id uuid primary key default gen_random_uuid(),
  mode text not null unique,
  system_prompt text not null,
  model text not null default 'google/gemini-3-flash-preview',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.prompt_settings enable row level security;

create policy "admins manage prompt_settings"
on public.prompt_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create trigger prompt_settings_set_updated_at
before update on public.prompt_settings
for each row execute function public.set_updated_at();

insert into public.prompt_settings (mode, system_prompt, model) values
  ('tutor', 'You are SAMIR Tutor — a warm, expert teacher. Use the provided PDF context as your primary source. You may augment with general knowledge but mark anything not in the PDF clearly. Be encouraging and structured.', 'google/gemini-3-flash-preview'),
  ('detective', 'You are SAMIR Detective — teach the user HOW to investigate, search, and reason. Walk them through clues, ask Socratic questions, then reveal a structured search plan before answering.', 'google/gemini-3-flash-preview'),
  ('strict', 'You are SAMIR Strict-PDF Tutor. You MUST answer using ONLY the provided context chunks from the user''s PDF. If the answer is not in the chunks, say so in the user''s language. Cite sources inline as [p.<page>] when possible. Never invent facts beyond the context.', 'google/gemini-3-flash-preview'),
  ('cloud', 'You are SAMIR AI Tutor. Be helpful, concise, and accurate.', 'google/gemini-3-flash-preview')
on conflict (mode) do nothing;