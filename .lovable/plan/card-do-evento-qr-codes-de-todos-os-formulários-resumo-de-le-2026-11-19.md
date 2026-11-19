# Card do evento: QR Codes de todos os formulários + resumo de leads

## O que muda (só para a equipe logada)

**1. QR Codes e links no card do evento (página Eventos)**
Hoje só existe o bloco "Distribuição — Cadastro". Passa a ter um bloco por formulário do evento, cada um com Copiar link e QR Code (formulário e simulador WhatsApp, quando houver):
- Distribuição — Cadastro
- Cadastro de leads (visitantes)
- Interessados em ser KOL (expansão)

**2. Resumo de leads no card**
```text
Leads distribuição           N   (países)
Leads visitantes             N
Leads KOLs de vendedores     N
Leads KOLs (expansão)        N
```
- Distribuição: contagem atual (sem mudança).
- Visitantes: envios do formulário de cadastro de leads do evento (um lead por formulário, leads mesclados contam no principal).
- KOLs (expansão): envios do formulário "Interessados em KOL" do evento.
- KOLs de vendedores: indicações feitas pela "Inserção CRM" da Agenda em que o vendedor escolheu este evento (ver item 3).

**3. Agenda — Inserção CRM (indicação de KOL)**
- Nova lista suspensa opcional "Evento", mostrando só os eventos ativos em andamento ou próximos. Se não houver eventos, a lista não aparece.
- O evento escolhido fica gravado na indicação (envio do lead e timeline), sem alterar vendedor, funil, comissão ou a regra de Vendas.

## Detalhes técnicos
- `EventDistribuicaoTools` vira genérico (recebe título + form) e é renderizado para os forms `distribuicao`, `sdr_captacao/lead` e `kol_expansao` do evento em `KbTabEventos.tsx` (o mapa hoje guarda só um form "visitante" e o de distribuição; passa a guardar por `form_purpose`).
- Contagens: estender a edge `distribution-event-metrics` (já pública e de leitura) — ou nova RPC service-only — devolvendo `visitor_leads`, `kol_expansion_leads`, `kol_seller_leads` por evento, contando `lead_form_submissions` distintos por lead canônico (`merged_into IS NULL`). Nada de linhas de lead exposto.
- `crm-insercao`: aceita `event_id` opcional, valida server-side que o evento existe e está ativo, e o envia como `event_id` no ingest (submissão fica ligada ao evento). `CrmInsertionButton` busca eventos ativos com `end_date >= hoje`.
- Nenhum campo novo nos formulários públicos; a lista de evento é só da tela interna da Agenda.
- Registrar a regra em `src/components/smartops/AGENTS.md`.

## Validação
- Abrir Eventos logado e conferir os 3 blocos de QR e os 4 números no ABO US.
- Conferir a lista de eventos na Inserção CRM sem enviar indicação real.
