

## Plano: Testar Resposta Autônoma da Dra. LIA via WhatsApp

### Objetivo
Enviar uma mensagem simulando um lead para o número `5519992612348` e verificar se a Dra. LIA processa e responde autonomamente.

### Passos

1. **Enviar mensagem de teste** via `smart-ops-send-waleads` usando o celular da Patricia para `5519992612348` com uma pergunta real (ex: "Qual impressora 3D vocês recomendam para consultório?")

2. **Verificar se o webhook `dra-lia-whatsapp` é acionado** — quando o destinatário responder, o WaLeads deve disparar o webhook que chama `dra-lia-whatsapp`

3. **Checar logs da edge function `dra-lia-whatsapp`** para confirmar que:
   - O lead foi identificado ou criado em `lia_attendances`
   - A Dra. LIA gerou uma resposta original via `dra-lia`
   - A resposta foi enviada de volta via WaLeads API

4. **Consultar `whatsapp_inbox`** para verificar que tanto o inbound quanto o outbound ficaram registrados

### Observação Importante
O fluxo autônomo depende de o **destinatário responder** a mensagem. O ciclo completo é:
- Nós enviamos → destinatário recebe → destinatário responde → WaLeads webhook → `dra-lia-whatsapp` → LIA gera resposta → envia de volta

Sem a resposta do destinatário, não há como testar o fluxo autônomo completo apenas enviando uma mensagem inicial.

### Detalhes Técnicos
- Edge function: `dra-lia-whatsapp` (recebe webhook do WaLeads)
- Team member: Patricia (`a49ade61-3671-4bab-982e-443f026422f7`)
- Dedup window: 5 segundos entre respostas
- Max WhatsApp length: 4000 caracteres

