## Objetivo

Trocar o `useDealSearch` para usar **só** a RPC `fn_search_deal_for_training` como fonte do lead, e simplificar o Step 1/2 do `EnrollmentModal` (sem lista de deals). Manter Equipamentos/Seriais (Step 2) e snapshot do enrollment vivos com uma **2ª query cirúrgica** que traz **apenas o deal escolhido** do `piperun_deals_history`, eliminando o problema dos 1000+ deals.

## Mudanças

### 1. `src/types/courses.ts` — novo `DealSearchResult`
Substitui o tipo atual por um espelho exato do payload da RPC + um campo opcional para o deal isolado.

```ts
export interface DealSearchResult {
  found: boolean;
  lead_id: string;
  strategy: 'piperun_id_exact' | 'deals_table' | 'deals_history' | string;
  warning?: string | null;

  nome: string | null;
  email: string | null;
  telefone: string | null;       // 5511999887744
  telefone_br: string | null;    // 11999887744
  telefone_fmt: string | null;   // (11) 99988-7744
  telefone_e164: string | null;  // +5511999887744
  instagram: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  cargo: string | null;
  empresa_nome: string | null;
  empresa_cnpj: string | null;
  cpf: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  pais: string | null;
  produto_interesse: string | null;
  tem_scanner: string | null;
  tem_impressora: string | null;
  impressora_modelo: string | null;
  piperun_id: string | null;
  pessoa_piperun_id?: string | null; // mantido para compat se a RPC adicionar
  pipeline: string | null;
  etapa: string | null;
  proprietario: string | null;
  deal_value: number | null;
  piperun_link: string | null;

  // Hidratação cirúrgica do deal escolhido (para Equipamentos/Snapshot)
  matched_deal?: PiperunDeal | null;
}
```

### 2. `src/hooks/useDealSearch.ts` — RPC + fetch cirúrgico do deal

```ts
const search = async (dealId: string) => {
  const id = dealId.trim();
  if (!id) return;
  setLoading(true); setError(null); setResult(null);

  try {
    const { data, error } = await (supabase as any)
      .rpc('fn_search_deal_for_training', { p_deal_id: id });
    if (error) throw error;
    if (!data?.found) {
      setError('Deal não encontrado. Verifique o ID e tente novamente.');
      return;
    }

    // 2ª query cirúrgica: extrai SÓ o deal escolhido do JSONB do lead canônico
    let matched: PiperunDeal | null = null;
    try {
      const { data: row } = await (supabase as any).rpc('fn_get_deal_from_history', {
        p_lead_id: data.lead_id, p_deal_id: id,
      }); // se a RPC não existir, fallback abaixo
      matched = row ?? null;
    } catch {
      // fallback: select pontual usando jsonb_path_query no client
      const { data: row } = await (supabase as any)
        .from('lia_attendances')
        .select('piperun_deals_history')
        .eq('id', data.lead_id)
        .is('merged_into', null)
        .maybeSingle();
      const hist: PiperunDeal[] = row?.piperun_deals_history ?? [];
      matched = hist.find(d => String(d.deal_id) === id) ?? null;
    }

    setResult({ ...data, matched_deal: matched });
  } catch (e: any) {
    setError('Erro ao buscar: ' + (e?.message ?? String(e)));
  } finally { setLoading(false); }
};
```

> Para evitar baixar `piperun_deals_history` inteiro (1000+ deals), criamos uma RPC auxiliar `fn_get_deal_from_history(p_lead_id uuid, p_deal_id text) RETURNS jsonb` que faz `jsonb_path_query_first` no servidor. Se quiser, o fallback client-side fica como rede de segurança e só dispara se a RPC ainda não existir.

### 3. Migration — RPC auxiliar

```sql
CREATE OR REPLACE FUNCTION public.fn_get_deal_from_history(p_lead_id uuid, p_deal_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dh
  FROM lia_attendances la,
    LATERAL jsonb_array_elements(la.piperun_deals_history) AS dh
  WHERE la.id = p_lead_id
    AND la.merged_into IS NULL
    AND dh->>'deal_id' = p_deal_id
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.fn_get_deal_from_history(uuid, text) TO authenticated, anon;
```

