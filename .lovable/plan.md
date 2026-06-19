## Diagnóstico

O erro "non-2xx" vem da função `event-generate-image` — provavelmente porque o bot Poe com slug exato `Ideogram-v3-Quality` não respondeu como esperado (slug errado, bot inacessível no plano, ou retorno sem URL de imagem). Os logs atuais não mostram nada porque a função não loga o erro real do Poe — só retorna 502 silenciosamente.

## Plano de correção em 2 partes

### 1. Trocar o slug do modelo para `Ideogram-v3`

`Ideogram-v3-Quality` nem sempre está disponível em todos os planos Poe. O bot **`Ideogram-v3`** (sem o sufixo) é o slug universal e cobre o mesmo modelo com qualidade altíssima. Vou trocar pra esse.

### 2. Adicionar log do erro real do Poe

Hoje, se o Poe retornar 400/403/404, a função devolve só `{error:"Poe falhou", details:...}` sem `console.error`. Vou adicionar:

```ts
if (!poeRes.ok) {
  console.error("[event-generate-image] Poe falhou:", poeRes.status, poeRes.error);
  ...
}
if (!imageUrl) {
  console.error("[event-generate-image] Sem URL na resposta:", poeRes.text?.slice(0, 800));
  ...
}
```

Assim, se ainda falhar, no próximo erro a gente vê exatamente o que o Poe respondeu (slug inválido, sem crédito, formato inesperado, etc.) e ajusta de forma cirúrgica.

## Arquivo afetado

- `supabase/functions/event-generate-image/index.ts` — trocar `"Ideogram-v3-Quality"` → `"Ideogram-v3"` e adicionar 2 `console.error`.

Nenhuma outra mudança. Frontend intacto.

## Confirmação

Topa que eu já aplique isso? Se depois do log a gente identificar que o slug certo é outro (`@Ideogram-v3`, `Ideogram`, etc.), eu corrijo na próxima rodada.