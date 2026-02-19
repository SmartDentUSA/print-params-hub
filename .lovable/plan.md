
# Correção: Supressão Inteligente de Media Cards Irrelevantes

## Diagnóstico do Problema

A mensagem "Preciso saber como é o protocolo de limpeza da resina Vitality" tem 9 palavras, o que ativa `hasSubstantiveIntent = true` e envia todos os 3 primeiros resultados do RAG como cards — incluindo um vídeo de parâmetros da Anycubic que foi recuperado por proximidade semântica (o RAG trouxe tudo sobre a Vitality, inclusive parâmetros de impressão).

O filtro atual tem dois defeitos:

1. `hasSubstantiveIntent` (> 5 palavras) é muito permissivo — qualquer pergunta técnica dispara cards
2. Os cards não são filtrados pela relevância em relação à intenção da pergunta — um vídeo de parâmetros de impressora aparece numa pergunta sobre protocolo de limpeza

## Solução: 2 Camadas de Filtragem

### Camada 1 — Refinar o critério de exibição de cards

Substituir `hasSubstantiveIntent` por `userAskedForProtocolContent`:

```text
ANTES:  cards aparecem SE (pediu vídeo OR > 5 palavras)
DEPOIS: cards aparecem SE (pediu vídeo explicitamente OR perguntou sobre produto/resina sem contexto de protocolo)
```

Lógica nova:

```typescript
// Padrões que indicam pedido explícito de mídia
const VIDEO_REQUEST_PATTERNS = [
  /\bv[íi]deo[s]?\b|\bassistir\b|\bwatch\b|\btutorial[s]?\b|\bmostrar\b/i,
];

// Padrões que indicam intenção de PROTOCOLO — nestas perguntas, cards de parâmetros são irrelevantes
const PROTOCOL_INTENT_PATTERNS = [
  /\blimpeza\b|\blavar\b|\bcleaning\b|\blimpieza\b/i,
  /\bcura\b|\bcuring\b|\bcurado\b|\bpós[-\s]?cura\b/i,
  /\bprotocolo\b|\bprotocol\b|\bprocessamento\b|\bprocessing\b/i,
  /\bacabamento\b|\bpolimento\b|\bfinishing\b/i,
  /\bsecagem\b|\bdrying\b|\bsecar\b/i,
];

const userRequestedMedia = VIDEO_REQUEST_PATTERNS.some(p => p.test(message));
const isProtocolQuery = PROTOCOL_INTENT_PATTERNS.some(p => p.test(message));
```

### Camada 2 — Filtrar os cards por relevância de tipo

Quando os cards são exibidos, filtrar para excluir cards cujo título contenha palavras de parâmetros de impressora quando a intenção for de protocolo:

```typescript
// Palavras que sinalizam "este card é sobre parâmetros de impressora"
const PARAMETER_CARD_PATTERNS = [
  /\bpar[âa]metros?\b|\bsettings?\b|\bparametr/i,
  /\banycubic\b|\bphrozen\b|\belite[1i]x?\b|\bmiicraft\b|\bprusa\b|\bchitubox\b/i,
  /\blayer height\b|\bexposure\b|\blift speed\b/i,
];

const isParameterCard = (title: string) =>
  PARAMETER_CARD_PATTERNS.some(p => p.test(title));

const mediaCards = userRequestedMedia
  ? allResults
      .filter(r => meta.thumbnail_url || meta.url_publica || meta.url_interna)
      .filter(r => !isProtocolQuery || !isParameterCard((r.metadata as any).title ?? ''))
      .slice(0, 3)
      .map(...)
  : [];
```

**Resumo da lógica final:**

```text
┌────────────────────────────────────────────────────────────┐
│ Pediu vídeo explicitamente (vídeo/assistir/tutorial)?      │
│  → SIM: mostra cards (mas filtra cards de parâmetros       │
│         se a pergunta também é de protocolo)               │
│  → NÃO: não mostra cards                                  │
└────────────────────────────────────────────────────────────┘
```

Isso elimina o `hasSubstantiveIntent` que era a raiz do problema.

## Arquivo Modificado

| Arquivo | Linhas | Ação |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | 1196–1219 | Substituição cirúrgica da lógica de mediaCards |

## Tabela de Validação Pós-deploy

| Cenário | Comportamento esperado |
|---|---|
| "Preciso saber o protocolo de limpeza da Vitality" | Resposta técnica com protocolo — SEM card de parâmetros Anycubic |
| "Tem vídeo sobre protocolo de limpeza?" | Card do vídeo aparece (pediu explicitamente), card de parâmetros é filtrado |
| "Tem vídeo sobre NanoClean?" | Cards de vídeo aparecem normalmente |
| "Oi" | Saudação humanizada, sem cards |
| "Como calibrar a Anycubic Mono X?" | Sem cards (não pediu vídeo explicitamente) |
| "Quero ver um tutorial de cura UV" | Cards de vídeo aparecem — filtro respeita pedido explícito |

## Deploy

Automático após a edição. Nenhuma migração de banco necessária.
