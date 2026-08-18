-- Supabase SQL Editor에서 실행하세요.
alter table public.quizzes
  add column if not exists prompt_type text not null default 'text',
  add column if not exists prompt_image text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quizzes_prompt_type_check'
      and conrelid = 'public.quizzes'::regclass
  ) then
    alter table public.quizzes
      add constraint quizzes_prompt_type_check
      check (prompt_type in ('text', 'image'));
  end if;
end;
$$;
