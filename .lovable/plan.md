
# Corrigir: "Quero comprar um RayShape" interceptado como resposta de marca

## Diagnóstico preciso do bug atual

A mensagem `"Quero comprr um RayShape o que ela tem de tão especial?"` **passa pelo intent-break guard** porque nenhum dos 5 padrões em `DIALOG_BREAK_PATTERNS` a captura. Depois disso, ela entra no **bloco de fallback regex** (linha 588):

```
if (liaAskedBrand && !isOffTopicFromDialog(message)) {
  const brand = await findBrandInMessage(allBrands, message)
  → encontra "RayShape" na lista de marcas
  → retorna state: "brand_not_found" (porque RayShape não está na tabela de IMPRESSORAS)
  → "Não encontrei a marca Quero comprr um RayShape..."
```

O `liaAskedBrand` fica verdadeiro porque a última mensagem da L.I.A. continha "qual marca" — residual da conversa anterior sobre parâmetros. O guard `isOffTopicFromDialog` não bloqueia porque **intenção de compra não está nos padrões**.

### Por que o guard de sessão (linha 484) não ajudou

O guard de sessão foi adicionado corretamente, mas ele só atua quando `currentState` é um dos estados ativos (`brand_not_found`, `needs_brand` etc.). Neste caso, **o currentState era `idle`** — o fallback de regex operou sem proteção.

## Solução: 2 adições cirúrgicas

### 1. Expandir `DIALOG_BREAK_PATTERNS` com padrões de intenção de compra e curiosidade de produto

Adicionar 3 novos padrões ao array existente (linhas 407-418):

**Padrão A — Intenção de compra/aquisição:**
```typescript
/\b(quero (comprar|adquirir|ver|conhecer|saber (mais )?sobre)|tenho interesse|como (comprar|adquirir)|onde (comprar|encontrar))\b/i,
```
Captura: "quero comprar", "quero ver", "quero conhecer", "quero saber sobre", "tenho interesse", "como comprar", "onde encontrar"

**Padrão B — Perguntas sobre característica de produto ("o que tem de especial", "quais as vantagens"):**
```typescript
/\b(o que (tem|há|ela tem|ele tem) de|quais (são |as )?(vantagens|benefícios|diferenciais|características|recursos)|para que serve|é indicad[ao] para)\b/i,
```
Captura: "o que tem de especial", "o que ela tem de", "quais as vantagens", "quais os diferenciais", "para que serve", "é indicada para"

**Padrão C — Perguntas sobre produto específico com artigo ("sobre a RayShape", "sobre o scanner"):**
```typescript
/\b(sobre (a|o|as|os) [A-ZÀ-Ÿa-zà-ÿ]|fala(r)? (mais |um pouco )?sobre|quero saber sobre|me conta sobre)\b/i,
```
Captura: "sobre a RayShape", "sobre o scanner", "falar sobre", "me conta sobre"

### 2. Adicionar guard idêntico ao fallback `liaAskedBrand` para o caso `idle`

O problema raiz é que o fallback de regex (linhas 551-599) pode ativar mesmo quando `currentState === "idle"` se a última mensagem da L.I.A. continha palavras como "marca" e "qual". Adicionar uma verificação adicional antes de todo o bloco de fallback:

```typescript
// ── Fallback regex: só ativa se último estado era de diálogo ──
// Se sessão está idle e mensagem é off-topic, não usar fallback
if (currentState === "idle" && isOffTopicFromDialog(message)) {
  return { state: "not_in_dialog" };
}
```

Essa verificação vai logo antes da linha 552 (`const lastAssistantMsg = ...`), garantindo que perguntas gerais nunca entrem no bloco de fallback.

## Arquivo modificado: `supabase/functions/dra-lia/index.ts`

### Mudança 1 — Expandir `DIALOG_BREAK_PATTERNS` (linhas 407-418)

