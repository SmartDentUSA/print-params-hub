## Problema

No `PromoSeqInspector` (dentro de `WaGroupFlowBuilder.tsx`) o select de "Produto (Sistema A)" fica travado em **Carregando...**.

Causa: o componente faz `fetch(... , { method: "POST", headers: { "Content-Type": "application/json" }, body: ... })` para `knowledge-export-full`. A função responde com `access-control-allow-methods: GET, OPTIONS` — então o preflight CORS do POST com `Content-Type: application/json` falha no browser e a promise nunca resolve (o `.catch` recebe o erro CORS silencioso e fica em loading; em alguns horários o backend também responde 520 ao POST). Via GET o endpoint funciona normalmente e devolve `products[]` (testado: 120 produtos).

## Plano

### 1. `src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx` — `PromoSeqInspector`

Trocar as duas chamadas (`useEffect` que lista produtos e `loadMessages`) por GET com query params, sem `Content-Type` (evita preflight):

```ts
fetch(
  "https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full?limit=500&include=products",
  { method: "GET" }
)
```

Manter o resto da lógica (map → slug/name, filtro/sort, `messages[node.bucket]`).

### 2. `supabase/functions/sequence-runner/index.ts` — `getProduct(slug)`

Mesma troca para consistência (edge → edge não tem CORS, mas o POST está retornando 520 esporadicamente):

```ts
const r = await fetch(`${KNOWLEDGE_URL}?limit=500&include=products`, { method: 'GET' });
```

Remove o body JSON.

### 3. Sem mudanças adicionais

Não mexer em UI, schema, runtime de envio, nem outros componentes. `SocialSequences.tsx` reusa o mesmo `PromoSeqInspector`, então a correção já cobre as duas telas (WA Groups e Sequências sociais).

## Fora de escopo

- Adicionar paginação ao endpoint.
- Cache compartilhado entre componentes (já existe `staleTime` curto via cache local do componente).
- Trocar para Supabase RPC direto.