-- Tune core schema policies and FK indexes after advisor review.

create index quiz_attempt_questions_question_idx
on public.quiz_attempt_questions (question_id);

create index quiz_attempts_course_idx
on public.quiz_attempts (course_id);

create index student_answers_question_idx
on public.student_answers (question_id);

drop policy "Profiles are readable by owner" on public.profiles;
drop policy "Profiles are editable by owner" on public.profiles;
drop policy "Active courses are readable by authenticated students" on public.courses;
drop policy "Published course PDF metadata is readable by authenticated students" on public.course_pdfs;
drop policy "Attempts are readable by owner" on public.quiz_attempts;
drop policy "Attempt questions are readable by attempt owner" on public.quiz_attempt_questions;
drop policy "Student answers are readable by attempt owner" on public.student_answers;

drop policy "Admins can manage profiles" on public.profiles;
drop policy "Admins can manage courses" on public.courses;
drop policy "Admins can manage course PDFs" on public.course_pdfs;
drop policy "Admins can manage quiz attempts" on public.quiz_attempts;
drop policy "Admins can manage attempt questions" on public.quiz_attempt_questions;
drop policy "Admins can manage student answers" on public.student_answers;

create policy "Profiles are readable by owner or admin"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id or public.is_admin());

create policy "Profiles are editable by owner or admin"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id or public.is_admin())
with check ((select auth.uid()) = id or public.is_admin());

create policy "Admins can insert profiles"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can delete profiles"
on public.profiles
for delete
to authenticated
using (public.is_admin());

create policy "Active courses are readable by students or admins"
on public.courses
for select
to authenticated
using (is_active or public.is_admin());

create policy "Admins can insert courses"
on public.courses
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update courses"
on public.courses
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete courses"
on public.courses
for delete
to authenticated
using (public.is_admin());

create policy "Published PDF metadata is readable by students or admins"
on public.course_pdfs
for select
to authenticated
using (
  public.is_admin()
  or (
    is_published
    and exists (
      select 1
      from public.courses
      where courses.id = course_pdfs.course_id
        and courses.is_active
    )
  )
);

create policy "Admins can insert course PDFs"
on public.course_pdfs
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update course PDFs"
on public.course_pdfs
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete course PDFs"
on public.course_pdfs
for delete
to authenticated
using (public.is_admin());

create policy "Attempts are readable by owner or admin"
on public.quiz_attempts
for select
to authenticated
using ((select auth.uid()) = user_id or public.is_admin());

create policy "Admins can insert quiz attempts"
on public.quiz_attempts
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update quiz attempts"
on public.quiz_attempts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete quiz attempts"
on public.quiz_attempts
for delete
to authenticated
using (public.is_admin());

create policy "Attempt questions are readable by attempt owner or admin"
on public.quiz_attempt_questions
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.quiz_attempts
    where quiz_attempts.id = quiz_attempt_questions.attempt_id
      and quiz_attempts.user_id = (select auth.uid())
  )
);

create policy "Admins can insert attempt questions"
on public.quiz_attempt_questions
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update attempt questions"
on public.quiz_attempt_questions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete attempt questions"
on public.quiz_attempt_questions
for delete
to authenticated
using (public.is_admin());

create policy "Student answers are readable by attempt owner or admin"
on public.student_answers
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.quiz_attempts
    where quiz_attempts.id = student_answers.attempt_id
      and quiz_attempts.user_id = (select auth.uid())
  )
);

create policy "Admins can insert student answers"
on public.student_answers
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update student answers"
on public.student_answers
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete student answers"
on public.student_answers
for delete
to authenticated
using (public.is_admin());
