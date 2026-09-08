create or replace function public.tg_sync_prof_photo_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.photo_url is distinct from old.photo_url then
    perform public.fn_sync_speaker_photo(null, new.nome_completo, new.photo_url);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_prof_photo_team on public.team_members;
create trigger trg_sync_prof_photo_team
after update of photo_url on public.team_members
for each row execute function public.tg_sync_prof_photo_team();

create or replace function public.tg_sync_prof_photo_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.photo_url is distinct from old.photo_url then
    perform public.fn_sync_speaker_photo(null, new.name, new.photo_url);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_prof_photo_author on public.authors;
create trigger trg_sync_prof_photo_author
after update of photo_url on public.authors
for each row execute function public.tg_sync_prof_photo_author();

revoke execute on function public.fn_sync_speaker_photo(uuid, text, text) from anon, authenticated;

do $do$
declare r record;
begin
  for r in
    select distinct sp->>'professional_id' as pid, sp->>'name' as nm
    from public.smartops_events e, jsonb_array_elements(e.speakers) sp
    where e.speakers is not null and jsonb_typeof(e.speakers) = 'array'
  loop
    if r.pid is not null then
      perform public.fn_sync_speaker_photo(r.pid::uuid, r.nm,
        (select prof_photo_url from public.lia_attendances where id = r.pid::uuid));
    end if;
    perform public.fn_sync_speaker_photo(null, r.nm,
      (select l.prof_photo_url from public.lia_attendances l
        where lower(public.unaccent_safe(l.nome)) = lower(public.unaccent_safe(r.nm))
          and l.prof_photo_url is not null and l.merged_into is null
        order by l.updated_at desc nulls last limit 1));
    perform public.fn_sync_speaker_photo(null, r.nm,
      (select t.photo_url from public.team_members t
        where lower(public.unaccent_safe(t.nome_completo)) = lower(public.unaccent_safe(r.nm))
          and t.photo_url is not null
        order by t.updated_at desc nulls last limit 1));
    perform public.fn_sync_speaker_photo(null, r.nm,
      (select a.photo_url from public.authors a
        where lower(public.unaccent_safe(a.name)) = lower(public.unaccent_safe(r.nm))
          and a.photo_url is not null limit 1));
  end loop;
end
$do$;
