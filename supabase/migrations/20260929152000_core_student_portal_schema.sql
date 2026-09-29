-- Aylem Learning Student Portal core schema.
-- Auth remains owned by Supabase Auth. This migration adds application tables only.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  account_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_account_status_check check (account_status in ('active', 'suspended'))
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_app_meta_data ->> 'full_name', ''),
      nullif(new.raw_app_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', '')
    ),
    coalesce(
      nullif(new.raw_app_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_app_meta_data ->> 'picture', ''),
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.handle_new_user() from anon;
revoke all on function private.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

insert into public.profiles (id, full_name, avatar_url, created_at, updated_at)
select
  users.id,
  coalesce(
    nullif(users.raw_app_meta_data ->> 'full_name', ''),
    nullif(users.raw_app_meta_data ->> 'name', ''),
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(users.raw_user_meta_data ->> 'name', '')
  ),
  coalesce(
    nullif(users.raw_app_meta_data ->> 'avatar_url', ''),
    nullif(users.raw_app_meta_data ->> 'picture', ''),
    nullif(users.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(users.raw_user_meta_data ->> 'picture', '')
  ),
  users.created_at,
  now()
from auth.users as users
on conflict (id) do nothing;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  display_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint courses_slug_check check (slug = lower(slug) and slug ~ '^[a-z0-9-]+$'),
  constraint courses_display_order_positive_check check (display_order > 0)
);

create table public.course_pdfs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  r2_object_key text not null,
  file_size_bytes bigint,
  mime_type text not null default 'application/pdf',
  is_published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_pdfs_file_size_nonnegative_check
    check (file_size_bytes is null or file_size_bytes >= 0),
  constraint course_pdfs_mime_type_check check (mime_type = 'application/pdf')
);

create trigger set_course_pdfs_updated_at
before update on public.course_pdfs
for each row
execute function public.set_updated_at();

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null,
  explanation text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_correct_option_check check (correct_option in ('A', 'B', 'C', 'D'))
);

create trigger set_questions_updated_at
before update on public.questions
for each row
execute function public.set_updated_at();

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  test_size integer not null,
  status text not null default 'in_progress',
  score integer,
  percentage numeric(5, 2),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint quiz_attempts_test_size_check check (test_size in (20, 50, 100)),
  constraint quiz_attempts_status_check check (status in ('in_progress', 'submitted', 'abandoned')),
  constraint quiz_attempts_score_nonnegative_check check (score is null or score >= 0),
  constraint quiz_attempts_percentage_range_check
    check (percentage is null or (percentage >= 0 and percentage <= 100)),
  constraint quiz_attempts_submitted_status_check
    check ((status = 'submitted') = (submitted_at is not null))
);

create table public.quiz_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  question_order integer not null,
  created_at timestamptz not null default now(),
  constraint quiz_attempt_questions_order_positive_check check (question_order > 0),
  constraint quiz_attempt_questions_attempt_question_unique unique (attempt_id, question_id),
  constraint quiz_attempt_questions_attempt_order_unique unique (attempt_id, question_order)
);

create table public.student_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected_option text not null,
  is_correct boolean,
  answered_at timestamptz not null default now(),
  constraint student_answers_selected_option_check check (selected_option in ('A', 'B', 'C', 'D')),
  constraint student_answers_attempt_question_unique unique (attempt_id, question_id),
  constraint student_answers_attempt_question_fk
    foreign key (attempt_id, question_id)
    references public.quiz_attempt_questions (attempt_id, question_id)
    on delete cascade
);

insert into public.courses (slug, name, display_order)
values
  ('ielts', 'IELTS', 1),
  ('oet', 'OET', 2),
  ('pte', 'PTE', 3),
  ('german', 'German', 4)
on conflict (slug) do update
set
  name = excluded.name,
  display_order = excluded.display_order,
  is_active = true;

create index courses_active_order_idx
on public.courses (is_active, display_order);

create index course_pdfs_course_published_order_idx
on public.course_pdfs (course_id, is_published, display_order);

create index questions_course_active_idx
on public.questions (course_id, is_active);

create index quiz_attempts_user_course_created_idx
on public.quiz_attempts (user_id, course_id, created_at desc);

create index quiz_attempt_questions_attempt_order_idx
on public.quiz_attempt_questions (attempt_id, question_order);

create index student_answers_attempt_question_idx
on public.student_answers (attempt_id, question_id);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_pdfs enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_questions enable row level security;
alter table public.student_answers enable row level security;

grant usage on schema public to authenticated;

grant select, insert, delete on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.course_pdfs to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.quiz_attempts to authenticated;
grant select, insert, update, delete on public.quiz_attempt_questions to authenticated;
grant select, insert, update, delete on public.student_answers to authenticated;

-- Intentionally no student SELECT policy on questions. Answer keys must not be
-- directly queryable from the browser; future server-side assessment APIs can use
-- privileged credentials to read questions safely.

create policy "Profiles are readable by owner"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Profiles are editable by owner"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Active courses are readable by authenticated students"
on public.courses
for select
to authenticated
using (is_active);

create policy "Published course PDF metadata is readable by authenticated students"
on public.course_pdfs
for select
to authenticated
using (
  is_published
  and exists (
    select 1
    from public.courses
    where courses.id = course_pdfs.course_id
      and courses.is_active
  )
);

create policy "Attempts are readable by owner"
on public.quiz_attempts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Attempt questions are readable by attempt owner"
on public.quiz_attempt_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts
    where quiz_attempts.id = quiz_attempt_questions.attempt_id
      and quiz_attempts.user_id = (select auth.uid())
  )
);

create policy "Student answers are readable by attempt owner"
on public.student_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts
    where quiz_attempts.id = student_answers.attempt_id
      and quiz_attempts.user_id = (select auth.uid())
  )
);

create policy "Admins can manage profiles"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can manage courses"
on public.courses
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can manage course PDFs"
on public.course_pdfs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can manage questions"
on public.questions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can manage quiz attempts"
on public.quiz_attempts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can manage attempt questions"
on public.quiz_attempt_questions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can manage student answers"
on public.student_answers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
