## Diagnóstico

A mensagem `Falha no blast: Edge Function returned a non-2xx status code` é a **string genérica** do `supabase.functions.invoke()` — ela aparece **sempre** que a edge function `wa-group-blast` responde com qualquer status fora de 2xx, mesmo quando o corpo já traz o motivo real (ex.: `Nenhum grupo elegível (admin + enabled)`, `group_jids obrigatório`, erro de insert em `wa_campaigns`, etc.).

Confirmado em produção:
- A função está deployada e respondendo (testei `POST /wa-group-blast` → 400 com JSON `{ ok:false, error:"Nenhum grupo elegível (admin + enabled)" }`).
- Há 154 grupos elegíveis (`is_admin=true AND enabled=true`) de 504 — então, dependendo do que foi escolhido na publicação histórica, é totalmente possível que todos os JIDs selecionados caiam fora do filtro e a função devolva 400.
- Logs recentes da EF não mostram exceção — só boots/shutdowns. Ou seja, **não é crash**, é resposta 4xx/5xx legítima que o frontend está engolindo.

O problema operacional é que o usuário não consegue agir sem ver a causa real.

## Mudança proposta (frontend-only, escopo mínimo)

Arquivo: `src/components/smartops/wa-groups/WaGroupBlastModal.tsx` (função `handleSend`, ~linhas 116-138).

Trocar o tratamento de erro do `invoke` para extrair o corpo JSON quando o supabase-js devolver `FunctionsHttpError`:

```ts
const { data, error } = await supabase.functions.invoke("wa-group-blast", { body: {...} });

if (error) {
  // supabase-js esconde o body em error.context (Response). Lê pra mostrar o motivo real.
  let serverMsg = error.message;
  try {
    const ctx: any = (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      const j = await ctx.json();
      if (j?.error) serverMsg = j.error;
    } else if (ctx && typeof ctx.text === "function") {
      const t = await ctx.text();
      if (t) serverMsg = t;
    }
  } catch { /* mantém error.message */ }
  throw new Error(serverMsg);
}
if (!data?.ok) throw new Error(data?.error ?? "Falha desconhecida");
```

Sem mexer no `toast.error("Falha no blast: " + ...)` — ele continua igual; só passa a mostrar `Nenhum grupo elegível (admin + enabled)` ou o motivo verdadeiro, em vez do texto genérico.

## Fora de escopo

- **Não alterar a edge function** `wa-group-blast` nem nenhuma outra EF (sem mudança de contrato, sem redeploy).
- Não tocar nas EFs Instagram/Copa listadas como protegidas.
- Não alterar schema, RLS, migrations.

## Validação

1. Build passa.
2. Reabrir Central de Campanhas → Grupos WA → Publicação histórica → Configurar envio → Disparar com a mesma seleção que falhou. O toast vai mostrar o motivo real (provavelmente `Nenhum grupo elegível (admin + enabled)`, indicando que os grupos selecionados não estão marcados como admin+enabled — aí o usuário ajusta a seleção ou habilita o grupo).
3. Caso o motivo real seja outro (erro em insert, JID inválido, etc.), o toast também passa a expor — e aí decidimos a próxima ação com base no texto.
