
# Correção: Botões 👍/👎 não aparecem no widget da Dra. L.I.A.

## Causa Raiz Identificada

A tabela `agent_interactions` está **completamente vazia** — nenhuma conversa foi salva. O INSERT está falhando silenciosamente no bloco `try/catch` da edge function.

O problema está na linha 370 do `supabase/functions/dra-lia/index.ts`:

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

A edge function usa a **anon key** para fazer operações de banco de dados server-side. O INSERT em `agent_interactions` tem política pública (WITH CHECK: true), mas o **UPDATE** posterior (para salvar `agent_response` após o stream) está restrito apenas a admins pela política "Admins can manage agent_interactions". Isso faz o UPDATE falhar — e como ambas as operações usam o mesmo cliente, o INSERT também pode estar sendo bloqueado por alguma restrição de RLS.

Além disso, mesmo se o INSERT funcionasse, o fluxo atual **insere no banco antes de iniciar o stream**, o que pode causar um race condition onde `interactionId` ainda é `undefined` quando o primeiro chunk `meta` é enviado.

## Por que os botões somem

No frontend (`DraLIA.tsx`, linha 400):
```tsx
msg.interactionId &&  // ← undefined = botões invisíveis
```

Se `interactionId` for `undefined` (INSERT falhou), os botões 👍/👎 nunca aparecem.

## Solução

**Arquivo único modificado:** `supabase/functions/dra-lia/index.ts`

### Mudança 1 — Usar `SUPABASE_SERVICE_ROLE_KEY` no cliente da edge function

```typescript
// Antes:
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// ...
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Depois:
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// ...
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

Isso é correto e seguro: edge functions rodam server-side, a service role key nunca é exposta ao cliente. Com ela, o INSERT e o UPDATE em `agent_interactions` funcionam sem restrições de RLS.

### Mudança 2 — Adicionar log de erro no catch do INSERT

Para facilitar diagnóstico futuro, adicionar `console.error` no bloco que hoje falha silenciosamente:

```typescript
} catch (e) {
  console.error("Failed to insert agent_interaction:", e);
  // stream continues regardless
}
```

### Mudança 3 — Após deploy, re-testar que `interactionId` chega ao frontend

O chunk `meta` já é enviado corretamente com `interaction_id` quando o INSERT funciona. Com a service role key, o fluxo será:

1. INSERT → obtém `interactionId` ✓
2. Chunk `meta` enviado com `{ interaction_id: "uuid", type: "meta", media_cards: [...] }` ✓
3. Frontend recebe → `msg.interactionId` definido ✓
4. Botões 👍/👎 aparecem ✓
5. UPDATE com `agent_response` após stream completo ✓

## Arquivo Modificado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/dra-lia/index.ts` | Trocar `SUPABASE_ANON_KEY` por `SUPABASE_SERVICE_ROLE_KEY` no `createClient` + log de erro no catch |

## Seção Técnica

- O secret `SUPABASE_SERVICE_ROLE_KEY` já está configurado no projeto (confirmado nos secrets do Supabase).
- Edge functions do Supabase são server-side e é prática recomendada usar a service role key para operações de banco de dados, pois as funções já têm controle de acesso próprio (verificação de origem, CORS, etc.).
- Não há mudanças no banco de dados. Não há mudanças no frontend. Deploy da edge function é necessário após a edição.
