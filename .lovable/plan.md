## Problema

ManyChat External Request tem timeout de ~10 segundos. A bridge atual chama `dra-lia` síncronamente e consome o stream SSE inteiro antes de responder. Em qualquer mensagem que requer LLM + RAG, a resposta volta com 12-25s — o ManyChat já fechou a conexão e dispara o fallback do flow, mesmo a LIA tendo gerado resposta correta (evidência: usuário viu "Olá, da! Que bom te ver…" gerada mas flow caiu em fallback).

Os 3 short-circuits atuais (anti-loop, emoji/URL, saudação de lead conhecido) já respondem em <1s e funcionam. O problema é o caminho LLM.

## Solução: padrão assíncrono via ManyChat Send API

Bridge passa a:
1. Responder **imediatamente** (<2s) ao ManyChat com `messages: []` (não trava o flow, não dispara fallback) ou com um "typing indicator" leve quando apropriado.
2. Disparar processamento `dra-lia` em background (`EdgeRuntime.waitUntil`).
3. Quando `dra-lia` retornar, fazer POST para `https://api.manychat.com/fb/sending/sendContent` com `subscriber_id` + texto, entregando a resposta real no DM do Instagram.

## Mudanças

### 1. Bridge async (`supabase/functions/manychat-lia-bridge/index.ts`)

- Mantém short-circuits 1/2/3 como estão (já são rápidos).
- Para o caminho LLM:
  - Retorna `EMPTY_REPLY` em <2s.
  - `EdgeRuntime.waitUntil(processAsync(...))` executa: chama `dra-lia`, consome SSE, e faz POST para ManyChat Send API.
  - Implementa **chunking**: divide resposta em mensagens de até ~900 chars (limite IG via ManyChat) preservando quebras de parágrafo.
  - Trata `links` markdown — ManyChat aceita texto puro em IG; mantém URL inline.
- Adiciona dedup leve: chave `mc_inflight:{subscriber_id}` em `agent_internal_lookups` (TTL 30s) para evitar reentrância se ManyChat reenviar.

### 2. Secret novo: `MANYCHAT_API_TOKEN`

Page token do ManyChat (Settings → API). Necessário para o Send API. Vou pedir antes de codar.

### 3. Corrige logging (`system_health_logs`)

Helper `logHealth` da bridge usa colunas corretas: `function_name='manychat-lia-bridge'`, `severity` ('info'|'warn'|'error'), `error_type` (curto, ex: `shortcircuit_loop_guard`), `details` (jsonb com payload). Aplica em todos os pontos da bridge.

### 4. Documentação

- Atualiza `mem/dra-lia/progressive-qualification-flow.md` na seção "Canal ManyChat / Instagram" para descrever o novo padrão async + Send API + chunking.
- Cria `mem/integration/manychat-async-send-api.md` resumindo: timeout 10s, padrão fire-and-forget, chunk 900 chars.

## Fora de escopo

- `dra-lia/index.ts`: já reconhece subscribers Instagram, não precisa mudar.
- Investigação do nome "da" do Danilo — tratado depois (problema cosmético separado, provavelmente parsing de nome com vírgula).
- ManyChat flow no painel: nenhuma mudança necessária; ele já está configurado para External Request → permanecer no flow após resposta vazia.

## Validação

1. Curl bridge com lead conhecido + pergunta longa → confirma retorno `<2s` com `EMPTY_REPLY`.
2. Aguarda ~15s, query em `agent_interactions` confirmando que `dra-lia` rodou e gerou resposta para `mc_{subscriberId}`.
3. Consulta `system_health_logs` filtrando `function_name='manychat-lia-bridge'` confirmando logs persistidos (e a chamada `sendContent` retornou 200).
4. Teste real no Instagram com a conta de teste — confirma que a resposta aparece no DM e o flow NÃO dispara fallback.
