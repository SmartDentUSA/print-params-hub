
Objetivo: corrigir 2 frentes ao mesmo tempo: (1) envio “enviado no log” sem chegada no celular e (2) aba WhatsApp difícil/inexistente na navegação.

1) Ajustar navegação para a aba WhatsApp sempre aparecer
- Arquivos:
  - `src/pages/AdminViewSecure.tsx`
  - `src/components/SmartOpsTab.tsx`
- Trocar `TabsList` com `grid-cols-*` por layout scrollável horizontal (`overflow-x-auto`, `flex-nowrap`, largura mínima por tab).
- Garantir que o trigger `value="whatsapp"` fique sempre acessível em telas menores.

2) Corrigir consistência de persistência no fluxo LIA
- Arquivo: `supabase/functions/dra-lia-whatsapp/index.ts`
- Remover INSERT manual de `outbound` em `whatsapp_inbox` (manter só inbound no webhook).
- Deixar o `outbound` ser persistido apenas por `smart-ops-send-waleads` quando retorno do provider for sucesso real.
- Manter dedup/anti-loop existentes.

3) Enriquecer rastreabilidade de envio no backend
- Arquivo: `supabase/functions/smart-ops-send-waleads/index.ts`
- Parsear JSON de resposta da WaLeads e extrair `code`, `message`, `data.timestamp`, `data.channelId`.
- Registrar esses campos no log (via `message_logs.error_details` estruturado em JSON string no curto prazo).
- Incluir `provider_code`/`provider_channel`/`provider_timestamp` também no response da função para debug imediato.

4) Melhorar UX da Inbox para não “sumir conversa”
- Arquivo: `src/components/SmartOpsWhatsAppInbox.tsx`
- Busca por telefone: aceitar número completo (`55...`), DDD+9 e últimos 9 dígitos.
- Exibir telefone completo junto do nome do lead na lista/header.
- Adicionar polling leve (ex.: 5–10s) para recarregar conversas automaticamente e fallback quando não houver atualização visual.

5) Validação E2E após implementação
- Teste A: envio manual (vendedor) para `5519992612348`.
- Teste B: resposta autônoma LIA para o mesmo número.
- Confirmar em sequência:
  - `message_logs` com metadados do provider (`MESSAGE_SENT`, `channelId`, `timestamp`);
  - `whatsapp_inbox` com `outbound` único por envio;
  - conversa aparecendo na aba WhatsApp sem refresh manual;
  - confirmação de chegada no aparelho.

Detalhes técnicos
- Estado atual já comprova persistência local (`whatsapp_inbox`) e log “enviado” mesmo sem confirmação de entrega no aparelho; portanto precisamos separar claramente:
  - “aceito pela API” (provider accepted),
  - “entregue no dispositivo” (não garantido pela API atual).
- O layout atual de tabs usa combinações que podem ocultar a aba final em viewport menor; a correção será estrutural (tabs roláveis), não apenas de texto.
- O ajuste de persistência evita falsos positivos e reduz efeitos colaterais no dedup por `outbound` artificial.
