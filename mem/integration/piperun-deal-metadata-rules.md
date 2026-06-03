As regras de criação de negócios no PipeRun (smart-ops-lia-assign):
- Título do negócio = nome limpo da pessoa (sanitizado).
- Origem do negócio (`origin_id`) é definida APENAS na criação (POST /deals).
  NUNCA reenviar `origin_id` em PUT /deals/{id} — nem em updateExistingDeal,
  moveDealToVendas, ou no enrichment PUT pós-create. Reenviar causa loop de
  "Alteração da origem" na timeline do PipeRun quando webhooks/sync leem a
  origem de volta.
- Origem é resolvida pelo nome exato do formulário (`resolveOriginId(form_name)`),
  com cache e criação dinâmica (`active: true`) para evitar fallback genérico.
- Campo "Produto de interesse (auto)" preenchido por keywords do form context.
