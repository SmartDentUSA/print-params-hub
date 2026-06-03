## Plano de correção

1. **Unificar a deduplicação do Resumo do Lead**
   - Criar/usar a mesma lógica de “claim atômico” em todos os pontos que postam `Resumo do Lead`.
   - Corrigir o webhook do PipeRun, que hoje ainda usa comparação simples `hash !== lastHash` e pode correr em paralelo com `smart-ops-lia-assign` e `smart-ops-deal-form-note`.

2. **Bloquear duplicação mesmo quando o conteúdo muda durante a corrida**
   - O caso mostrado tem duas notas quase simultâneas com hashes diferentes porque uma foi gerada antes e outra depois do CRM atualizar histórico/owner/deal atual.
   - Ajustar a regra para tratar a janela curta como “slot ocupado” independentemente de o hash ter mudado, evitando duas notas no mesmo segundo/minuto.

3. **Evitar nota duplicada entre criação de deal e webhook de deal criado**
   - Manter apenas um produtor efetivo do briefing inicial por lead/deal.
   - Se o webhook do PipeRun receber o evento logo após a criação, ele deve respeitar o `last_seller_note_at` recente e não postar outro resumo.

4. **Manter notas úteis, sem spam**
   - Preservar notas de auditoria apenas quando houver enriquecimento real.
   - Não postar “Re-entrega Meta” quando `enriched_fields` estiver vazio.

## Arquivos previstos

- `supabase/functions/smart-ops-lia-assign/index.ts`
- `supabase/functions/smart-ops-deal-form-note/index.ts`
- `supabase/functions/smart-ops-piperun-webhook/index.ts`

## Validação

- Conferir que todos os caminhos usam a mesma janela anti-duplicação.
- Revisar logs recentes esperados: uma única nota `Resumo do Lead` por criação/reentrega, sem duplicata do webhook.
- Depois da implementação, redeploy das Edge Functions alteradas.