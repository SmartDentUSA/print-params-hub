
CREATE POLICY "authors_manage_smartops_forms"
ON public.smartops_forms
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'author'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'author'::public.app_role)
);

CREATE POLICY "authors_manage_smartops_form_fields"
ON public.smartops_form_fields
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'author'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'author'::public.app_role)
);
