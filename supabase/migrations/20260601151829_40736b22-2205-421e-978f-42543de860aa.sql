CREATE POLICY admin_update_wa_groups
ON public.wa_groups
FOR UPDATE
TO authenticated
USING (public.is_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())));