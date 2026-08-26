CREATE OR REPLACE FUNCTION public.fn_is_team_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH jwt AS (
    SELECT
      lower(coalesce(auth.jwt() ->> 'email', '')) AS jwt_email,
      lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'tipo', '')) AS jwt_tipo,
      regexp_replace(
        coalesce(
          nullif(auth.jwt() -> 'user_metadata' ->> 'phone', ''),
          nullif(auth.jwt() ->> 'phone', ''),
          nullif(auth.jwt() -> 'user_metadata' ->> 'phone_number', ''),
          nullif(auth.jwt() -> 'app_metadata' ->> 'phone', ''),
          -- login por SMS grava o telefone no local-part do e-mail sintético
          nullif(split_part(coalesce(auth.jwt() ->> 'email',''), '@', 1), ''),
          ''
        ), '\D', '', 'g') AS jwt_phone
  ), norm AS (
    SELECT jwt_email, jwt_tipo,
           CASE WHEN length(jwt_phone) >= 8 THEN right(jwt_phone, 8) ELSE '' END AS phone_tail
    FROM jwt
  )
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND EXISTS (
    SELECT 1 FROM public.team_members tm, norm n
    WHERE tm.ativo IS TRUE
      AND (
        -- match por telefone vale mesmo em login SMS (e-mail sintético / tipo cliente)
        (
          n.phone_tail <> '' AND (
            regexp_replace(coalesce(tm.whatsapp_number,''), '\D', '', 'g') LIKE '%' || n.phone_tail
            OR regexp_replace(coalesce(tm.evolution_phone,''), '\D', '', 'g') LIKE '%' || n.phone_tail
            OR regexp_replace(coalesce(tm.notification_phone,''), '\D', '', 'g') LIKE '%' || n.phone_tail
          )
        )
        OR (
          n.jwt_email <> ''
          AND n.jwt_tipo <> 'cliente'
          AND n.jwt_email NOT LIKE '%@phone.smartdent.local'
          AND lower(coalesce(tm.email,'')) = n.jwt_email
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_training_media(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    and _user_id = (select auth.uid())
    and (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.role = 'admin'::public.app_role
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
$function$;