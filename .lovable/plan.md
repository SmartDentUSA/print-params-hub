## Problema

A nota "Novo Lead atribuído" gerada por `smart-ops-lia-assign` contradiz o "Resumo do Lead" (em `cs_automation`):

- HISTÓRICO afirma "primeiro contato em 24/04/2026" (resumo correto: 19/04/2026, deal mais antigo) e cita "exceto a vendedora Janaina Santos" mesmo quando o owner atual nos 3 deals é Evandro Silva.
- O LLM (DeepSeek) recebe um prompt empobrecido e alucina ao preencher lacunas.

## Causa raiz

`generateHistoricoOportunidade` em `supabase/functions/_shared/waleads-messaging.ts` envia ao DeepSeek:

- `Vendedor anterior: ${lead.proprietario_lead_crm}` — campo único, frequentemente desatualizado (ex.: Janaina, antiga owner) sem nenhuma indicação de owner atual ou histórico.
- `Primeiro contato: ${lead.data_primeiro_contato || lead.created_at}` — para esse lead retornou 11/05 (deal mais novo), enquanto existem deals desde 19/04.
- **Nenhuma informação sobre os deals existentes** (quantidade, funis, etapas, status, datas, owners). Sem esse contexto o modelo inventa "Janaina o atendeu previamente" e usa a data do meio (24/04).
- Não passa `tem_scanner` e `tem_impressora` quando vazios, mas o LLM cita "não possui impressora, scanner nem software CAD" mesmo sem confirmação.

Adicionalmente, `data_primeiro_contato` no lead canônico não reflete o `MIN(deals.piperun_created_at)`.

## Solução escolhida

1. Enriquecer o prompt do DeepSeek com histórico real de deals.
2. Recalcular `data_primeiro_contato` a partir do mínimo entre lead/deals **na hora de montar a nota** (sem alterar o campo persistido).

## Mudanças técnicas

### A) `supabase/functions/_shared/waleads-messaging.ts`

Alterar a assinatura de `generateHistoricoOportunidade` para receber também um `dealsContext` (ou aceitar um segundo parâmetro opcional `extraContext: { deals, firstContactAt, currentOwner }`).

- Substituir a linha `Vendedor anterior: ...` por bloco multi-linha:
  ```
  Vendedor atual: <owner do deal mais recente>
  Owners distintos no histórico: <lista única, ordenada por data>
  Total de deals: N (X ganhos · Y perdidos · Z abertos)
  Deals (mais recente primeiro):
    - #ID — pipeline / etapa — status — owner — DD/MM/AAAA
    ... (até 5)
  ```
- Recalcular `Primeiro contato: ${MIN(deals.piperun_created_at, lead.data_primeiro_contato, lead.created_at)}`.
- Acrescentar regra explícita ao prompt:
  > "Use APENAS os fatos listados em DADOS. Não invente nomes de vendedores nem datas. Se 'Owners distintos' tiver mais de um, mencione cada um. Se 'Vendedor atual' diferir do mais antigo, deixe claro que houve troca de owner."
- Reduzir `temperature` de 0.5 para 0.2.

### B) `supabase/functions/smart-ops-lia-assign/index.ts`

Antes de chamar `generateHistoricoOportunidade` (linhas 818 e 920), buscar deals do lead canônico:

```ts
const { data: deals } = await supabase
  .from("deals")
  .select("piperun_deal_id, pipeline_name, stage_name, status, owner_name, piperun_created_at")
  .eq("lead_id", lead.id)
  .eq("is_deleted", false)
  .order("piperun_created_at", { ascending: false })
  .limit(20);
```

Montar `dealsContext`:
- `total`, `ganhos`, `perdidos`, `abertos` (contagens por `status`).
- `currentOwner = deals[0]?.owner_name`.
- `distinctOwners` = lista única preservando ordem cronológica.
- `firstContactAt = min(MIN(deals.piperun_created_at), lead.data_primeiro_contato, lead.created_at)`.
- `recent` = primeiras 5 entradas formatadas.

Passar esse contexto para `generateHistoricoOportunidade`. O fallback estático (linhas 826–836 e similar no buildDealNoteHTML) também passa a usar `firstContactAt` recalculado e `currentOwner` em vez de `proprietario_lead_crm`.

### C) Reuso em `buildDealNoteHTML`

Aplicar exatamente o mesmo enriquecimento na função HTML (linhas 886–1034), já que ela chama o mesmo `generateHistoricoOportunidade`. Extrair a busca de deals para uma helper local (`fetchDealsContext(supabase, lead)`) chamada por ambas.

### D) Guard contra alucinação

No pós-processamento de `generateHistoricoOportunidade` (já existe um regex que troca o nome do lead por "o profissional"), adicionar:
- Se o texto retornado citar um nome próprio de vendedor que **não** está em `distinctOwners`, substituir por "vendedor anterior" (regex sobre lista de tokens capitalizados isolados que casem com `\bSrtaa? [A-Z]\w+`/`\bvendedor[a]? [A-Z]\w+`). Implementação simples: split por espaço, manter apenas se token maiúsculo estiver em allowlist.
- Limitar a 500 chars já existe — manter.

### Fora de escopo

- Não recalcular nem persistir `lia_attendances.data_primeiro_contato` (display-only por enquanto).
- Não tocar no enriquecimento cognitivo (cognitive_analysis vazio continua vazio).
- Não alterar `smart-ops-evolution-manager` nem o front Evolution já entregue.

## Validação

1. Rodar `supabase--curl_edge_functions` chamando `/smart-ops-lia-assign` em modo dry-run para o lead canônico de Marlo Vinicios (id derivado do `piperun_id` do deal #59699356) e conferir a nota gerada.
2. Inspecionar `supabase--edge_function_logs smart-ops-lia-assign` filtrando por `generate-briefing-deepseek` para confirmar que o prompt agora contém o bloco "Deals (mais recente primeiro)".
3. Confirmar que o texto não cita nome de vendedor fora de `distinctOwners`.
