## Objetivo

Eliminar duplicatas na busca de Deal do agendamento de treinamento usando a nova RPC `fn_search_deal_for_training` como **resolvedor canônico do lead**, mantendo intacto o Step 2/3 do `EnrollmentModal` (seletor de ganho deals, extração de propostas, equipamentos).

## Estratégia: híbrida (2 etapas no hook)

1. **RPC** identifica o lead único (sem duplicatas) e devolve metadados resolvidos do deal-alvo (nome, email, telefone, empresa, pipeline, etapa, proprietario, piperun_link, deal_value, strategy, warning).
2. **SELECT em `lia_attendances`** (com `merged_into IS NULL`) pelo `lead_id` retornado pela RPC, para hidratar os campos que o Modal já consome: `piperun_deals_history`, `pessoa_piperun_id`, `buyer_type`, `empresa_cnpj`, `cidade`, `uf`, `pais_origem`, `especialidade`, `area_atuacao`.

Isso preserva:
- Seletor `ganhoDeals` (vários deals "ganho" no histórico)
- `extractProposalItems` em Step 2/3 (equipamentos, seriais, writeback)
- `numeroProposta` extraído de `matched_deal.proposals`
- Detecção B2B
- Todos os campos gravados no enrollment (`deal_id`, `deal_title`, `deal_value`, `pipeline_name`, `pessoa_piperun_id`)

## Mudanças por arquivo

### `src/hooks/useDealSearch.ts` — reescrever o `search()`

```ts
const search = async (dealId: string) => {
  const id = dealId.trim();
  if (!id) return;
  setLoading(true); setError(null); setResult(null);

  try {
    // 1) RPC resolve o lead canônico (sem duplicatas)
    const { data: rpc, error: rpcErr } = await supabase
      .rpc('fn_search_deal_for_training', { p_deal_id: id });
    if (rpcErr) throw rpcErr;

    const r = rpc as any;
    if (!r?.found || !r?.lead_id) {
      setError('Deal não encontrado. Verifique o ID e tente novamente.');
      return;
    }
    if (r.warning) console.warn('[DealSearch]', r.warning);

    // 2) Hidrata o lead canônico para preservar Step 2/3
    const { data: lead, error: leadErr } = await (supabase as any)
      .from('lia_attendances')
      .select(FIELDS) // mesmos campos atuais
      .eq('id', r.lead_id)
      .is('merged_into', null)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) {
      setError('Lead canônico não encontrado para este deal.');
      return;
    }

    const history: PiperunDeal[] = lead.piperun_deals_history ?? [];
    const matchedDeal =
      history.find(d => String(d.deal_id) === id) ??
      history.find(isDealGanho) ??
      history[0];

    if (!matchedDeal) {
      setError(`Lead "${lead.nome}" sem deals no histórico.`);
      return;
    }

    setResult({
      ...lead,
      lead_id: lead.id,
      piperun_deals_history: history,
      matched_deal: matchedDeal,
      // metadados extras vindos da RPC (não-bloqueantes)
      rpc_strategy: r.strategy,
      rpc_warning: r.warning ?? null,
    } as DealSearchResult);
  } catch (e: any) {
    setError(`Erro ao buscar deal: ${e?.message || String(e)}`);
  } finally {
    setLoading(false);
  }
};
```

Remove os 4 fallbacks T1–T4 (a RPC já cobre todos eles).

### `src/types/courses.ts` — extensão opcional do tipo

Adicionar em `DealSearchResult`:
```ts
rpc_strategy?: 'piperun_id' | 'pessoa_piperun_id' | 'deals_history' | string;
rpc_warning?: string | null;
```

### `src/components/smartops/EnrollmentModal.tsx` — badge de aviso no Step 2

No topo do bloco de conferência (Step 2), quando `dealSearch.result?.rpc_strategy === 'deals_history'` e `rpc_warning`:

```tsx
{dealSearch.result?.rpc_strategy === 'deals_history' && dealSearch.result?.rpc_warning && (
  <Badge variant="outline" className="border-yellow-500/50 text-yellow-700 dark:text-yellow-400">
    ⚠️ Lead identificado pelo histórico — confirme os dados
  </Badge>
)}
```

Nada mais muda no Modal. `populateFromResult`, `ganhoDeals`, `numeroProposta`, `handleSubmit`, etc. continuam idênticos.

## Fora de escopo

- Não toco em `useEnrollment.ts`
- Não altero a RPC do banco
- Não removo nenhum campo do `DealSearchResult` (apenas adiciono dois opcionais)
- Não mexo no Step 3/4/5 do Modal