### 4. `src/components/smartops/EnrollmentModal.tsx` — Step 1 enxuto

- Remover bloco "Selecionar deal ganho" (`ganhoDeals`, `handleSelectDeal`, `selectedDealIdx`).
- Card de resultado do Step 1 vira: nome + email + botão **Continuar** que chama `populateFromResult(result)` e vai pro Step 2.
- Badge amarelo agora condiciona em `result.warning` (não mais `rpc_strategy`):
  ```tsx
  {dealSearch.result?.warning && (
    <Badge variant="outline" className="text-yellow-600 border-yellow-400">
      ⚠️ {dealSearch.result.warning}
    </Badge>
  )}
  ```

### 5. `EnrollmentModal` Step 2 — pré-preenchimento novo

`formData` ganha campos novos: `cep, rua, numero, bairro, complemento, telefone_br`. `populateFromResult(r)` mapeia:

| Form field           | RPC field          |
|----------------------|--------------------|
| person_name          | `nome`             |
| email *(novo input)* | `email`            |
| telefone (input)     | `telefone_br`      |
| area_atuacao         | `area_atuacao`     |
| especialidade        | `especialidade`    |
| instagram            | `instagram`        |
| empresa_nome *(novo)*| `empresa_nome`     |
| empresa_cnpj         | `empresa_cnpj`     |
| cep, rua, numero, bairro, complemento | idem |
| empresa_cidade       | `cidade`           |
| empresa_estado       | `estado`           |
| empresa_pais         | `pais ?? 'Brasil'` |
| deal_title           | `matched_deal?.deal_title ?? ''` |

`proposalItems` é extraído **só** do `matched_deal` (não mais agrega múltiplos `ganho`). Se `matched_deal` for null, lista vazia (Equipamentos some sozinho).

Cada `<Input>` auto-preenchido (campo derivado do RPC e não-nulo) ganha um wrapper relativo com ícone:

```tsx
<div className="relative">
  <Input ... />
  {prefilledFields.has(field) && (
    <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-green-500" />
  )}
</div>
```

`prefilledFields` = `Set<string>` populado dentro de `populateFromResult` apenas com campos que vieram não-nulos da RPC.

### 6. `useEnrollment.ts` — adaptar consumo do novo shape

- `p.dealResult.matched_deal` agora pode ser `null`; usar fallbacks:
  - `deal_id`        ← `matched_deal?.deal_id ?? p.dealResult.piperun_id ?? id buscado`
  - `deal_title`     ← `formData.deal_title ?? matched_deal?.deal_title`
  - `deal_pipeline_name` ← `matched_deal?.pipeline_name ?? p.dealResult.pipeline`
  - `deal_value`     ← `matched_deal?.value ?? p.dealResult.deal_value`
- `person_piperun_id` ← `p.dealResult.pessoa_piperun_id ?? p.dealResult.piperun_id`
- `p.dealResult.telefone_normalized` (usos no WA + warning Step 5) → trocar para `p.dealResult.telefone` (formato `5511...` que `formatPhoneWaleads` aceita).
- `numeroProposta` (no Modal, Step 2/5) passa a derivar de `matched_deal?.proposals` (já não há lista global).

### 7. Limpeza

- Remover de `useDealSearch.ts` a constante `FIELDS` e a importação de `isDealGanho` que não são mais usadas.
- Remover `selectedDealIdx`, `ganhoDeals`, `handleSelectDeal` do `EnrollmentModal`.

## Fora de escopo (não alterar)

- Steps 3, 4 e 5 do `EnrollmentModal` (apenas o Step 5 troca `telefone_normalized` → `telefone` para refletir nova RPC, sem mudança visual).
- `CourseCreateModal`, `SmartOpsCourses` tabs, `EquipmentSerialsSection`.
- Edge function `generate-certificate` e qualquer lógica de companions/certificados.
- Qualquer migração em `lia_attendances` (apenas adiciona-se a RPC auxiliar).
