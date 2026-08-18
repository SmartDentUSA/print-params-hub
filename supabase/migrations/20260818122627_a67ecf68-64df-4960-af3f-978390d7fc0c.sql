CREATE OR REPLACE FUNCTION public.fn_is_team_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH jwt AS (
    SELECT
      lower(coalesce(auth.jwt() ->> 'email', '')) AS jwt_email,
      regexp_replace(coalesce(auth.jwt() -> 'user_metadata' ->> 'phone', auth.jwt() ->> 'phone', ''), '\D', '', 'g') AS jwt_phone
  ), norm AS (
    SELECT jwt_email,
           CASE WHEN length(jwt_phone) > 10 THEN right(jwt_phone, 10) ELSE jwt_phone END AS phone_tail
    FROM jwt
  )
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm, norm n
    WHERE (n.jwt_email <> '' AND lower(tm.email) = n.jwt_email)
       OR (
         length(n.phone_tail) = 10 AND (
           regexp_replace(coalesce(tm.whatsapp_number,''), '\D', '', 'g') LIKE '%' || n.phone_tail
           OR regexp_replace(coalesce(tm.evolution_phone,''), '\D', '', 'g') LIKE '%' || n.phone_tail
           OR regexp_replace(coalesce(tm.notification_phone,''), '\D', '', 'g') LIKE '%' || n.phone_tail
         )
       )
  );
$function$;