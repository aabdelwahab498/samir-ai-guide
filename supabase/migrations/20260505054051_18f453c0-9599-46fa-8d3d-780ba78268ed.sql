
-- Extensions
create extension if not exists vector;

-- =========================
-- ROLES
-- =========================
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admins view all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- =========================
-- PROFILES
-- =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  coins integer not null default 0,
  study_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles select own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles select public basic" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- =========================
-- PDFS + CHUNKS (RAG)
-- =========================
create table public.pdfs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  storage_path text,
  pages integer default 0,
  total_chars integer default 0,
  used_ocr boolean not null default false,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);
alter table public.pdfs enable row level security;
create policy "pdfs own all" on public.pdfs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.pdf_chunks (
  id uuid primary key default gen_random_uuid(),
  pdf_id uuid not null references public.pdfs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  page integer,
  content text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);
alter table public.pdf_chunks enable row level security;
create policy "chunks own all" on public.pdf_chunks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index pdf_chunks_pdf_idx on public.pdf_chunks(pdf_id);
create index pdf_chunks_embedding_idx on public.pdf_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Match function for RAG
create or replace function public.match_pdf_chunks(
  query_embedding vector(768),
  match_count int default 5,
  p_pdf_id uuid default null,
  p_user_id uuid default null
)
returns table (id uuid, pdf_id uuid, content text, page int, similarity float)
language sql stable security definer set search_path = public as $$
  select c.id, c.pdf_id, c.content, c.page,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.pdf_chunks c
  where (p_user_id is null or c.user_id = p_user_id)
    and (p_pdf_id is null or c.pdf_id = p_pdf_id)
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- =========================
-- CHATS + MESSAGES
-- =========================
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  mode text not null default 'tutor',
  pdf_id uuid references public.pdfs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.chats enable row level security;
create policy "chats own all" on public.chats for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger chats_updated_at before update on public.chats for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "messages own all" on public.messages for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index messages_chat_idx on public.messages(chat_id, created_at);

-- =========================
-- QUIZZES
-- =========================
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pdf_id uuid references public.pdfs(id) on delete set null,
  title text not null,
  questions jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.quizzes enable row level security;
create policy "quizzes own all" on public.quizzes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  total integer not null,
  answers jsonb,
  weak_topics text[],
  created_at timestamptz not null default now()
);
alter table public.quiz_attempts enable row level security;
create policy "attempts own all" on public.quiz_attempts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- TRACKER
-- =========================
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_minutes integer not null,
  topic text,
  created_at timestamptz not null default now()
);
alter table public.study_sessions enable row level security;
create policy "sessions own all" on public.study_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.weak_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  weight integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.weak_topics enable row level security;
create policy "weak own all" on public.weak_topics for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- SCHEDULE
-- =========================
create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.schedule_items enable row level security;
create policy "schedule own all" on public.schedule_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- GROUPS
-- =========================
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
alter table public.group_members enable row level security;

create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = _group_id and user_id = _user_id)
$$;

create policy "groups select members" on public.groups for select to authenticated using (public.is_group_member(id, auth.uid()) or owner_id = auth.uid());
create policy "groups insert own" on public.groups for insert to authenticated with check (auth.uid() = owner_id);
create policy "groups update owner" on public.groups for update to authenticated using (auth.uid() = owner_id);
create policy "groups delete owner" on public.groups for delete to authenticated using (auth.uid() = owner_id);

create policy "members select own group" on public.group_members for select to authenticated using (public.is_group_member(group_id, auth.uid()));
create policy "members join self" on public.group_members for insert to authenticated with check (auth.uid() = user_id);
create policy "members leave self" on public.group_members for delete to authenticated using (auth.uid() = user_id);

-- =========================
-- COMMUNITY
-- =========================
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  likes integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.community_posts enable row level security;
create policy "community read all" on public.community_posts for select to authenticated using (true);
create policy "community insert own" on public.community_posts for insert to authenticated with check (auth.uid() = user_id);
create policy "community update own" on public.community_posts for update to authenticated using (auth.uid() = user_id);
create policy "community delete own" on public.community_posts for delete to authenticated using (auth.uid() = user_id);

-- =========================
-- STORAGE BUCKET FOR PDFS
-- =========================
insert into storage.buckets (id, name, public) values ('pdfs','pdfs', false) on conflict (id) do nothing;

create policy "pdfs storage read own" on storage.objects for select to authenticated
using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdfs storage insert own" on storage.objects for insert to authenticated
with check (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdfs storage delete own" on storage.objects for delete to authenticated
using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
