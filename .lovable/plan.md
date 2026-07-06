## Fix — Dropdown "Produtos SmartDent" só com produtos do catálogo

### Causa
Em `src/components/smartops/SmartOpsWorkflowMapper.tsx` (linha 140), a query dos produtos filtra apenas `active=true`, mas `system_a_catalog` mistura 3 tipos de linhas:

| category | # ativos | É produto? |
|---|---|---|
| `product` | 117 | ✅ sim |
| `Serviços`, `Equipamentos`, `Acessórios`, `Software` | 4 | ✅ sim (categorias manuais) |
| `video_testimonial` | 203 | ❌ depoimentos ("Cliente #129"…) |
| `category_config` | 25 | ❌ config de UI |
| `company_info` | 1 | ❌ dados da empresa |

Por isso o dropdown mostra "Cliente #130", "Cliente #131" etc. — são depoimentos, não produtos.

### Correção (1 arquivo, 1 linha)

Em `SmartOpsWorkflowMapper.tsx`, ajustar a query para excluir as categorias não-produto:

```ts
supabase
  .from("system_a_catalog")
  .select("id, name")
  .eq("active", true)
  .not("category", "in", "(video_testimonial,category_config,company_info)")
  .order("name")
```

Resultado esperado: dropdown passa de 350 → ~121 opções, todas produtos reais.

Isso beneficia ao mesmo tempo:
- Aba **Produtos SmartDent** (badges + Select "+ Adicionar")
- Aba **Regras de Oportunidade** (dropdown "Produto do Mix" no `NewRuleForm`)

### Fora do escopo
- Não mexo em `system_a_catalog` (os depoimentos continuam ativos porque são usados em outras telas — página de testimonials, prova social).
- Não altero outras telas que consomem o catálogo.
- Não crio índice novo; o filtro roda barato em 370 linhas.
