

# Por que a LIA NÃO pediu nome/e-mail para leads @lid

## Diagnóstico

O problema é um **bug de pre-seed indevido** na `dra-lia-whatsapp/index.ts`.

### Cadeia do bug (passo a passo):

1. O webhook do WhatsApp (WaLeads) envia o payload com `@lid` (ID interno do WhatsApp) em vez do telefone real
2. A função tenta resolver o `@lid` para telefone real via campos alternativos (`senderPn`, `remoteJidAlt`, `participant`) — **falha** porque o payload não contém esses campos
3. O telefone fica como o próprio LID (ex: `233028399939785`)
4. Busca por `telefone_normalized` no `lia_attendances` — **não encontra ninguém**
5. **Cria um lead novo** com e-mail placeholder `wa_233028399939785_1773072797097@whatsapp.lead` e nome genérico `WhatsApp 9785`
6. **Pre-popula `agent_sessions`** com `lead_id`, `lead_name` e `lead_email` preenchidos (linhas 356-376)
7. Quando `dra-lia` recebe a chamada, `detectLeadCollectionState()` verifica `sessionEntities?.lead_id && sessionEntities?.lead_name && sessionEntities?.lead_email` → **todos existem** → retorna `from_session`
8. **Pula completamente a coleta de nome e e-mail** porque acha que o lead já está identificado

### O fix necessário

Na `dra-lia-whatsapp`, **não fazer pre-seed de `agent_sessions`** quando o lead é recém-criado com e-mail placeholder (`@whatsapp.lead`). Isso fará com que `dra-lia` entre no fluxo normal de coleta (`needs_email_first`), pedindo e-mail e nome ao usuário.

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dra-lia-whatsapp/index.ts` | Condicionar o pre-seed de `agent_sessions` a leads **reais** (que já existiam no banco antes do webhook). Se o lead foi criado agora com `@whatsapp.lead`, NÃO pre-seedar — deixar `dra-lia` coletar nome/e-mail normalmente. |

### Lógica proposta (pseudocódigo):

```text
isNewPlaceholderLead = (leadEmail inclui "@whatsapp.lead")

if (leadId && !isNewPlaceholderLead) {
  // Lead REAL já existia → pre-seed session (pular coleta)
  upsert agent_sessions com extracted_entities
} else {
  // Lead NOVO com placeholder → NÃO pre-seedar
  // dra-lia vai pedir e-mail normalmente
}
```

Adicionalmente, quando `dra-lia` coletar o e-mail real, será necessário atualizar o `lia_attendances` existente (substituir o placeholder) em vez de criar duplicata. Isso já acontece parcialmente via `detectLeadCollectionState` → `needs_name` → busca por e-mail na tabela `leads`. Porém, precisamos também fazer o merge no `lia_attendances` — atualizar o registro placeholder com o e-mail e nome reais coletados.

### Merge de lead placeholder

Após a LIA coletar o e-mail real do usuário, adicionar lógica em `dra-lia/index.ts` no trecho que processa `state: "collected"` para:
1. Verificar se já existe um `lia_attendances` com aquele e-mail real
2. Se sim → mover dados do placeholder para o registro existente e deletar o placeholder
3. Se não → atualizar o registro placeholder com e-mail e nome reais

