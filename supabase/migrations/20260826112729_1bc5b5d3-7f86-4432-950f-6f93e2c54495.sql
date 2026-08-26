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
      -- contas de portal do cliente nunca são equipe
      AND n.jwt_tipo <> 'cliente'
      AND n.jwt_email NOT LIKE '%@phone.smartdent.local'
      AND (
        (n.jwt_email <> '' AND lower(coalesce(tm.email,'')) = n.jwt_email)
        OR (
          n.phone_tail <> '' AND (
            regexp_replace(coalesce(tm.whatsapp_number,''), '\D', '', 'g') LIKE '%' || n.phone_tail
            OR regexp_replace(coalesce(tm.evolution_phone,''), '\D', '', 'g') LIKE '%' || n.phone_tail
            OR regexp_replace(coalesce(tm.notification_phone,''), '\D', '', 'g') LIKE '%' || n.phone_tail
          )
        )
      )
  );
$function$;