
# Dra. L.I.A. — Correção: Saudações e Controle de Relevância Mínima

## Diagnóstico Preciso

### Causa 1 — Saudações acionam o RAG desnecessariamente
Quando o usuário digita "Olá", a função `searchKnowledge` executa a busca full-text com o termo "Olá". O `search_knowledge_base` retorna conteúdo aleatório que contém palavras próximas, com `relevance = 0.0` ou muito baixo. O código atual passa esses resultados direto para o Gemini, que então "preenche" a resposta com o conteúdo do contexto.

### Causa 2 — `MIN_SIMILARITY` é zero para fulltext
Linha 203 do arquivo atual:
```
const MIN_SIMILARITY = method === "vector" ? 0.65 : 0.0;
```
Para busca fulltext, qualquer resultado passa — mesmo com relevância 0. Isso significa que um resultado de `search_knowledge_base` com relevância mínima chega ao Gemini como contexto "válido".

---

## Duas Correções a Aplicar

### Correção 1 — Detecção de Intenção (Intent Guard)

Antes de chamar `searchKnowledge`, verificar se a mensagem é uma saudação ou mensagem genérica sem intenção técnica. Se for, responder diretamente com boas-vindas sem acionar o RAG:

```typescript
// Saudações e mensagens genéricas — detectar antes de buscar
const GREETING_PATTERNS = [
  /^(olá|ola|oi|hey|hi|hola|hello|bom dia|boa tarde|boa noite|tudo bem|tudo bom|como vai|como estas|como está)\b/i,
  /^(good morning|good afternoon|good evening|how are you)\b/i,
  /^(buenos días|buenas tardes|buenas noches|hola|qué tal)\b/i,
];

const isGreeting = (msg: string) =>
  GREETING_PATTERNS.some((p) => p.test(msg.trim())) && msg.trim().split(" ").length <= 5;
```

Se for saudação, a edge function responde com uma mensagem de boas-vindas contextual no idioma correto, sem chamar o RAG nem o Gemini:

| Idioma | Resposta de Boas-Vindas |
|---|---|
| PT | "Olá! Sou a Dra. L.I.A., especialista em odontologia digital da SmartDent. Como posso ajudar você hoje? Pode me perguntar sobre resinas, impressoras, parâmetros de impressão ou vídeos técnicos." |
| EN | "Hello! I'm Dr. L.I.A., SmartDent's digital dentistry specialist. How can I help you today? Feel free to ask about resins, printers, print parameters or technical videos." |
| ES | "¡Hola! Soy la Dra. L.I.A., especialista en odontología digital de SmartDent. ¿En qué puedo ayudarte hoy? Puedes preguntarme sobre resinas, impresoras, parámetros de impresión o videos técnicos." |

### Correção 2 — Relevância Mínima para Full-Text Search

Aumentar o limiar mínimo para fulltext de `0.0` para `0.05`:

```typescript
// Antes:
const MIN_SIMILARITY = method === "vector" ? 0.65 : 0.0;

// Depois:
const MIN_SIMILARITY = method === "vector" ? 0.65 : 0.05;

// E usar isso para filtrar resultados de baixa relevância:
const filteredResults = results.filter(r => r.similarity >= MIN_SIMILARITY);
if (filteredResults.length === 0) { /* retorna fallback humano */ }
```

Isso evita que resultados de busca fulltext com relevância zero sejam enviados como contexto para o Gemini.

### Correção 3 — Nova Regra no System Prompt

Adicionar uma regra explícita para quando a mensagem não tem intenção técnica clara:

```
12. Se a mensagem do usuário for uma saudação ou não tiver intenção técnica clara,
    responda apenas cumprimentando e perguntando como pode ajudar — NÃO cite nenhum produto.
```

---

## Arquivo Modificado

Apenas `supabase/functions/dra-lia/index.ts`:

| Mudança | Localização | Descrição |
|---|---|---|
| `isGreeting()` + resposta direta | Após linha 200 (antes do `searchKnowledge`) | Detecta saudações e retorna resposta de boas-vindas sem RAG |
| `MIN_SIMILARITY` para fulltext | Linha 203 | Muda de `0.0` para `0.05` |
| Filtro de resultados baixos | Após linha 200 | Filtra resultados com similaridade abaixo do mínimo antes de montar contexto |
| Regra 12 no system prompt | Linha ~301 | Instrução explícita para não citar produtos em saudações |

---

## Comportamento Esperado

| Mensagem | Antes | Depois |
|---|---|---|
| "Olá" | Listava Smart Orto e produtos aleatórios | "Olá! Sou a Dra. L.I.A... Como posso ajudar?" |
| "Oi, tudo bem?" | Contexto desnecessário do RAG | Resposta de boas-vindas direta, sem RAG |
| "O Smart Orto é bom?" | Descreve o produto corretamente | Mesmo comportamento — busca é acionada normalmente |
| "Tem vídeo sobre resina?" | Listava múltiplos com descrições longas | Cita o mais relevante diretamente |

---

## Seção Técnica

O `isGreeting()` verifica duas condições simultaneamente: (1) a mensagem começa com um padrão de saudação e (2) tem no máximo 5 palavras — isso evita falsos positivos como "Olá, qual o tempo de exposição do NanoClean?" que deve acionar o RAG normalmente.

O deploy da edge function `dra-lia` é necessário após a edição para que as mudanças entrem em produção imediatamente.
