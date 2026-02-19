
## Diagnóstico: AI Gateway Error 500 na Dra. L.I.A.

### Causa Raiz Identificada

O erro ocorre na linha 1305 do `dra-lia/index.ts`:

```typescript
throw new Error(`AI gateway error: ${aiResponse.status}`);
```

O gateway `https://ai.gateway.lovable.dev/v1/chat/completions` está retornando HTTP 500 ao usar o modelo `google/gemini-3-flash-preview`. Os logs confirmam que o erro é contínuo e consistente — não é um problema pontual.

Há dois fatores contribuindo:

1. **O modelo `google/gemini-3-flash-preview` pode estar instável** — é um modelo em preview, sujeito a indisponibilidades temporárias.
2. **Não há fallback** — quando o gateway retorna 500, o código só lança um erro. O `GOOGLE_AI_KEY` está configurado nos secrets mas nunca é usado.

---

### Solução: Fallback para `google/gemini-2.5-flash` + Retry Automático

**Arquivo: `supabase/functions/dra-lia/index.ts`**

**Mudança 1 — Trocar o modelo primário:**

```typescript
// Antes (instável):
model: "google/gemini-3-flash-preview",

// Depois (estável, produção):
model: "google/gemini-2.5-flash",
```

O `google/gemini-2.5-flash` é o modelo de produção estável equivalente ao flash-preview. Capacidade equivalente, sem riscos de instabilidade de preview.

**Mudança 2 — Adicionar lógica de retry com fallback:**

Quando o gateway retorna 500, em vez de lançar erro imediatamente, tentar automaticamente com o modelo de fallback `google/gemini-2.5-flash-lite` (mais leve, mais estável):

```typescript
async function callAI(messages, model = "google/gemini-2.5-flash") {
  const response = await fetch(CHAT_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 1024 }),
  });
  
  // Se 500 e ainda no modelo primário → retry com fallback
  if (!response.ok && response.status === 500 && model === "google/gemini-2.5-flash") {
    return callAI(messages, "google/gemini-2.5-flash-lite");
  }
  return response;
}
```

**Mudança 3 — Melhorar a mensagem de erro para o usuário:**

Em vez de retornar o erro técnico genérico, quando 500 persistir após retry, exibir uma mensagem amigável no chat:

```typescript
// Ao invés de throw Error("AI gateway error: 500")
return new Response(
  JSON.stringify({ error: "Estou com uma instabilidade temporária. Tente novamente em alguns instantes. 🙏" }),
  { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

E no frontend (`DraLIA.tsx`), exibir essa mensagem amigável no balão de resposta da LIA em vez de uma mensagem de erro técnico.

---

### Resumo das Alterações

| Arquivo | Mudança |
|---|---|
| `supabase/functions/dra-lia/index.ts` | Trocar modelo de `google/gemini-3-flash-preview` para `google/gemini-2.5-flash` (estável) |
| `supabase/functions/dra-lia/index.ts` | Adicionar retry automático com `google/gemini-2.5-flash-lite` quando 500 |
| `supabase/functions/dra-lia/index.ts` | Retornar mensagem amigável ao usuário em vez de erro técnico |

Nenhuma migração de banco. Deploy automático após as mudanças.
