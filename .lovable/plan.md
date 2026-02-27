

## Plano: Deploy e teste da função corrigida

### Passo 1: Deploy da edge function corrigida
A função `dra-lia-whatsapp` já foi editada com as correções (template detection, expanded field mapping, timestamp no email), mas precisa ser deployada para que as mudanças entrem em vigor.

### Passo 2: Teste via curl simulando payload
Enviar chamada de teste com payload real para confirmar que a função está respondendo corretamente.

### Passo 3: Orientação para o usuário
Após deploy, o usuário deve:
1. Enviar outra mensagem de WhatsApp para o número do atendente
2. Verificar nos logs se agora aparece `Body keys:` mostrando os campos reais do WaLeads
3. Se retornar 422 com `template_variables_not_resolved`, o campo `received_body` mostrará o payload exato — com isso saberemos os nomes corretos das variáveis para configurar no Body do webhook

### Detalhes técnicos
- Nenhuma alteração de código necessária — a função já foi corrigida na mensagem anterior
- Apenas deploy + teste + ajuste na config do WaLeads

