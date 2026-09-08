create or replace function public.fn_sync_speaker_photo(p_professional_id uuid, p_name text, p_photo text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer := 0;
begin
  if p_photo is null or length(trim(p_photo)) = 0 then
    return 0;
  end if;

  with upd as (
    update public.smartops_events e
    set speakers = (
      select jsonb_agg(
        case
          when (
            (sp->>'professional_id') is not null and p_professional_id is not null
            and sp->>'professional_id' = p_professional_id::text
          )
          or (
            p_name is not null
            and lower(unaccent_safe(coalesce(sp->>'name',''))) = lower(unaccent_safe(p_name))
          )
          then sp || jsonb_build_object('photo_url', p_photo)
          else sp
        end
        order by ord
      )
      from jsonb_array_elements(e.speakers) with ordinality t(sp, ord)
    )
    where e.speakers is not null
      and jsonb_typeof(e.speakers) = 'array'
      and exists (
        select 1 from jsonb_array_elements(e.speakers) sp
        where (
          (sp->>'professional_id') is not null and p_professional_id is not null
          and sp->>'professional_id' = p_professional_id::text
        ) or (
          p_name is not null
          and lower(unaccent_safe(coalesce(sp->>'name',''))) = lower(unaccent_safe(p_name))
        )
      )
      and exists (
        select 1 from jsonb_array_elements(e.speakers) sp
        where coalesce(sp->>'photo_url','') <> p_photo
          and (
            ((sp->>'professional_id') is not null and p_professional_id is not null
              and sp->>'professional_id' = p_professional_id::text)
            or (p_name is not null
              and lower(unaccent_safe(coalesce(sp->>'name',''))) = lower(unaccent_safe(p_name)))
          )
      )
    returning 1
  )
  select count(*) into v_count from upd;

  return v_count;
end;
$$;

create or replace function public.unaccent_safe(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(coalesce(p,''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC');
$$;

create or replace function public.tg_sync_prof_photo_lia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.prof_photo_url is distinct from old.prof_photo_url then
    perform public.fn_sync_speaker_photo(new.id, new.nome, new.prof_photo_url);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_prof_photo_lia on public.lia_attendances;
create trigger trg_sync_prof_photo_lia
after update of prof_photo_url on public.lia_attendances
for each row execute function public.tg_sync_prof_photo_lia();

create or replace function public.tg_sync_prof_photo_team()
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
