Diagnóstico confirmado: o PipeRun está criando Deal/Pessoa, mas a gravação de volta em `lia_attendances` falha depois, então o lead fica sem `piperun_id` local e o retry tenta de novo, gerando duplicações e cards inconsistentes.

Causa raiz encontrada:
- A falha registrada é `column "value" does not exist` durante o update crítico do `smart-ops-lia-assign`.
- Isso vem do trigger de banco `trg_sdr_voice_on_seller_assign`, função `fn_trigger_sdr_voice_on_assign()`.
- A função tenta ler `SELECT value FROM vault.secrets`, mas a tabela `vault.secrets` não tem coluna `value`; tem `secret`.
- Como esse trigger roda quando `proprietario_lead_crm` é preenchido, ele aborta o update inteiro que deveria salvar `piperun_id`, `pessoa_piperun_id`, funil, etapa e owner.
- Resultado: o Deal já foi criado no PipeRun, mas o CDP fica como se nada tivesse sido criado; o cron `smart-ops-piperun-retry-failed-leads` reprocessa e pode criar outro Deal.

Plano de correção:

1. Estancar a origem do erro
- Corrigir `fn_trigger_sdr_voice_on_assign()` para nunca abortar updates de CRM.
- Substituir a leitura inválida de `vault.secrets.value` por fonte segura existente ou remover esse fallback.
- Envolver o envio HTTP do SDR voice em `BEGIN ... EXCEPTION ... END`, para qualquer erro virar log e não rollback do lead.
- Manter a regra principal: nenhuma automação de voz pode bloquear criação/atualização de Deal.

2. Proteger o retry para não criar duplicata
- Ajustar `smart-ops-piperun-retry-failed-leads` para, antes de chamar `smart-ops-lia-assign`, fazer preflight por e-mail e telefone.
- Se já existir Deal aberto no PipeRun para a pessoa, não criar novo: apenas vincular/atualizar o lead local e completar custom fields.
- Se o lead local já teve erro `lead_update_failed` com `attempted_piperun_id`, reutilizar esse Deal em vez de criar outro.

3. Fortalecer identidade antes de Deal
- No `smart-ops-lia-assign`, bloquear Deal se não houver e-mail nem telefone no lead local.
- Validar que `createPerson` recebeu e enviou e-mail/telefone reais.
- Antes de criar Deal novo, buscar pessoa por e-mail e por telefone com match estrito; se encontrar, reaproveitar a Pessoa e seus Deals.
- Se existir Deal aberto no Funil de Vendas: preservar owner/stage e só atualizar campos/nota.
- Se existir Deal aberto em Estagnados: marcar perdido com motivo `entrou_em_outro_formulario` ou reativar conforme a regra SDR já definida.
- Se não existir Deal: criar um único Deal novo.

4. Completar dados no PipeRun
- Garantir que update de Pessoa envie telefone e e-mail quando faltantes.
- Garantir que Deal receba custom fields via hash: WhatsApp, produto interesse, área, especialidade, tem scanner, tem impressora, país e Banco de Dados ID.
- Adicionar fallback de `form_data` para campos que chegaram em notas/formulário mas ainda não subiram para coluna top-level.

5. Recuperar os leads quebrados de hoje
- Rodar uma recuperação controlada para leads recentes com `piperun_id IS NULL` e erro `column "value" does not exist`.
- Para cada caso, reaproveitar o `attempted_piperun_id` registrado em `system_health_logs` quando existir.
- Atualizar `lia_attendances` com `piperun_id`, `pessoa_piperun_id`, owner, funil e etapa sem recriar Deal.
- Depois, rodar backfill de custom fields para esses Deals.

6. Corrigir/registrar B2B/B2C
- Reativar a classificação no CDP usando `buyer_type`:
  - `PJ/B2B` quando houver CNPJ, razão social, empresa ou origem/compra corporativa.
  - `PF/B2C` quando não houver CNPJ/empresa e o contato for pessoa física.
- Propagar esse valor para PipeRun se já houver campo custom correspondente mapeado; se não houver, deixar no CDP e logar ausência de campo PipeRun.

7. Validação
- Testar com os casos citados: Marcia, Marcos, Eduardo, Talitha, Jonathan e Dr. Valente.
- Confirmar no banco que todos ficam com `piperun_id`, `pessoa_piperun_id`, owner, funil e etapa.
- Confirmar que o retry não cria novos Deals duplicados.
- Confirmar que o card do PipeRun exibe e-mail/telefone na Pessoa e WhatsApp/custom fields no Deal.