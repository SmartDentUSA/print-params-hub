

# Plano: Cerca de Persona + Instrumentacao de Tokens + Filtro de Teste + Redirect de Preco

## Resumo

4 mudancas cirurgicas em 2 arquivos para resolver os problemas identificados na auditoria.

## Arquivo 1: `supabase/functions/dra-lia/index.ts`

### Mudanca A — Interceptor `isGeneralKnowledge` pre-RAG (linha ~3854)

Inserir **antes** do support guard (linha 3852) um novo bloco interceptor:

```typescript
const GENERAL_KNOWLEDGE_PATTERNS = [
  /qual a capital d[aeo]/i,
  /quem (descobriu|inventou|criou|foi|é|eh) /i,
  /quem foi [A-Z][a-z]+ [A-Z]/i,
  /por que (você|vc|voce) se chama/i,
  /(historia|história) d[aeo] /i,
  /em que ano /i,
  /onde fica[s]? /i,
  /quem [eé] [A-Z][a-z]+/i,
  /o que significa [a-z]+ (?!resina|impressora|scanner|cad|cam)/i,
  /qual o sentido d[aeo]/i,
  /presidente d[aeo]/i,
  /quantos (estados|paises|continentes)/i,
];

function isGeneralKnowledge(msg: string): boolean {
  return GENERAL_KNOWLEDGE_PATTERNS.some(p => p.test(msg.trim()));
}
```

O interceptor retorna SSE com resposta fixa localizada (PT/EN/ES) sem consultar RAG nem LLM. Salva em `agent_interactions` com `context_raw: "[INTERCEPTOR] general_knowledge_guard"`. **Nao registra knowledge gap.**

### Mudanca B — Regra 32 no system prompt (linha ~4597)

Adicionar apos a regra 31 como fallback para queries que escapem do regex:

```
32. PERGUNTAS FORA DO DOMINIO (conhecimento geral, geografia, historia, celebridades):
    Se a pergunta NAO tem relacao com odontologia digital, impressao 3D, scanners, resinas, CAD/CAM
    ou produtos SmartDent, NAO responda. Use OBRIGATORIAMENTE:
    "Sou especialista em odontologia digital! 😊 Posso te ajudar com scanners, impressoras 3D,
    resinas, softwares CAD ou parametros de impressao. Como posso ajudar nessa area?"
```

### Mudanca C — Instrumentacao de tokens no bloco `[DONE]` (linha ~4839)

1. Importar `logAIUsage` de `../_shared/log-ai-usage.ts` no topo do arquivo
2. Adicionar variavel `usedModel` que rastreia qual modelo respondeu na cadeia de fallback (gemini-2.5-flash → flash-lite → gpt-5-mini → gpt-5-nano)
3. No bloco `[DONE]` (apos salvar `agent_response`), inserir:

```typescript
const promptChars = messagesForAI.reduce((s, m) => s + m.content.length, 0);
const completionChars = fullResponse.length;
logAIUsage({
  functionName: "dra-lia",
  actionLabel: "chat-streaming",
  model: usedModel,
  promptTokens: Math.ceil(promptChars / 4),
  completionTokens: Math.ceil(completionChars / 4),
  metadata: { topic_context, session_id, is_commercial: isCommercial },
}).catch(() => {});
```

### Mudanca D — Interceptor de preco com redirect automatico

Adicionar apos o general_knowledge guard, antes do support guard:

```typescript
const PRICE_INTENT_PATTERNS = [
  /quanto custa/i, /qual o (valor|preco|preço)/i,
  /me passa[r]? (o )?(valor|preco|preço)/i,
  /how much/i, /cuánto cuesta/i,
  /tabela de preco/i, /price list/i,
];
```

Quando detectado: retorna a resposta da Regra 24 (ecossistema + link WhatsApp) como SSE fixa + dispara `show_whatsapp_button` no meta event. Economiza RAG+LLM e redireciona imediatamente ao vendedor.

## Arquivo 2: `supabase/functions/smart-ops-ingest-lead/index.ts`

### Mudanca E — Fix CORS headers (linha 6)

Atualizar para incluir headers Supabase:
```typescript
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
```

### Mudanca F — Filtro de email de teste

Adicionar validacao antes do insert/update:
```typescript
const TEST_DOMAINS = ["@test.com", "@example.com", "@test.com.br"];
const isTestEmail = TEST_DOMAINS.some(d => email.endsWith(d)) || /^teste?[\-_@]/i.test(email);
```

Se detectado, retorna `{ success: true, skipped: true, reason: "test_email" }` sem inserir no banco.

## Impacto esperado

| Metrica | Antes | Depois |
|---|---|---|
| Score Juiz medio | 2.93 | ~4.0+ |
| Custo visivel | $0.13 (6%) | ~$4.50 (100%) |
| Leads de teste no DB | 12 | 0 novos |
| Tokens gastos em off-topic | ~33% interacoes | 0 |

## Dependencias

Nenhuma migration SQL necessaria. Nenhum secret novo. Apenas deploy das 2 edge functions.