```typescript
const DIALOG_BREAK_PATTERNS = [
  // Perguntas sobre a empresa / pessoas
  /\b(CEO|fundador|dono|sócio|diretor|quem (criou|fundou|é o))\b/i,
  // Comandos de reset explícitos
  /\b(cancelar|esquece|esqueça|outra (pergunta|coisa)|muda(ndo)? de assunto|não (quero|preciso) mais|sair)\b/i,
  // Perguntas gerais iniciando com "o que é", "como funciona", etc.
  /^(o que (é|são)|qual (é|a diferença)|como (funciona|usar|se usa)|me fala sobre|me explica)/i,
  // Referências à empresa / identidade SmartDent
  /\b(smartdent|smart dent|empresa|história|fundação|parcerias|contato|endereço|horário)\b/i,
  // Perguntas sobre categorias de produto que iniciam novo contexto
  /^(quais|vocês (têm|vendem|trabalham)|tem (algum|impressora|scanner|resina))/i,

  // ── NOVOS (cobertura de intenção de compra e curiosidade de produto) ──

  // Intenção de compra / interesse em produto
  /\b(quero (comprar|adquirir|ver|conhecer|saber (mais )?sobre)|tenho interesse|como (comprar|adquirir)|onde (comprar|encontrar))\b/i,
  // Perguntas sobre características do produto
  /\b(o que (tem|há|ela tem|ele tem) de|quais (são |as )?(vantagens|benefícios|diferenciais|características|recursos)|para que serve|é indicad[ao] para)\b/i,
  // "sobre a X", "me conta sobre", "fala mais sobre"
  /\b(fala(r)?(?: mais| um pouco)? sobre|me conta(r)? (mais )?sobre|quero saber (mais )?sobre)\b/i,
];
```

### Mudança 2 — Guard no início do bloco de fallback (antes da linha 552)

```typescript
// ── Fallback guard: se sessão idle e mensagem claramente off-topic → não inferir diálogo do histórico ──
if (currentState === "idle" && isOffTopicFromDialog(message)) {
  return { state: "not_in_dialog" };
}

// ── Fallback: regex on last assistant message (resilience for legacy sessions) ──
const lastAssistantMsg = ...
```

## Tabela de resultado esperado

| Mensagem | Estado sessão | Antes | Depois |
|---|---|---|---|
| "Quero comprar um RayShape" | idle | Brand not found (RayShape) | RAG responde sobre o produto |
| "O que ela tem de especial?" | idle | Brand not found | RAG responde sobre diferenciais |
| "Quero saber mais sobre a Edge Mini" | idle | Possível erro | RAG responde |
| "Phrozen" (respondendo à pergunta de marca) | needs_brand | Detecta marca ✅ | Continua funcionando ✅ |
| "quero comprar uma Phrozen" | needs_brand | Detecta Phrozen como marca ✅ | **REGRESSÃO?** NÃO — o guard de sessão da linha 484 não checa isOffTopicFromDialog para state=needs_brand neste caminho... na verdade SIM, o guard na linha 484 ativa primeiro e reseta. Mas queremos que "quero comprar Phrozen" enquanto em needs_brand CONTINUE detectando Phrozen como marca... |

### Atenção — caso ambíguo: "quero comprar Phrozen" enquanto em `needs_brand`

Se o usuário está no meio do diálogo (`needs_brand`) e digita "quero comprar uma Phrozen", o guard de sessão (linha 484) vai ativar `isOffTopicFromDialog` e resetar. Isso é **correto** — a L.I.A. vai ir ao RAG e mostrar info sobre a Phrozen, que é mais útil do que entrar no fluxo de parâmetros. O diálogo de parâmetros é iniciado explicitamente pela L.I.A., não pelo usuário.

## Arquivos modificados

| Arquivo | Mudanças |
|---|---|
| `supabase/functions/dra-lia/index.ts` | + 3 novos padrões em `DIALOG_BREAK_PATTERNS` + guard no início do bloco de fallback de regex |

Nenhuma migração SQL. Deploy automático. 2 edições pontuais no mesmo arquivo.
