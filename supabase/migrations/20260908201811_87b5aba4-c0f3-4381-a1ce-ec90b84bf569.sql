create or replace function public.fn_can_manage_event_media(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with u as (
    select
      lower(coalesce(au.email, '')) as email,
      lower(coalesce(au.raw_user_meta_data ->> 'tipo','')) as tipo,
      (
        select case when length(d) >= 8 then right(d, 8) else '' end
        from (
          select regexp_replace(
            coalesce(
              nullif(au.phone,''),
              nullif(au.raw_user_meta_data ->> 'phone',''),
              nullif(split_part(coalesce(au.email,''), '@', 1), ''),
              ''
            ), '\D', '', 'g') as d
        ) x
      ) as phone_tail
    from auth.users au
    where au.id = _user_id
  )
  select
    _user_id is not null
    and (
      exists (
        select 1 from public.user_roles ur
        where ur.user_id = _user_id and ur.role = 'admin'::public.app_role
      )
      or exists (
        select 1
        from public.team_members tm, u
        where tm.ativo is true
          and (
            (
              u.phone_tail <> '' and (
                regexp_replace(coalesce(tm.whatsapp_number,''), '\D', '', 'g') like '%' || u.phone_tail
                or regexp_replace(coalesce(tm.evolution_phone,''), '\D', '', 'g') like '%' || u.phone_tail
                or regexp_replace(coalesce(tm.notification_phone,''), '\D', '', 'g') like '%' || u.phone_tail
              )
            )
            or (
              u.email <> ''
              and u.tipo <> 'cliente'
              and u.email not like '%@phone.smartdent.local'
              and lower(coalesce(tm.email,'')) = u.email
            )
          )
      )
    );
$$;

revoke all on function public.fn_can_manage_event_media(uuid) from public;
grant execute on function public.fn_can_manage_event_media(uuid) to service_role;