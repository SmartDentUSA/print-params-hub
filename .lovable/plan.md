

## Bug: Suporte técnico re-entra no fluxo de chamado após ticket criado

### Diagnóstico

Quando o usuário pergunta "Quantos chamados técnicos eu tenho no meu cadastro?" após criar um ticket, a Dra. L.I.A. inicia um NOVO fluxo de chamado em vez de responder a pergunta.

**Causa raiz**: Linha 2903 do `dra-lia/index.ts`:
```
if (isSupportQuestion(message) || (topic_context === "support" && !supportFlowStage))
```

Após o ticket ser criado, o backend limpa `support_flow_stage` da sessão (L2827-2835). Porém o frontend continua enviando `topic_context: "support"` (armazenado em sessionStorage). Como `!supportFlowStage` agora é `true`, a condição re-entra no fluxo de criação de chamado.

### Correção (2 arquivos)

**1. `supabase/functions/dra-lia/index.ts` (L2827-2835)**

Ao limpar o support flow após ticket criado, adicionar flag `support_ticket_completed: true` nos entities da sessão. Ajustar a condição de entrada (L2903) para verificar essa flag:

```typescript
// Linha ~2903: NÃO re-entrar se ticket acabou de ser criado nesta sessão
const ticketJustCompleted = (sessionEntities as Record<string, unknown>)?.support_ticket_completed === true;

if (!ticketJustCompleted && (isSupportQuestion(message) || (topic_context === "support" && !supportFlowStage))) {
  // ... fluxo normal de suporte
}
```

Na seção de limpeza (L2828), adicionar:
```typescript
clearedEnt.support_ticket_completed = true;
```

Quando `isSupportQuestion(message)` detectar uma NOVA intenção real de suporte (ex: "minha impressora não liga"), resetar a flag para permitir novo chamado:
```typescript
if (isSupportQuestion(message) && ticketJustCompleted) {
  // Permitir novo chamado — limpar flag
  delete clearedEnt.support_ticket_completed;
}
```

**2. `supabase/functions/_shared/lia-guards.ts` (L19-37)**

Adicionar exclusão para perguntas informacionais sobre chamados. Antes de retornar `true`, verificar que a mensagem não é uma consulta:

```typescript
const SUPPORT_INFO_QUERY = /\b(quantos?|quais?|ver|listar|consultar|hist[oó]rico|status)\b.{0,20}\b(chamado|ticket|ocorr[eê]ncia)/i;

export const isSupportQuestion = (msg: string) => {
  if (SUPPORT_INFO_QUERY.test(msg)) return false;
  return SUPPORT_KEYWORDS.some((p) => p.test(msg));
};
```

### Resumo

| Arquivo | Mudança |
|---|---|
| `dra-lia/index.ts` | Flag `support_ticket_completed` na sessão; check antes de re-entrar no fluxo |
| `_shared/lia-guards.ts` | Exclusão de queries informacionais sobre chamados do `isSupportQuestion` |

Risco baixo. Não altera o fluxo de criação de chamado — apenas impede re-entrada indesejada.

