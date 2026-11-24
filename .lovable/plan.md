# Etapa A — Menu do AUTO com 4 tipos, subtipo e origem de Distribuição

Escopo: somente a etapa A do documento enviado. B e C ficam para depois da verificação de A. Funis, etapas e responsáveis não mudam; nenhuma captura real será enviada.

## Plano em 5 linhas
1. Menu novo com 4 tipos (Lead, KOL, Outra oportunidade, Distribuidor); 5 e 6 deixam de ser comando e devolvem o menu; "VENDA DIRETA" e "OPORTUNIDADE DE DISTRIBUIÇÃO" continuam aceitos por texto, já definindo o subtipo.
2. Nova coluna `subtype` nas capturas (venda_direta, padrao, distribuidor, oportunidade); antes, listo as regras atuais da tabela e informo. Capturas antigas com os tipos 4/6 seguem válidas e com rótulo.
3. Pergunta SIM/NÃO única após o FIM (antes da conferência) para Lead ("compra direto no evento?") e Distribuidor ("já distribui?"); KOL e Oportunidade não perguntam. Venda direta é só marcador.
4. Origem padronizada "[DISTRIBUIÇÃO] - evento" no PipeRun para negócio e pessoa novos de distribuição (pessoa existente mantém a origem); nome do evento também vem do evento do formulário, corrigindo a captura WhatsApp. Sem retroagir negócios antigos; origens de Lead/KOL/Oportunidade intactas.
5. Rótulos novos na mensagem final, respostas do formulário, timeline e histórico de capturas; testes atualizados e publicação da função.

## Detalhes técnicos
- `wa-field-capture/logic.ts` + `index.ts`: `CaptureType = lead|kol|oportunidade|distribuicao`; `parseCommand` retorna `{type, subtype?}`; novo `confirm_step = 'subtype'`; `captureFormPurpose` mapeia lead→feira_evento (consultor = remetente), kol→kol_expansao, oportunidade→oportunidade_evento, distribuicao→distribuicao; legados venda_direta/oportunidade_distribuicao mapeados para leitura.
- Migração: `ALTER TABLE field_capture_sessions ADD COLUMN subtype text` + CHECK; constraint de `capture_type` mantém os valores legados. Sem mudança de RLS/grants.
- `_shared/kol-expansion.ts`: `distributionOrigin(eventName)` (máx. 190 caracteres, sem evento "[DISTRIBUIÇÃO]").
- `distribuicao-crm-sync`: `resolveOriginId` igual ao de `kol-expansao-crm-sync`; evento por `distribuicao_event_id` ou `smartops_forms.event_id`.
- `event_data.label` e `event_data.subtype` em `lead_activity_log` (sem mudar schema); `EventFieldCapturesButton.tsx` com os 6 rótulos.
- Testes Deno: parseCommand (1–6, LEAD, VENDA DIRETA, DISTRIBUIDOR, OPORTUNIDADE DE DISTRIBUICAO), rótulos, distributionOrigin.

## Entrega da verificação
Texto final do menu, tabela de comandos, SQL da coluna, diff do distribuicao-crm-sync, testes passando e o que não foi feito.
