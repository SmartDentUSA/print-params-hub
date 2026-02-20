
# Corrigir: L.I.A. presa no diálogo de parâmetros ignora perguntas gerais

## Diagnóstico do bug

**O que aconteceu:** O usuário perguntou "quem é o CEO da Smart Dent?" e recebeu a resposta de "marca não encontrada" com lista de marcas de impressoras.

**Causa raiz:** A tabela `agent_sessions` armazenou `current_state: "brand_not_found"` de uma conversa anterior sobre parâmetros de impressão. Quando a nova pergunta chegou, a função `detectPrinterDialogState` (linha 467) verificou o estado da sessão **antes** de avaliar se a mensagem era uma pergunta geral — e interceptou a mensagem como se fosse uma resposta ao diálogo de parâmetros.

**Fluxo atual (bugado):**
```text
mensagem "quem é o CEO?" 
  → detectPrinterDialogState() 
  → session: brand_not_found 
  → trata como resposta de marca
  → "Smart Dent" não é marca cadastrada
  → retorna BRAND_NOT_FOUND com lista de impressoras ← ERRADO
```

**Fluxo correto (após correção):**
```text
mensagem "quem é o CEO?"
  → detectPrinterDialogState()
  → session: brand_not_found
  → NOVO: verifica se a mensagem é uma pergunta geral (isOffTopicFromDialog)
  → detecta palavras como "CEO", "quem", "fundador", "empresa"
  → reset da sessão → estado: not_in_dialog
  → mensagem vai para o RAG normalmente ← CORRETO
```

## A solução: detecção de "saída de contexto" (intent break)

### Arquivo: `supabase/functions/dra-lia/index.ts`

**1. Nova função `isOffTopicFromDialog(message)`** — inserida antes de `detectPrinterDialogState`:

Identifica mensagens que claramente não são respostas ao diálogo de impressora. Um conjunto de padrões cobre:
- Perguntas sobre a empresa: "CEO", "fundador", "quem criou", "quem é o dono"
- Perguntas sobre produtos do catálogo: "impressora", "resina", "scanner" (quando não é continuação do diálogo)
- Perguntas gerais de odontologia: "protocolo", "como usar", "qual a diferença"
- Comandos de saída: "cancelar", "esquece", "outra pergunta", "mudando de assunto"
- Palavras interrogativas que indicam pergunta nova: frases com "quem", "o que é", "como funciona" de 5+ palavras

```typescript
const DIALOG_BREAK_PATTERNS = [
  // Perguntas sobre a empresa
  /\b(CEO|fundador|dono|sócio|diretor|quem (criou|fundou|é o))\b/i,
  // Comandos de reset
  /\b(cancelar|esquece|esqueça|outra (pergunta|coisa)|muda(ndo)? de assunto|não (quero|preciso) mais|sair)\b/i,
  // Perguntas gerais de produto (não dentro do diálogo)
  /^(o que (é|são)|qual (é|a diferença)|como (funciona|usar|se usa)|me fala sobre|me explica)/i,
  // Perguntas sobre empresa/identidade
  /\b(smartdent|smart dent|empresa|história|fundação|parcerias|contato|endereço|horário)\b/i,
  // Perguntas sobre categorias de produto (não é especificação de modelo)
  /^(quais|vocês (têm|vendem|trabalham)|tem (algum|impressora|scanner|resina))/i,
];

function isOffTopicFromDialog(message: string): boolean {
  return DIALOG_BREAK_PATTERNS.some((p) => p.test(message.trim()));
}
```

**2. Modificar `detectPrinterDialogState`** — inserir verificação no início dos estados `brand_not_found` e `needs_brand`:

No início dos blocos que verificam sessão ativa (linhas 467–610), adicionar:
```typescript
// Se sessão ativa, mas mensagem é claramente off-topic → reset e retorna not_in_dialog
if (
  (currentState === "brand_not_found" || 
   currentState === "needs_brand" ||
   currentState === "needs_model" ||
   currentState === "model_not_found" ||
   currentState === "needs_resin") &&
  isOffTopicFromDialog(message)
) {
  // Reset silencioso da sessão
  await persistState("idle", {});
  return { state: "not_in_dialog" };
}
```

Essa verificação ocorre **antes** das tentativas de `findBrandInMessage`, `findModelInList` etc.

**3. Também proteger o fallback de regex (linhas 526–603)** — os blocos `liaAskedBrand`, `liaAskedModel`, `liaAskedResin` que operam sobre o histórico de mensagens também precisam do guard:

```typescript
if (liaAskedBrand && !isOffTopicFromDialog(message)) { ... }
if (liaAskedModel && !isOffTopicFromDialog(message)) { ... }
if (liaAskedResin && !isOffTopicFromDialog(message)) { ... }
```

## Por que essa abordagem é robusta

A função `isOffTopicFromDialog` é intencional e conservadora: só faz break em padrões que **nunca** seriam respostas válidas ao diálogo de impressoras. Por exemplo:
- "CEO" — nunca é nome de marca
- "quais impressoras vocês têm" — inicia novo contexto, não responde a "qual a sua marca?"
- "cancelar" — sinal explícito do usuário

Palavras ambíguas como "RayShape", "Phrozen", "Anycubic" **não** estão nos padrões de break — elas continuam sendo tratadas como respostas de marca normalmente.

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/dra-lia/index.ts` | + constante `DIALOG_BREAK_PATTERNS` + função `isOffTopicFromDialog()` + guarda de intent-break no início dos estados ativos de `detectPrinterDialogState` + guarda nos blocos de fallback regex |

Nenhuma migração SQL. Deploy automático após a edição.

## Resultado esperado

| Cenário | Antes | Depois |
|---|---|---|
| "quem é o CEO?" (sessão em brand_not_found) | Resposta errada sobre marcas de impressoras | Sessão reseta, vai para RAG, responde "Marcelo Del Guerra, fundado em 2009" |
| "como funciona o processo de impressão?" (em brand_not_found) | Trata como marca → erro | Reset + resposta sobre impressão via RAG |
| "Anycubic" (em needs_brand) | Detecta marca corretamente | Continua funcionando igual — sem regressão |
| "cancelar" (em qualquer estado do diálogo) | Continua no diálogo | Reset, pergunta vai para RAG ou fallback |
