
## Problema: Modelos de Fallback Inválidos no Chain de Retry

### Diagnóstico Confirmado pelos Logs

```
ERROR AI gateway error: 400             ← openai/gpt-5-mini não existe no gateway
ERROR Flash-lite also failed with 500
ERROR Primary model failed with 500
```

O chain de fallback atual é:
1. `google/gemini-2.5-flash` → 500 (instabilidade do gateway)
2. `google/gemini-2.5-flash-lite` → 500 (instabilidade do gateway)
3. `openai/gpt-5-mini` → **400 GARANTIDO** (modelo não existe)
4. `openai/gpt-5-nano` → **400 GARANTIDO** (modelo não existe)
5. → 503 para o usuário

O problema é que `gpt-5-mini` e `gpt-5-nano` não são modelos reais disponíveis no gateway Lovable. Os modelos corretos são `openai/gpt-4o-mini` e `openai/gpt-4.1-mini`.

Evidência adicional: o teste direto realizado agora retornou **200 com sucesso** usando `google/gemini-2.5-flash`, o que confirma que os erros 500 são intermitentes — quando o Gemini falha, os fallbacks OpenAI deveriam assumir, mas estão com nomes errados.

---

### Solução: Corrigir os Nomes dos Modelos de Fallback

**Arquivo: `supabase/functions/dra-lia/index.ts`** — apenas as linhas do chain de fallback:

Mudar de:
```typescript
aiResponse = await callAI("openai/gpt-5-mini", true);
...
aiResponse = await callAI("openai/gpt-5-nano", true);
```

Para:
```typescript
aiResponse = await callAI("openai/gpt-4o-mini", true);
...
aiResponse = await callAI("openai/gpt-4.1-mini", true);
```

Também ajustar a condição de trigger dos fallbacks OpenAI para incluir qualquer status não-OK além de 429 (não apenas 500 e 400), tornando o chain mais robusto:

```typescript
// Fallback 1: flash-lite (apenas para 500)
if (!aiResponse.ok && aiResponse.status === 500) { ... }

// Fallback 2: gpt-4o-mini (para qualquer falha que não seja 429)
if (!aiResponse.ok && aiResponse.status !== 429) { ... }

// Fallback 3: gpt-4.1-mini (último recurso)
if (!aiResponse.ok && aiResponse.status !== 429) { ... }
```

---

### Resumo da Alteração

| Arquivo | Linha | Mudança |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | ~1326 | `openai/gpt-5-mini` → `openai/gpt-4o-mini` |
| `supabase/functions/dra-lia/index.ts` | ~1332 | `openai/gpt-5-nano` → `openai/gpt-4.1-mini` |
| `supabase/functions/dra-lia/index.ts` | ~1324, 1330 | Condição de fallback: `.status !== 429` em vez de `500 || 400` |

Deploy automático após as mudanças. Nenhuma migração de banco necessária.

---

### Nota sobre o Painel "Lacunas de Conhecimento Pendentes"

O card exibindo "4 Lacunas de Conhecimento Pendentes" no painel Admin é funcional — são perguntas reais que a LIA não soube responder registradas na tabela `agent_knowledge_gaps`. O link "ver em Visão Geral" que aparece no card está correto e navega para a aba correspondente. Isso não é um bug — é o sistema funcionando como esperado, identificando gaps de conteúdo para o time resolver.
