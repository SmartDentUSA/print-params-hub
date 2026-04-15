

## Plano: Executar limpeza dos conteúdos corrompidos

### Etapas

1. **Executar `fix-corrupted-links` em dry-run** — verificar quantos artigos serão corrigidos
2. **Executar `fix-corrupted-links` com `dryRun: false`** — aplicar as correções de HTML nos ~657 artigos
3. **Executar `fix-category-e-cleanup` em dry-run** — verificar reclassificações propostas
4. **Executar `fix-category-e-cleanup` com `dryRun: false`** — mover artigos para categorias corretas

### Como será feito

Usar `supabase--curl_edge_functions` para invocar cada function. Primeiro dry-run para validar, depois execução real.

### Arquivos afetados

Nenhum arquivo de código será alterado. Apenas dados no banco (`knowledge_contents`).

