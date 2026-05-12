Plano de correção:

1. Diagnosticar o PipeRun real antes de alterar lógica
   - Buscar o deal `59699720` diretamente na API PipeRun com `custom_fields`, `person`, `company`, `origin` e `stage`.
   - Buscar 1 deal recente do `# - Formulário exocad I.A.` com os mesmos parâmetros.
   - Comparar o formato que a API retorna/preenche contra o payload atual enviado pelo `smart-ops-lia-assign`.

2. Corrigir o payload de custom fields no fluxo Pessoa → Organização → Deal
   - Ajustar `smart-ops-lia-assign` para gravar os campos personalizados no formato aceito pelo PipeRun para criação/atualização de deal.
   - Manter a regra do exocad: se já existe deal aberto em Vendas, preservar owner/stage e só enriquecer campos + nota.
   - Se não existe deal aberto e não há ganho impeditivo, criar no funil correto e enriquecer imediatamente.
   - Não mexer em Astron/e-commerce/raw WhatsApp: continuam bloqueados para criação automática de deal.

3. Persistir evidência local da sincronização
   - Após PUT/POST bem-sucedido, salvar em `lia_attendances.piperun_custom_fields` os campos enviados.
   - Rebuscar o deal no PipeRun após atualização para confirmar se os campos voltaram preenchidos.
   - Se o PipeRun responder 200 mas não persistir os campos, registrar `system_health_logs` com o payload e campos ausentes.

4. Reprocessar e validar Flávio Rodrigues
   - Reexecutar o enriquecimento do lead `0f01ca2e-755c-4080-a8fb-fd7c4650e787` / deal `59699720`.
   - Confirmar no retorno bruto do PipeRun que estes campos existem no deal: WhatsApp, Produto de interesse, Área de Atuação, Tem scanner, Tem impressora.
   - Atualizar o registro local com o snapshot final.

5. Teste de regressão
   - Adicionar/ajustar teste pequeno para garantir que `# - Impresoras - Smart Dent` e `# - Formulário exocad I.A.` geram o mesmo payload de custom fields para o deal.
   - Validar que notas continuam sendo criadas, mas não são o único dado enviado.