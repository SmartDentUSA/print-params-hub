
# Correção: Tratamento Térmico Não Aciona searchProcessingInstructions

## Diagnóstico Raiz

### O que aconteceu
O usuário perguntou "COmo e com que eu faço o tratamento térmico?" e a L.I.A. respondeu com valores **inventados**: "80°C por 15 minutos". 

Os valores corretos no banco de dados são:
- Opção A – glicerina aquecida: **130–150 °C por 1 min**
- Opção B – forno elétrico a seco: **150 °C por 1 min**
- Opção C – soprador térmico: **60–170 °C, 30–60 s por face**

### Por que aconteceu — 2 bugs encadeados

**Bug 1: Palavra-chave "tratamento térmico" ausente de PROTOCOL_KEYWORDS**

```typescript
// PROTOCOL_KEYWORDS atual (linha 46-63):
const PROTOCOL_KEYWORDS = [
  /limpeza|lavagem|lavar|limpar/i,
  /\bcura\b|pós.cura|pos.cura|fotopolimerizar/i,
  /finaliz|acabamento|polimento|polir/i,
  /pré.process|pre.process|pós.process|pos.process|processamento|protocolo/i,
  /nanoclean|isopropílico|isopropilico|álcool|alcool/i,
  // ... EN/ES terms
];
// ❌ "tratamento térmico", "forno", "thermal" NÃO estão aqui
```

Resultado: `isProtocol = false` → `searchProcessingInstructions()` **nunca é chamado** para a query "tratamento térmico".

**Bug 2: searchProcessingInstructions não usa o histórico da conversa para identificar a resina**

```typescript
async function searchProcessingInstructions(supabase, message) {
  // Usa apenas a mensagem ATUAL para identificar resina
  const words = message.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  
  const scored = resins.map(r => {
    const text = `${r.name} ${r.manufacturer}`.toLowerCase();
    const score = words.filter(w => text.includes(w)).length;
    return { resin: r, score };
  });
  
  const matched = scored.filter(x => x.score > 0);
  // Se o usuário não mencionou "Vitality" na mensagem atual → score = 0 para tudo
  // matched.length === 0 → targets = scored (TODAS as resinas, não filtradas)
  const targets = matched.length > 0 ? matched : scored; // ← retorna qualquer resina
}
```

Quando o usuário pergunta "Como faço o tratamento térmico?" **sem mencionar "Vitality"** na última mensagem (porque já foi dito antes), a função retorna as 3 primeiras resinas da lista ordenada — sem garantia de que seja a Vitality. O LLM então recebe contexto errado ou incompleto e **fabrica** valores.

## Solução: 2 Correções Cirúrgicas

### Correção 1 — Adicionar "tratamento térmico" e similares aos PROTOCOL_KEYWORDS

```typescript
const PROTOCOL_KEYWORDS = [
  // PT (existentes)
  /limpeza|lavagem|lavar|limpar/i,
  /\bcura\b|pós.cura|pos.cura|fotopolimerizar/i,
  /finaliz|acabamento|polimento|polir/i,
  /pré.process|pre.process|pós.process|pos.process|processamento|protocolo/i,
  /nanoclean|isopropílico|isopropilico|álcool|alcool/i,
  // NOVO: termos de tratamento térmico
  /tratamento.{0,5}t[ée]rmico|t[ée]rmico|forno|glicerina|soprador|thermal/i,
  /temperatura|aquecimento|aquece|calor/i,
  // ... EN/ES terms existentes ...
  /\bpost.?process\b|heat.?treat|thermal.?treat/i, // EN
  /tratamiento.{0,5}t[ée]rmico|horno|temperatura/i, // ES
];
```

### Correção 2 — searchProcessingInstructions deve varrer o histórico para identificar a resina

Igual ao `searchParameterSets`, a função deve receber e usar o `history` para extrair qual resina foi mencionada:

```typescript
async function searchProcessingInstructions(
  supabase: ReturnType<typeof createClient>,
  message: string,
  history: Array<{ role: string; content: string }> = [] // ← NOVO parâmetro
) {
  // Combina histórico + mensagem atual para identificar a resina
  const recentHistory = history.slice(-8).map(h => h.content).join(' ');
  const combinedText = `${recentHistory} ${message}`.toLowerCase();
  
  // Usa combinedText em vez de apenas message para scorar resinas
  const words = combinedText.split(/\s+/).filter(w => w.length > 3);
  
  // ... resto da função igual, mas usando words do combinedText
}
```

E na chamada (linha 1070-1073), passar `history`:

```typescript
const [knowledgeResult, protocolResults, paramResults] = await Promise.all([
  searchKnowledge(supabase, message, lang),
  isProtocol ? searchProcessingInstructions(supabase, message, history) : Promise.resolve([]), // ← passa history
  searchParameterSets(supabase, message, history),
]);
```

### Correção 3 — Regra 11 do system prompt: incluir "tratamento térmico" explicitamente na ordem das etapas

A Regra 11 já menciona "Tratamento térmico (se houver)" mas o LLM precisa de uma instrução mais forte para não inventar valores quando o tema é tratamento térmico:

```
11. ... 5. Tratamento térmico (se houver) — ATENÇÃO: os dados de temperatura e tempo de tratamento 
térmico variam drasticamente entre resinas (ex: 130–150°C vs 150°C vs 60–170°C). 
NUNCA assuma valores padrão. Use EXCLUSIVAMENTE os valores da fonte PROCESSING_PROTOCOL.
```

## Tabela de Arquivos Modificados

| Arquivo | Seção | Ação |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | Linha 46–63 (PROTOCOL_KEYWORDS) | Adicionar padrões para "tratamento térmico", "forno", "glicerina", "thermal" |
| `supabase/functions/dra-lia/index.ts` | Linha 603 (searchProcessingInstructions) | Adicionar parâmetro `history` e usar `combinedText` para identificar a resina |
| `supabase/functions/dra-lia/index.ts` | Linha 1070–1073 (chamada Promise.all) | Passar `history` para `searchProcessingInstructions` |
| `supabase/functions/dra-lia/index.ts` | Linha 1200 (Regra 11 do system prompt) | Adicionar aviso explícito sobre não inventar valores de tratamento térmico |

## Tabela de Validação

| Cenário | Antes | Depois |
|---|---|---|
| "Como faço o tratamento térmico?" (após mencionar Vitality) | Inventa 80°C/15min | Retorna valores corretos da Vitality: 130–150°C/1min (glicerina) ou 150°C/1min (forno) |
| "Qual a temperatura do forno para a Vitality?" | isProtocol=false, sem contexto real | isProtocol=true, searchProcessingInstructions retorna dados corretos |
| "Protocolo de limpeza da Vitality" (fluxo existente) | Funciona | Comportamento mantido |
| "Pós-cura da Vitality" (fluxo existente) | Funciona | Comportamento mantido |
| "Como faço o acabamento?" (sem resina mencionada na msg atual) | Pode trazer resina errada | history usado → resina correta identificada pelo contexto da conversa |

## Impacto

- Nenhuma migração de banco de dados
- Nenhuma alteração na lógica de busca RAG
- Deploy automático após edição
- Elimina a alucinação de valores de temperatura/tempo inventados pelo LLM quando o contexto real estava disponível mas não era injetado
