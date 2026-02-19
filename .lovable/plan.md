
# Correção: Lacunas de Conhecimento Não Estão Sendo Registradas

## Diagnóstico Confirmado — 3 Bugs Encadeados

### Bug 1: Sintaxe incorreta do `.onConflict?.()`

O código atual usa:
```typescript
await supabase
  .from("agent_knowledge_gaps")
  .insert({ question: message.slice(0, 500), lang })
  .onConflict?.("question");
```

O operador `?.` (optional chaining) faz com que `.onConflict` seja chamado **somente se existir** — e como no Supabase JS v2 `.insert()` retorna um `PostgrestBuilder` que tem o método `.upsert()` para conflitos (não `.onConflict` encadeado), a linha inteira falha silenciosamente. A tabela `agent_knowledge_gaps` permanece vazia.

**Solução:** Trocar para `.upsert()` com `onConflict` como opção:
```typescript
await supabase
  .from("agent_knowledge_gaps")
  .upsert(
    { question: message.slice(0, 500), lang, frequency: 1 },
    { onConflict: "question", ignoreDuplicates: false }
  );
```
Porém isso não incrementa `frequency`. Para incrementar, precisamos usar uma abordagem diferente (ver abaixo).

### Bug 2: `frequency` nunca é incrementado para perguntas repetidas

A tabela `agent_knowledge_gaps` tem a coluna `frequency integer DEFAULT 1` e um índice `UNIQUE` em `question`. O objetivo é incrementar `frequency` quando a mesma pergunta aparece novamente — mas o código atual nunca faz isso.

**Solução:** Usar `upsert` com RPC ou fazer select + insert/update:
```typescript
// Tenta inserir; se conflito, incrementa frequency
const { data: existing } = await supabase
  .from("agent_knowledge_gaps")
  .select("id, frequency")
  .eq("question", message.slice(0, 500))
  .maybeSingle();

if (existing) {
  await supabase
    .from("agent_knowledge_gaps")
    .update({ frequency: (existing.frequency ?? 1) + 1, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
} else {
  await supabase
    .from("agent_knowledge_gaps")
    .insert({ question: message.slice(0, 500), lang, frequency: 1 });
}
```

### Bug 3: Perguntas com resposta alucinada nunca são capturadas

O bloco de registro de lacunas só roda quando `!hasResults` — ou seja, quando o RAG não encontrou absolutamente nada. Mas quando o RAG retorna resultados de baixíssima similaridade (ex: 0.20–0.30) e o LLM alucina, a pergunta **não é registrada** como lacuna.

O banco de dados confirma: há 3 interações com `unanswered: true`, mas `agent_knowledge_gaps` está completamente vazia — o que prova que o bug 1 impediu todos os registros.

**Solução complementar:** Além do fix do `upsert`, registrar também gaps quando `topSimilarity < 0.35` (resposta incerta), marcando-os como `status: 'low_confidence'` para diferenciação:
```typescript
// Após o bloco !hasResults, também captura respostas de baixa confiança
if (topSimilarity < 0.35 && hasResults) {
  // Registra como gap de baixa confiança (o RAG respondeu mas sem convicção)
  await upsertKnowledgeGap(supabase, message, lang, "low_confidence");
}
```

## Arquivos Modificados

| Arquivo | Seção | Ação |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | Linha 1126–1130 | Substituir `.insert().onConflict?.()` por lógica select + insert/update com incremento de `frequency` |
| `supabase/functions/dra-lia/index.ts` | Após linha 1099 (`hasResults`) | Adicionar captura de gaps de baixa confiança quando `topSimilarity < 0.35` |

## Implementação: Função Helper `upsertKnowledgeGap`

Para evitar duplicação, extrair a lógica para uma função reutilizável:

```typescript
async function upsertKnowledgeGap(
  supabase: ReturnType<typeof createClient>,
  question: string,
  lang: string,
  status: "pending" | "low_confidence" = "pending"
) {
  try {
    const truncated = question.slice(0, 500);
    const { data: existing } = await supabase
      .from("agent_knowledge_gaps")
      .select("id, frequency")
      .eq("question", truncated)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("agent_knowledge_gaps")
        .update({ 
          frequency: (existing.frequency ?? 1) + 1, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("agent_knowledge_gaps")
        .insert({ question: truncated, lang, frequency: 1, status });
    }
  } catch (e) {
    console.error("[upsertKnowledgeGap] error:", e);
    // fail silently
  }
}
```

E os dois pontos de chamada:
```typescript
// Ponto 1: quando !hasResults (linha 1126)
await upsertKnowledgeGap(supabase, message, lang, "pending");

// Ponto 2: quando baixa confiança (após linha 1099)
if (!hasResults || topSimilarity < 0.35) {
  await upsertKnowledgeGap(supabase, message, lang, hasResults ? "low_confidence" : "pending");
}
```

## Tabela de Validação

| Cenário | Antes | Depois |
|---|---|---|
| Pergunta sem resposta no RAG | Gap não registrado (bug do `onConflict?.`) | Gap registrado com `status: pending` |
| Mesma pergunta sem resposta repetida | Nenhuma atualização | `frequency` incrementado corretamente |
| Pergunta com resposta de baixa similaridade (< 0.35) | Nunca registrada | Gap registrado com `status: low_confidence` |
| Painel "Top 10 Perguntas Sem Resposta" | Sempre vazio | Mostra gaps reais da base |
| Perguntas com boa resposta (similarity >= 0.65) | Não registradas | Não registradas (comportamento correto) |

## Impacto

- Nenhuma migração de banco de dados necessária (a tabela já existe com a estrutura correta)
- O campo `status` já aceita texto livre — `"low_confidence"` funciona sem alteração de schema
- Deploy automático da edge function após edição
- O painel `AdminDraLIAStats` já exibe os gaps corretamente — assim que os registros começarem a entrar, o painel exibirá os dados automaticamente
