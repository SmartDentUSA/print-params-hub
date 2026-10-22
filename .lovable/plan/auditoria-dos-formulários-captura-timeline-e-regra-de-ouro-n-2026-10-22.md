# Auditoria dos formulários: captura, timeline e Regra de Ouro no CRM

Objetivo: comprovar com dados reais, formulário por formulário, que (1) toda resposta do lead é gravada, (2) aparece na timeline do lead e (3) segue o fluxo de inserção no CRM com a Regra de Ouro. Primeiro só leitura; correções apenas onde a auditoria mostrar falha, com sua aprovação.

## Etapa 1 — Inventário (somente leitura)
- Listar todos os formulários ativos do sistema (internos, landing pages, Bio, KOL/indicação, eventos, chat Atendimento) e os formulários Meta mapeados.
- Para cada um: perguntas configuradas, volume de envios nos últimos 30/90 dias e data do último envio.

## Etapa 2 — Captura das respostas
Para uma amostra recente de cada formulário (até 20 envios):
- Comparar as perguntas do formulário com o que ficou salvo no envio e no `form_data` do lead.
- Apontar perguntas respondidas que não foram salvas, respostas salvas com chave errada, campos de equipamento/produto de interesse não preenchidos e telefone salvo sem versão normalizada.

## Etapa 3 — Timeline do lead
- Verificar se cada envio gerou o evento correspondente na timeline (atividade do lead), com o nome do formulário/evento e as respostas.
- Apontar envios sem evento, eventos duplicados e eventos ligados a lead mesclado (não canônico).

## Etapa 4 — Fluxo CRM e Regra de Ouro
Para os mesmos envios:
- Pessoa no PipeRun criada/reutilizada só com e-mail ou telefone; origem da pessoa congelada no primeiro contato.
- Deal: reaproveitou deal aberto em Vendas (<30 dias) sem trocar vendedor/etapa; criou novo só quando permitido; sem duplicados.
- Origem e produto de interesse do deal iguais à nota "Resumo do Lead"; nota única por lead.
- Formulários de indicação KOL: vendedor fixo aplicado conforme a regra de indicação; CS e ganhos intocados.
- Falhas registradas (bloqueios, erros do PipeRun, filas de retry pendentes).

## Etapa 5 — Relatório
Tabela por formulário: envios, % respostas completas, % na timeline, % com fluxo CRM correto, problemas encontrados com exemplos (IDs). Entregue em `docs/manual/17-auditoria-formularios.md` e resumido no chat.

## Etapa 6 — Correções (só após sua aprovação)
Proposta de correção por categoria de falha (não caso a caso), com testes. Nada de reprocessar envios antigos, alterar deals ganhos/CS ou mesclar leads sem sua confirmação.

## Detalhes técnicos
- Fontes: `smartops_forms`/perguntas, `lead_form_submissions`, `lia_attendances.form_data` (sempre `merged_into IS NULL`), `lead_activity_log`, `deals`, `meta_form_mappings`, logs das funções de ingestão/`lia-assign`, `system_health_logs`.
- Consultas apenas SELECT nas etapas 1–5; leitura do código de ingestão e `_shared/commercial-intent.ts` para confirmar as regras esperadas.
- Guardas preservadas: Regra de Ouro, lock de criação de deal, lock da nota, `fn_sync_normalized_from_lead`, `LeadDetailPanel.tsx` intocado.
