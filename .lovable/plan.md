

## Diagnóstico

A LIA respondeu: *"Os dados que tenho **não especificam** as cores disponíveis do ATOS Block... também **não tenho informações** sobre o preço..."* — frase defensiva que o LLM continua usando apesar das regras 21-23 do system prompt.

**2 problemas identificados:**

1. **IDK_PATTERNS incompletos** — o LLM gera variações como "não especificam", "não tenho informações sobre", "não tenho detalhes", "quer que eu te conecte" que não são capturadas pelos patterns atuais
2. **System prompt insuficiente** — as regras 21-23 dizem "NUNCA diga X" mas o LLM ainda encontra sinônimos. Precisamos de uma lista explícita de frases proibidas e reforço mais forte

## Correções

### 1. Expandir IDK_PATTERNS (prioridade máxima)

Adicionar ~8 novos padrões para capturar as variações reais que o LLM produz:

```typescript
/não (especificam?|detalham?|listam?|mencionam?)/i,
/não tenho (informações|detalhes|dados) sobre/i,
/informação.*não está disponível/i,
/quer que eu te conect/i,
/ideal é falar (com|diretamente)/i,
/falar com (um de nossos|nosso) (especialistas?|consultores?)/i,
/I don'?t have (specific|detailed)/i,
/no (especifica|detalla|menciona)/i,
```

### 2. Reforçar system prompt regras 21-23

Adicionar lista explícita de **FRASES PROIBIDAS** dentro da regra 21:

```
FRASES PROIBIDAS (e sinônimos): "não especifica", "não detalha", "não lista", 
"não menciona", "não tenho detalhes", "ideal é falar com", "quer que eu te conecte".
Se perceber que vai usar qualquer dessas frases, PARE e use a versão proativa.
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dra-lia/index.ts` | +8 IDK_PATTERNS, reforço regras 21-23 |

Deploy: `dra-lia`

