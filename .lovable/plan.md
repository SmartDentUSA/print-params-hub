## Objetivo
Fazer a `manychat-lia-bridge` responder diretamente no External Request, sem depender da resposta lenta da LIA nem da Send API, seguindo este fluxo:

1. Recebe `subscriber_id`, `name` e `message` do ManyChat.
2. Procura em `lia_attendances` por `manychat_subscriber_id = subscriber_id` com `merged_into IS NULL`.
3. Se o lead não existe ou está incompleto, coleta nesta ordem:
   - nome
   - e-mail
   - celular com DDD
4. Após completar nome + e-mail + celular, salva/atualiza o lead na base.
5. Responde: “Como posso te ajudar?” e envia opções/quick replies das rotas da LIA, incluindo `site`.
6. Só depois do cadastro completo a conversa pode seguir para a Dra. LIA/RAG.

## O que vou alterar

### 1. `supabase/functions/manychat-lia-bridge/index.ts`
Substituir o caminho atual que chama `dra-lia` por um fluxo próprio de qualificação rápida:

- Buscar o lead por `manychat_subscriber_id`.
- Criar/atualizar lead mínimo quando necessário.
- Usar `agent_sessions.extracted_entities` para guardar o estado da coleta:
  - `awaiting_manychat_name`
  - `awaiting_manychat_email`
  - `awaiting_manychat_phone`
  - `lead_name`
  - `lead_email`
  - `manychat_subscriber_id`
- Retornar sempre uma mensagem útil ao ManyChat, evitando `{ messages: [] }` no fluxo normal.
- Validar e-mail e telefone antes de salvar.
- Normalizar telefone para BR quando possível.
- Incluir quick replies/rotas, por exemplo:
  - `Site`
  - `Falar com especialista`
  - `Produtos`
  - `Cursos`

### 2. Manter segurança e integridade
- Todas as consultas em `lia_attendances` terão `merged_into IS NULL`.
- Não criar PipeRun/CRM automaticamente para lead sem dados reais.
- Manter `crm_creation_blocked` para leads vindos do Instagram/ManyChat até ter identificação mínima.
- Não usar `MANYCHAT_API_KEY` nem Send API.

### 3. Logs para diagnóstico
Adicionar logs em `system_health_logs`:

- `manychat_qualification_start`
- `manychat_ask_name`
- `manychat_ask_email`
- `manychat_ask_phone`
- `manychat_profile_completed`
- `manychat_routes_sent`
- `manychat_invalid_email`
- `manychat_invalid_phone`

## Resultado esperado
Quando chegar mensagem no Instagram via ManyChat:

```text
Lead sem cadastro → “Olá! Para começar, qual é seu nome?”
Nome recebido → “Obrigado, {nome}. Qual é seu melhor e-mail?”
E-mail recebido → “Perfeito. Agora me envie seu celular com DDD.”
Telefone recebido → “Cadastro atualizado. Como posso te ajudar?” + opções de rota
Lead já completo → “Olá, {nome}! Como posso te ajudar?” + opções de rota
```

Assim o bloco do ManyChat não cai mais no fallback durante a qualificação, porque a bridge responde imediatamente com texto próprio.