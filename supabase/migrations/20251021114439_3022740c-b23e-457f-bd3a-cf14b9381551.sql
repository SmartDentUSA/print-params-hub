-- Adicionar política para usuários do painel lerem todos os conteúdos (ativos e inativos)
create policy "Panel users can read all contents"
  on public.knowledge_contents
  for select
  to authenticated
  using (has_panel_access(auth.uid()));