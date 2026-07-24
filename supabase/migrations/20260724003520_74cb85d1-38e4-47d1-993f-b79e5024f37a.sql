CREATE POLICY "Admins podem inserir aliases"
  ON public.produto_aliases FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem atualizar aliases"
  ON public.produto_aliases FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem deletar aliases"
  ON public.produto_aliases FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));