
Objetivo: fazer o lead `afonsomsjunior@hotmail.com` passar a exibir dados nas abas **🏭 Dados do ERP** e **💰 Financeiro** do card.

Diagnóstico confirmado (com base no estado atual):
1) O lead está sem vínculo Omie no banco (`omie_codigo_cliente = null`, `omie_last_sync = null`, `omie_faturamento_total = 0`), então o frontend não tem o que mostrar.
2) As tabelas fonte do Financeiro/ERP estão vazias para esse lead (`deal_items` com `source='omie'` = 0, `omie_parcelas` = 0).
3) O cron atual chama `?action=sync`, mas esse fluxo faz apenas Fase A (clientes) + enrich; não ingere pedidos/parcelas/NF.
4) O matching por CPF/CNPJ ainda é frágil porque compara documento normalizado com campos que no banco muitas vezes estão mascarados (ex.: `906.236.573-68`), o que impede o vínculo de vários PF.
5) Há inconsistência no código do cursor (`cursor_key/cursor_value`) versus schema real da tabela (`key/value`), com erros silenciosos.

Plano de implementação:

1) Corrigir resolução de identidade (PF/PJ robusto)
- Arquivo: `supabase/functions/omie-lead-enricher/index.ts`
- Criar helper único para match documental:
  - normaliza para dígitos
  - tenta comparar com versão dígitos **e** versão mascarada (CPF/CNPJ formatados)
  - aplica em todos os pontos: `resolveLeadByOmieEvent`, `runSync`, `runBackfill`, `cliente.alterado`.
- Resultado esperado: lead PF com CPF mascarado passa a ser encontrado corretamente.

2) Corrigir parser da resposta de clientes Omie
- Arquivo: `supabase/functions/omie-lead-enricher/index.ts`
- Tornar leitura resiliente para payload flat e payload aninhado (ex.: `cliente_cadastro`), com fallback de chaves para:
  - email
  - cnpj/cpf
  - código do cliente Omie
  - razão social/tipo pessoa
- Resultado esperado: `omie_codigo_cliente`, `omie_tipo_pessoa`, `omie_razao_social` deixam de ficar nulos após sync.

3) Corrigir cursor incremental (schema real + sem erro silencioso)
- Arquivo: `supabase/functions/omie-lead-enricher/index.ts`
- Trocar uso de `cursor_key/cursor_value` para `key/value`.
- Adicionar tratamento explícito de erro em select/upsert de cursor (log e fallback seguro).
- Resultado esperado: sync retoma corretamente entre execuções e não “finge” avançar.

4) Fazer `action=sync` realmente alimentar ERP/Financeiro
- Arquivo: `supabase/functions/omie-lead-enricher/index.ts`
- Manter sync leve, mas incluir ingestão incremental de dados financeiros (pedidos/NF/contas a receber) por cursor e janela curta, respeitando timeout de 50s.
- Continuar usando fila `queueEnrich` para recalcular score só dos leads tocados.
- Resultado esperado: cron diário passa a preencher `deal_items`/`omie_parcelas` continuamente, e não só marcar sync de cliente.

5) Adicionar reprocessamento pontual por lead (correção imediata do caso Afonso)
- Arquivo: `supabase/functions/omie-lead-enricher/index.ts`
- Nova ação: `action=sync-lead&lead_id=<uuid>`:
  - resolve o cliente no Omie por email/CPF/CNPJ
  - busca e grava pedidos/NF/parcelas desse lead
  - executa `fn_enrich_lead_from_omie`.
- Resultado esperado: correção imediata do lead sem esperar ciclo completo do cron.

6) Ajuste de segurança operacional do cron
- Remover exposição de credencial sensível versionada em migration e rotacionar a service role key no projeto.
- Regravar jobs cron com a nova chave fora do versionamento de código.

Validação (fim a fim):
1) Banco:
- `lia_attendances` do lead com `omie_codigo_cliente` e `omie_last_sync` preenchidos.
- `deal_items` (`source in ('omie','omie_nfe')`) > 0 para o lead.
- `omie_parcelas` > 0 para o lead.
- `omie_faturamento_total`, `omie_score`, `omie_classificacao` atualizados.

2) API:
- `smart-ops-leads-api?action=detail&id=<leadId>` retornando campos Omie não zerados.

3) UI:
- Abrir o lead no `/admin` e validar:
  - aba **🏭 Dados do ERP** com score/classificação e pedidos
  - aba **💰 Financeiro** com parcelas e resumo
  - Hero card refletindo os dados ERP já integrados.
