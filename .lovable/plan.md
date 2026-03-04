

# Plano: Corrigir `astron-postback` para passar na validacao da Astron

## Problema

A Astron faz uma requisicao de validacao para verificar se a URL retorna status 200 antes de salvar o postback. Dois problemas detectados nos logs:

1. **A Astron provavelmente envia um GET de validacao** — a function rejeita com 405 (Method Not Allowed)
2. **A Astron pode enviar body como `application/x-www-form-urlencoded`** (ex: `key=value`) — o `req.json()` falha com `"Unexpected token 'k', "key=value" is not valid JSON"`

## Correcao

No `supabase/functions/astron-postback/index.ts`:

1. **Aceitar GET** com resposta `200 OK` simples (para validacao da plataforma):
```typescript
if (req.method === "GET") {
  return new Response(
    JSON.stringify({ status: "ok", service: "astron-postback" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

2. **Tratar body nao-JSON** com fallback para `URLSearchParams` ou texto raw:
```typescript
let body: Record<string, any>;
const contentType = req.headers.get("content-type") || "";

if (contentType.includes("application/json")) {
  body = await req.json();
} else if (contentType.includes("form-urlencoded")) {
  const text = await req.text();
  body = Object.fromEntries(new URLSearchParams(text));
} else {
  // Tentar JSON, fallback para texto
  const text = await req.text();
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
}
```

Resto da logica permanece identico. Apenas essas 2 alteracoes no inicio do handler.

