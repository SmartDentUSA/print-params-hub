## Diagnóstico

Ao selecionar uma variação no dropdown do "Mapeamento de SKU", o hook `useSkuMappingInbox.saveMapping` faz `insert`/`update` direto em `produto_aliases`. As policies atuais dessa tabela são:

- `admin_read` — apenas SELECT para admins
- `service_role_full` — tudo, mas só para service_role

**Não existe policy de INSERT/UPDATE para `authenticated`**, então a escrita do navegador é bloqueada pelo RLS. O `update` retorna 0 linhas afetadas (sem erro), e o `insert` falha silenciosamente ou dispara erro genérico — em ambos os casos o alias não é gravado e o SKU nunca aparece como "mapeado".

## Correção

### 1. Migration — liberar escrita para admins em `produto_aliases`

```sql
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
```

Aplico o mesmo padrão em `catalog_kit_components` (verificar se as policies de escrita já existem; se não, adicionar equivalentes) para o diálogo de kits também funcionar.

### 2. UX — feedback quando o update afeta 0 linhas

Em `src/hooks/useSkuMappingInbox.ts`, o branch de UPDATE hoje ignora `count`. Ajusto para pedir `.select("id")` e lançar erro claro se o retorno for vazio (defesa em profundidade caso o RLS volte a bloquear no futuro).

### 3. Validação

- Selecionar uma variação em uma linha "Pendente" → toast "SKU mapeado" + badge verde com o SKU aparece.
- Marcar "Kit" → alias gravado, diálogo abre.
- Recarregar a página → o mapeamento persiste (linha some do filtro "Não mapeados").

## O que não muda

- Views `v_sku_mapping_inbox` e `v_deal_items_expanded`.
- Lógica de fallback do `system_a_catalog` no dropdown.
- UI da aba (nenhuma mudança visual).
