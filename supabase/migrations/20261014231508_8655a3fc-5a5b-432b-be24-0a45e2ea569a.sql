drop policy if exists "Ratings of published courses are public" on public.professional_course_ratings;
create policy "Ratings of published courses are public" on public.professional_course_ratings
  for select to anon, authenticated
  using (exists (select 1 from public.professional_courses pc where pc.id = course_id and pc.public_visible and pc.status = 'publicado'));
create policy "Staff reads all course ratings" on public.professional_course_ratings
  for select to authenticated
  using (public.fn_is_internal_staff(auth.uid()));