## Problema

A nota postada no PipeRun na **atribuição inicial** do lead (ex.: Alexandre Camargo) usa o template legado `buildDealNoteHTML` (linhas 1297–1330 de `smart-ops-lia-assign/index.ts`), que só contém:

- Cabeçalho do lead
- `HISTÓRICO` + `OPORTUNIDADE` (geradas pela DeepSeek antiga)
- `Análise Cognitiva`
- Respostas do formulário cruas

O novo **Resumo do Lead** com **Diagnóstico Fluxo Digital 7×3** (com RAG do `system_a_catalog` + regra Rayshape) só é postado em **eventos posteriores** (via `smart-ops-deal-form-note`), nunca no momento da atribuição. Daí a aparência "antiga" no PipeRun.

## Objetivo

Fazer a **nota de atribuição inicial** (e os 3 pontos de postagem no `lia-assign`: update, move, create) usarem o `buildSellerDealSummaryHTML` (que já chama `diagnoseLead` internamente e renderiza o bloco 7×3 com Rayshape/RAG).

## Mudanças (apenas em `supabase/functions/smart-ops-lia-assign/index.ts`)

1. **Substituir `buildDealNoteHTML` pelo `buildSellerDealSummaryHTML`** em todos os pontos onde a nota é postada:
   - `updateExistingDeal` (linha 702)
   - `moveDealToVendas` (linha 737) — preservando o cabeçalho `🔄 Deal reativado…`
   - `createNewDeal` (linha 804)

2. **Repassar `formResponses` como `highlightFormResponses`** (com `highlightFormName = lead.form_name`) para destacar no topo o formulário que disparou a atribuição, como já faz o `deal-form-note`.

3. **Idempotência reutilizada**: aplicar o mesmo padrão de hash já presente em `deal-form-note` (compara `last_seller_note_hash` antes de postar; persiste após sucesso). Isso evita repostagens quando o webhook Meta reentrega.

4. **Manter `buildDealNoteHTML` no arquivo** (não excluir) por enquanto, marcado como `@deprecated`, caso algum outro fluxo ainda o use — verificar usos restantes antes do hand-off.

5. **WhatsApp/Evolution NÃO muda** — `waleads-messaging.ts` continua mandando o mesmo briefing curto para o vendedor (apenas o que vai pro PipeRun é enriquecido).

## Validação

- Rodar `smart-ops-preview-seller-note?email=tpd.camargo1@gmail.com` e conferir que o HTML já inclui o bloco 7×3 com Rayshape (caso o lead tenha impressora declarada — o Alexandre não tem, então o bloco deve só citar GlazeON via RAG).
- Reatribuir manualmente um lead de teste e verificar a nota no PipeRun.
- Confirmar que webhook Meta reentregue não duplica nota (hash bate).

## O que NÃO muda

- Sem migração de schema.
- Sem alteração na `_shared/workflow-diagnosis.ts`, `product-rag.ts` ou `seller-summary.ts` (já estão prontos).
- Sem mudança na mensagem WhatsApp ao vendedor.
- Sem mudança na lógica de criação/atualização de deal — só o conteúdo da nota.

## Arquivos tocados

- `supabase/functions/smart-ops-lia-assign/index.ts` (3 call-sites + import + bloco de idempotência)
- `mem/smart-ops/seller-note-workflow-diagnosis.md` (atualizar nota: agora aplicado também na atribuição inicial)
