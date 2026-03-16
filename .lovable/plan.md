

## Plano: Auto-geração IA + Filtro JSONB de Propostas + Auto-merge de Duplicatas

### 3 problemas a resolver:

---

### 1. Tabs IA devem auto-gerar ao acessar o card

**Arquivo**: `src/components/smartops/LeadDetailPanel.tsx`

Atualmente os tabs "Cognitiva", "Upsell" e "Ações" exigem clique manual em botão. A mudança é simples: adicionar um `useEffect` que dispara `callCopilotForTab` automaticamente quando o tab é ativado e o resultado está vazio.

```typescript
// Auto-trigger AI tabs when activated
useEffect(() => {
  if (activeTab === "cognitive" && !cognitiveResult && !cognitiveLoading) {
    callCopilotForTab("cognitive");
  }
  if (activeTab === "upsell" && !upsellResult && !upsellLoading) {
    callCopilotForTab("upsell");
  }
  if (activeTab === "actions" && !actionsResult && !actionsLoading) {
    callCopilotForTab("actions");
  }
}, [activeTab]);
```

Remover o texto placeholder "Clique em..." e manter apenas o botão "Reanalisar" para regenerações manuais.

---

### 2. Filtro de produto por proposta (busca JSONB profunda)

**Migration SQL**: Criar 2 funções RPC:

- `fn_search_leads_by_proposal_product(product_search TEXT, deal_status TEXT)` — busca JSONB profunda em `piperun_deals_history → items → nome`
- `fn_list_proposal_products()` — lista produtos únicos das propostas para autocomplete

**Arquivo**: `src/components/SmartOpsLeadsList.tsx`

- Substituir `ITEM_PROPOSTA_OPTIONS` + `<select>` por um `<input>` de texto livre com debounce
- Adicionar `<select>` de status do deal (Ganha/Perdida/Aberta/Todas)
- Quando o filtro de produto está preenchido, chamar a RPC ao invés do `ILIKE` simples no `itens_proposta_crm`
- Usar resultado da RPC como `.in("id", resultIds)` na query principal

---

### 3. Auto-merge de duplicatas (incremental, automático)

O merge deve ser **automático e silencioso** — ao abrir um lead, o sistema verifica duplicatas e faz merge incremental (preenchendo campos vazios do primário com dados dos secundários).

**Arquivo**: `src/components/smartops/LeadDetailPanel.tsx`

Adicionar `useEffect` no `LeadDetailPanel` que:
1. Busca leads com mesmo `empresa_piperun_id`, `pessoa_piperun_id`, ou domínio de email
2. Se encontrar duplicatas, chama a Edge Function `smart-ops-merge-leads` automaticamente (o primário é o lead com mais dados preenchidos)
3. Após merge, recarrega o lead atualizado
4. Mostra na UI um banner informativo: "🔗 Dados consolidados de X registros"

**Exibição**: No hero card, mostrar badge discreto quando houve merge — "🔗 Consolidado (3 fontes)" — com tooltip listando os nomes/emails absorvidos do `merge_history`.

---

### Resumo de arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/smartops/LeadDetailPanel.tsx` | useEffect auto-trigger IA tabs + useEffect auto-merge duplicatas + badge consolidação |
| `src/components/SmartOpsLeadsList.tsx` | Substituir select estático por input texto + RPC JSONB + filtro status deal |
| Migration SQL | `fn_search_leads_by_proposal_product` + `fn_list_proposal_products` |

