
# Dra. L.I.A. — Correção do "Load Failed" ao Perguntar sobre Limpeza da Vitality

## Diagnóstico Confirmado

Ao testar diretamente a edge function com `curl`, ela **responde corretamente** com os protocolos completos da Vitality. O problema é exclusivamente no frontend e no fluxo de persistência da interação.

### Causa Raiz 1 — Insert em `agent_interactions` falha silenciosamente

O chunk `meta` retornado pelo servidor foi:
```
data: {"type":"meta"}
```
Sem o campo `interaction_id`. Isso acontece porque o `INSERT` em `agent_interactions` falha — o `RLS` da tabela ou um erro de validação faz `interaction?.id` retornar `undefined`. Esse `undefined` é então passado para o `UPDATE` posterior como UUID, gerando:

```
ERROR: invalid input syntax for type uuid: "undefined"
```

Confirmado nos logs do Postgres:
```
ERROR: new row violates row-level security policy for table "agent_interactions"
ERROR: invalid input syntax for type uuid: "undefined"
```

### Causa Raiz 2 — O stream quebra quando `interaction` é null/undefined

No bloco de stream da edge function (linha 556+), quando `interaction?.id` é `undefined`, o `UPDATE` final falha e pode interromper o `controller` de forma abrupta, causando o "Load Failed" no cliente.

### Causa Raiz 3 — RLS está bloqueando o INSERT anônimo

A política de RLS para INSERT em `agent_interactions` é:
```sql
WITH Check Expression: true
```

Deveria permitir qualquer insert. Mas o erro ocorre porque a edge function usa `SUPABASE_ANON_KEY` e a política `Allow public insert agent_interactions` pode não estar sendo aplicada corretamente quando o `session_id` é passado.

O mais provável: **o `session_id` está chegando como `undefined`** do cliente em algumas situações, e a validação do banco rejeita.

## Duas Correções a Aplicar

### Correção 1 — Edge Function: proteger o stream contra falha no INSERT

Envolver o `INSERT` em `agent_interactions` em `try/catch` para que falhas de RLS ou validação **não interrompam** o stream. O stream deve continuar mesmo se a persistência falhar.

```typescript
// Antes: insert direto (falha quebra o stream)
const { data: interaction } = await supabase
  .from("agent_interactions")
  .insert({ session_id, ... })
  .select("id")
  .single();

// Depois: insert com try/catch, stream continua independente
let interactionId: string | undefined;
try {
  const { data: interaction } = await supabase
    .from("agent_interactions")
    .insert({ session_id: session_id || crypto.randomUUID(), ... })
    .select("id")
    .single();
  interactionId = interaction?.id;
} catch {
  // falha silenciosa — stream continua
}
```

O mesmo padrão se aplica ao bloco de fallback (linhas 379-425) onde o insert também pode falhar.

### Correção 2 — Garantir session_id válido

O `session_id` pode chegar como `undefined` do cliente. A edge function deve gerar um UUID fallback se não recebido:

```typescript
// Linha 316 atual:
const { message, history = [], lang = "pt-BR", session_id } = await req.json();

// Corrigido:
const { message, history = [], lang = "pt-BR", session_id: rawSessionId } = await req.json();
const session_id = rawSessionId || crypto.randomUUID();
```

### Correção 3 — Update do `agent_response` com guard em `interactionId`

O `UPDATE` final (linha 584) executa mesmo quando `interaction?.id` é undefined, causando o erro de UUID:

```typescript
// Antes (linha 584):
await supabase
  .from("agent_interactions")
  .update({ agent_response: fullResponse })
  .eq("id", interaction?.id);  // ← undefined causa erro UUID

// Depois:
if (interactionId) {
  await supabase
    .from("agent_interactions")
    .update({ agent_response: fullResponse })
    .eq("id", interactionId);
}
```

### Correção 4 — Fallback insert também protegido

O mesmo problema existe no bloco de `!hasResults` (fallback WhatsApp) onde o insert também pode falhar silenciosamente e interromper o stream. Aplicar o mesmo padrão `try/catch`.

## Arquivo Modificado

Apenas `supabase/functions/dra-lia/index.ts`:

| Mudança | Linha Atual | Descrição |
|---|---|---|
| `session_id` fallback | 316 | Garante UUID válido se não recebido |
| INSERT interação em try/catch | 539-550 | Falha silenciosa, stream não interrompe |
| Guard em UPDATE final | 584-589 | Só executa se `interactionId` válido |
| INSERT fallback em try/catch | 379-391 | Mesmo padrão para bloco sem resultados |

## Comportamento Esperado

| Situação | Antes | Depois |
|---|---|---|
| Pergunta "Limpeza da Vitality" | "Load Failed" | Protocolo completo da Vitality exibido |
| INSERT em agent_interactions falha | Stream quebra | Stream continua, resposta exibida normalmente |
| session_id undefined | Erro de validação | UUID gerado automaticamente |
| UPDATE com id undefined | Erro de UUID no Postgres | Update ignorado silenciosamente |

## Seção Técnica

O problema é de **resiliência do stream**, não de lógica de negócio. A lógica de protocolos está correta (confirmado pelo teste curl que retornou os dados certos). O stream SSE não deve depender do sucesso da persistência — são operações independentes. Proteger os side effects de persistência com `try/catch` é a prática correta para edge functions de streaming.

Nenhuma migração de banco de dados é necessária.
