-- painel_match_taxonomy passou a consultar o catálogo por nome normalizado a cada
-- item; sem índice funcional isso vira varredura por linha e o refresh do painel
-- (que roda de 5 em 5 minutos) estoura o tempo.
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_nome_norm
  ON public.system_a_catalog (public.painel_nome_norm(name));

CREATE INDEX IF NOT EXISTS idx_produto_aliases_variante_norm
  ON public.produto_aliases (public.painel_nome_norm(nome_variante));

CREATE INDEX IF NOT EXISTS idx_produto_aliases_canonico_norm
  ON public.produto_aliases (public.painel_nome_norm(nome_canonico));

ANALYZE public.system_a_catalog;
ANALYZE public.produto_aliases;
