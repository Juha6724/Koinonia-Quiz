create extension if not exists "pgcrypto";

create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  player_name text not null check (char_length(player_name) between 1 and 20),
  elapsed_ms integer not null check (elapsed_ms >= 0 and elapsed_ms <= 60000),
  quiz_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists rankings_created_at_elapsed_ms_idx
  on public.rankings (created_at, elapsed_ms);

alter table public.rankings enable row level security;

-- The app uses SUPABASE_SERVICE_ROLE_KEY from Next.js API routes.
-- Keep direct anonymous access disabled unless you intentionally add policies later.
