revoke all on function public.fn_is_internal_staff(uuid) from public, anon;
grant execute on function public.fn_is_internal_staff(uuid) to authenticated, service_role;