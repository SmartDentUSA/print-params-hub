## Objetivo

Hoje, quando um lead **nasce no nosso sistema** e vai para o Piperun via `smart-ops-lia-assign`, geramos uma nota rica para o vendedor (`buildDealNoteHTML` / `buildSellerNotification` com HISTÓRICO, OPORTUNIDADE, 7x3, e-commerce, cursos, análise cognitiva). Quando o lead **nasce no Piperun** e cai em `smart-ops-piperun-webhook` (upsert em `lia_attendances`), atualizamos o CDP mas **não devolvemos nenhuma nota de resumo** para o Deal. O vendedor abre o Deal sem ver o histórico consolidado que o nosso sistema já tem.

Vamos fechar essa lacuna.

## O que vamos construir

Um builder único de "Resumo do Lead para Vendedor" (chamemos `buildSellerDealSummaryHTML`) e disparo automático da nota no Piperun toda vez que um Deal é **criado ou atualizado** via webhook do Piperun, com deduplicação para não floodar o Deal.

## Conteúdo da nota (completo, na ordem que o vendedor lê)

```text
🧾 Resumo do Lead — atualizado por Smart Dent
1. Identidade        nome, e-mail, telefone, cidade/UF, especialidade, área
2. Origem            primeiro contato (data + canal), última conversão, campanha
3. CRM histórico     todos os deals (id, pipeline, stage, valor, status, data)
                     deals ganhos / perdidos / abertos — contagens
4. Compras e-commerce (Loja Integrada + Astron)
                     pedidos com data, número, valor, itens (top 10)
                     LTV total, ticket médio, último pedido
5. Cursos / Treinamentos
                     cursos concluídos / em andamento, certificados, turma
6. 7x3 — preenchimentos de formulário
                     todos os form_responses (label: value), agrupados por form_name
                     equipamentos declarados (impressora, scanner, software CAD)
7. Interações Dra. L.I.A.
                     últimas N perguntas, urgência, perfil psicológico, motivação
8. Inteligência       confidence_score, lead_stage_detected, recommended_approach,
                     risco de objeção, próxima melhor ação
9. Links rápidos     PipeRun, ficha do lead no admin, WhatsApp click-to-chat
```

Tudo formatado em HTML compatível com o editor de notas do Piperun (mesma sintaxe que `addDealNote` já usa em `_shared/piperun-field-map.ts`).

## Arquitetura

### 1. Novo módulo compartilhado: `supabase/functions/_shared/seller-summary.ts`

Função pura `buildSellerDealSummaryHTML(supabase, lead)` que:

- recebe a row canônica de `lia_attendances` (`merged_into IS NULL`) e o supabase client com service role
- consulta em paralelo: `piperun_deals_history` (já no row), `lojaintegrada_orders`, `astron_enrollments`, `form_responses`, `agent_interactions` (últimas 5), `lead_activity_log` (últimas 10)
- monta o HTML acima
- retorna `{ html, hash }` onde `hash = sha256(html)` para dedupe idempotente

Deve substituir/consolidar a lógica duplicada hoje em `buildSellerNotification` e `buildDealNoteHTML` dentro de `smart-ops-lia-assign`. Essas duas continuam funcionando — passam a delegar para o builder compartilhado.

### 2. Disparo automático no webhook

Em `supabase/functions/smart-ops-piperun-webhook/index.ts`, após a etapa "Deals History (upsert current deal snapshot)" e o `update` em `lia_attendances` (~linha 813+), adicionar bloco:

```text
if (dealId && (isNewLead || significantChange)) {
  const { html, hash } = await buildSellerDealSummaryHTML(supabase, mergedLead);
  const last = mergedLead.last_seller_note_hash;
  if (hash !== last) {
    await addDealNote(PIPERUN_API_KEY, Number(dealId), html);
    await supabase.from("lia_attendances")
      .update({
        last_seller_note_hash: hash,
        last_seller_note_at: new Date().toISOString(),
      }).eq("id", leadId);
  }
}
```

`significantChange` = mudou stage, mudou owner, novo deal entrou no histórico, ou novo `form_responses` desde o último envio.

### 3. Migração de schema (mínima)

Duas colunas em `lia_attendances` (nullable, sem default que mexa em dados existentes):

- `last_seller_note_hash text`
- `last_seller_note_at timestamptz`

Sem trigger; controle de idempotência feito no edge function.

### 4. Reuso para o caminho oposto

`smart-ops-lia-assign` (criação/atualização vinda do nosso sistema) e `smart-ops-deal-form-note` (notas de formulário 7x3 isoladas) passam a usar **o mesmo builder**. Hoje a nota do `deal-form-note` mostra só as respostas — vai mostrar respostas + resumo completo, evitando que o vendedor tenha duas fontes diferentes.

### 5. Backfill manual (opcional, sob aprovação)

Edge function `smart-ops-seller-note-backfill` com `dry_run` que:

- lista N leads canônicos com `piperun_id` não nulo e `last_seller_note_at IS NULL`
- gera o HTML e exporta CSV em `/mnt/documents/seller-note-backfill-{ts}.csv` para revisão
- modo `apply: true` posta a nota no Piperun em lote pequeno (ex.: 50/run) com rate-limit

Não roda sem sua aprovação explícita por fase, igual ao plano de preflight.

## Arquivos afetados

```text
supabase/functions/_shared/seller-summary.ts            (novo)
supabase/functions/smart-ops-piperun-webhook/index.ts   (dispara nota + dedupe)
supabase/functions/smart-ops-lia-assign/index.ts        (delega para o shared)
supabase/functions/smart-ops-deal-form-note/index.ts    (delega + anexa resumo)
supabase/functions/smart-ops-seller-note-backfill/index.ts (novo, opcional)
supabase/config.toml                                     (registra a função nova)
+ migration: ALTER TABLE lia_attendances ADD last_seller_note_hash, last_seller_note_at
```

## Validação

1. Disparar webhook simulado para um deal novo → conferir que a nota aparece no Piperun com todas as 9 seções.
2. Re-disparar o mesmo webhook sem mudança → nenhuma nota nova (dedupe por hash).
3. Mudar stage no Piperun → nova nota com seção "CRM histórico" atualizada.
4. Lead com pedidos no e-commerce + 2 forms 7x3 + 1 curso → nota mostra tudo.
5. Query: `SELECT count(*) FROM lia_attendances WHERE piperun_id IS NOT NULL AND last_seller_note_at IS NULL` deve cair monotonicamente após backfill.

## Não faz parte deste plano

- Nada de prices/valores comerciais em conteúdo gerado por IA (memória `content-generation-policy-no-prices-v2` continua valendo — aqui são valores REAIS de pedidos, não geração de conteúdo).
- Não altera o fluxo Golden Rule de criação de Deal (esse continua no `lia-assign` + preflight já planejado).
- Não mexe em `merged_into` nem em consolidação de leads.
