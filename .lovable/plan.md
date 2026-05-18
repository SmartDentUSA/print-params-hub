## Objetivo

Garantir, via testes Deno automatizados, que a proteção anti-echo da `dra-lia-whatsapp`:
1. **Ignora** mensagens inbound que são eco de saídas recentes da própria LIA (mesmo texto, com emoji/pontuação/caixa diferente, ou prefixo longo).
2. **NÃO bloqueia** conversas reais (perguntas curtas do lead, respostas distintas, textos parecidos mas não idênticos).

## Estratégia

A lógica atual mistura função pura (`normalizeForEcho`) com I/O (consulta `whatsapp_inbox`). Para testar de forma confiável e rápida, dividir em duas camadas:

### 1. Extrair função pura `isEchoOfOutbound`
Criar `supabase/functions/dra-lia-whatsapp/echo-guard.ts` exportando:
- `normalizeForEcho(s: string): string` (movida de `index.ts`)
- `isEchoOfOutbound(incoming: string, recentOutbound: string[]): { isEcho: boolean; matchedIndex?: number; reason?: string }`

Reusar em `index.ts` (import + remover duplicata). Lógica idêntica à atual: comparar normalizado, exato OU prefixo ≥60 chars quando outbound > 40 chars, ignorando outbound < 8 chars normalizados.

### 2. Suite de testes unitários (offline, rápida)
Arquivo: `supabase/functions/dra-lia-whatsapp/echo-guard_test.ts` — `Deno.test()` cobrindo:

**Casos que DEVEM detectar eco (isEcho=true):**
- Texto idêntico ao último outbound
- Mesmo texto com emoji adicionado ("Olá! 👋" vs "Olá!")
- Diferença apenas em caixa/pontuação ("Tudo bem?" vs "tudo bem")
- Espaços/quebras de linha extras
- Inbound com prefixo de outbound longo (>60 chars do início)
- Match contra qualquer um dos últimos 5 outbounds (não só o mais recente)

**Casos que NÃO podem ser eco (isEcho=false):**
- Resposta curta típica do lead: "sim", "ok", "quanto custa?"
- Pergunta nova do lead totalmente diferente
- Outbound vazio ou < 8 chars normalizados (ignorar como base de comparação)
- Lista de outbounds vazia
- Texto parecido mas não prefixo (ex.: lead repete uma palavra do bot)
- Inbound longo que contém só uma palavra comum do outbound

### 3. Teste de integração (deployed function)
Arquivo: `supabase/functions/dra-lia-whatsapp/index_test.ts` — usando `supabase--curl_edge_functions` semantics via `fetch` direto + `dotenv/load.ts`:

- **Setup**: usar telefone de teste (ex.: `5500000000099`). Inserir 1 linha em `whatsapp_inbox` com `direction=outbound`, `phone_normalized` correspondente, `message_text="Olá Dr., posso te ajudar com a Anycubic Photon Mono M5s?"`.
- **Cenário 1 (eco)**: POST webhook com mesmo texto + emoji → esperar `{ ignored: true, reason: "echo_of_own_outbound" }`, status 200.
- **Cenário 2 (real)**: POST webhook com `"quanto custa a m5s?"` → esperar resposta processada (não ignorada por echo; pode retornar 200 com outro shape).
- **Teardown**: deletar linhas de teste.

Marcar testes de integração como skip se `VITE_SUPABASE_URL` ausente, para não quebrar em ambientes sem `.env`.

### 4. Execução
Rodar via `supabase--test_edge_functions` com `{ functions: ["dra-lia-whatsapp"] }`. Unit tests rodam em < 1s; integração roda contra o ambiente real.

## Arquivos a criar/alterar

- **Novo**: `supabase/functions/dra-lia-whatsapp/echo-guard.ts` (função pura extraída)
- **Novo**: `supabase/functions/dra-lia-whatsapp/echo-guard_test.ts` (~15 casos unitários)
- **Novo**: `supabase/functions/dra-lia-whatsapp/index_test.ts` (2 casos integração + setup/teardown)
- **Editar**: `supabase/functions/dra-lia-whatsapp/index.ts` — importar de `echo-guard.ts`, remover `normalizeForEcho` local e substituir o bloco inline pelo `isEchoOfOutbound`

## Fora de escopo

- Mudar a lógica de anti-echo em si (apenas extrair + testar comportamento atual).
- Testar resolução de LID, pré-seed de lead ou qualificação — outros guardas têm seus próprios planos.
- Mock de Supabase client (preferimos integração real para o I/O).