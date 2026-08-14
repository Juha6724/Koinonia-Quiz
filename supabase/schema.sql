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

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (char_length(prompt) between 2 and 180),
  visual text check (visual is null or char_length(visual) between 1 and 60),
  choice_1 text not null check (char_length(choice_1) between 1 and 80),
  choice_2 text not null check (char_length(choice_2) between 1 and 80),
  choice_3 text not null check (char_length(choice_3) between 1 and 80),
  choice_4 text not null check (char_length(choice_4) between 1 and 80),
  choice_type text not null default 'text' check (choice_type in ('text', 'image')),
  choice_image_1 text,
  choice_image_2 text,
  choice_image_3 text,
  choice_image_4 text,
  answer_index smallint not null check (answer_index between 0 and 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quizzes_is_active_created_at_idx
  on public.quizzes (is_active, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_quizzes_updated_at on public.quizzes;
create trigger set_quizzes_updated_at
  before update on public.quizzes
  for each row
  execute function public.set_updated_at();

alter table public.quizzes enable row level security;

alter table public.quizzes
  alter column visual drop not null;

alter table public.quizzes
  add column if not exists choice_type text not null default 'text',
  add column if not exists choice_image_1 text,
  add column if not exists choice_image_2 text,
  add column if not exists choice_image_3 text,
  add column if not exists choice_image_4 text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quizzes_choice_type_check'
      and conrelid = 'public.quizzes'::regclass
  ) then
    alter table public.quizzes
      add constraint quizzes_choice_type_check
      check (choice_type in ('text', 'image'));
  end if;
end;
$$;
