

# Corrigir dados incompletos: PIPERUN_USERS, pipeline 102893, proposals e build error

## Diagnostico do caso `tiagodomingues80@gmail.com`

```text
No banco:
  Deal 55485159 → pipeline 102893 (desconhecido), owner "87666", proposals []
  Deal 58133076 → CS Onboarding, owner "100952", 1 item apenas (Resina Vitality)
  proprietario_lead_crm: "100952" (ID numerico)
  itens_proposta_parsed: []

No CRM real (CSV):
  Deal 48880050 → R$77.000 (Scanner i600, Notebook, Elegoo, etc.)
  Owner: Daniele Oliveira
```

844 leads afetados por IDs numericos em `proprietario_lead_crm`.

## Problemas raiz

1. **PIPERUN_USERS incompleto**: 17 IDs sem mapeamento → nomes aparecem como numeros
2. **Pipeline 102893 nao mapeado**: deals desse pipeline nao tem `pipeline_name`
3. **`ownerName` override propaga ID numerico**: `buildRichDealSnapshot` recebe `updatePayload.proprietario_lead_crm` que ja e `String(owner_id)` quando o ID nao esta no mapa — esse override IMPEDE o fallback para `deal.user.name`
4. **Proposals com items vazios**: PipeRun `with[]=proposals` retorna proposals mas o campo `items` dentro deles pode vir como array de objetos com dados aninhados em `item.item` (sub-objeto) — o parser nao extrai `item.item.name` corretamente em todos os caminhos
5. **Build error**: `useEnrollment.ts` linha 90 — `.catch()` em `PromiseLike`

## Mudancas

### 1. `supabase/functions/_shared/piperun-field-map.ts`

**1a. Adicionar 17 usuarios ao PIPERUN_USERS** (linha 249-262):
```
53254: Jose Ricardo Mello
49361: Juliana Guedes
100952: Adriano Oliveira
69316: Emerson Junior
82734: Olavo Neto
87666: Danilo Silva
33621: Equipe Smart Dent
95098: Rogerio Junior
69958: Vinicius Taipeiro
62293: Janaine Gusson
69319: Lucas Azzis
47679: Heloisa Martins
48555: Align - exocad
48553: Rafael Almeida
33725, 33723, 33722: resolver via API (pagina 2 de usuarios)
```

**1b. Adicionar pipeline 102893** ao PIPELINES e PIPELINE_NAMES (precisa descobrir nome via API).

**1c. Corrigir override de ownerName no `buildRichDealSnapshot`**: Quando o `overrides.ownerName` e um ID numerico (regex `^\d+$`), ignorar o override e deixar o fallback resolver via `deal.user.name` ou `PIPERUN_USERS`. Isso evita que o ID numerico seja propagado para o snapshot.

**1d. Corrigir extração de nome do item na proposta**: Na funcao `buildRichDealSnapshot` (linha 1113), adicionar fallback para `it.item?.name` que ja existe mas pode nao funcionar quando `it.name` e HTML/CSS garbage. Adicionar `stripHtmlShared()` em todos os caminhos de nome.

### 2. `supabase/functions/smart-ops-sync-piperun/index.ts`

**2a. Nao passar ID numerico como ownerName override**: Na linha 383, verificar se `proprietario_lead_crm` e numerico antes de passar como override — se for numerico, passar `null` para permitir fallback.

### 3. `supabase/functions/piperun-full-sync/index.ts`

Mesma correcao: nao passar ID numerico como ownerName override.

### 4. `src/hooks/useEnrollment.ts`

**4a. Corrigir build error** (linhas 88-90): Substituir `.then().catch()` por try/catch:
```ts
try {
  await supabase.rpc('merge_tags_crm' as any, {
    p_lead_id: p.dealResult.lead_id, p_new_tags: [tag],
  });
} catch (e: any) { console.warn('[tags]', e); }
```

### 5. Migration SQL — Backfill owner names

UPDATE nos 844 leads que tem IDs numericos, traduzindo para nomes reais com CASE WHEN. Tambem atualizar `owner_name` dentro do JSONB `piperun_deals_history`.

### 6. Consulta API pre-implementacao

Antes de implementar, preciso chamar `piperun-api-test` para:
- Resolver IDs 33725, 33723, 33722 (pagina 2 de usuarios)
- Descobrir o nome do pipeline 102893

## Ordem de execucao

1. Consultar API PipeRun para IDs faltantes e pipeline 102893
2. Atualizar PIPERUN_USERS com todos os 28+ usuarios
3. Adicionar pipeline 102893 ao mapa
4. Corrigir logica de ownerName override (nao propagar IDs numericos)
5. Fix build error useEnrollment.ts
6. Deploy edge functions
7. Executar backfill SQL dos owner names (844 leads + JSONB history)
8. Re-sync pipelines para capturar deals faltantes

