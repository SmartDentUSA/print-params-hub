

## Plano: Acumular Historico de Resumos + Contador de Interacoes

### Problema Atual

O `summarize_session` sobrescreve `resumo_historico_ia` a cada sessao. Se o lead teve 10 sessoes, so o ultimo resumo sobrevive. Perde-se todo o historico de evolucao do lead (quando pesquisou, quando comparou, quando pediu proposta).

Alem disso, nao ha campo de contagem de interacoes/sessoes — informacao basica para scoring e priorizacao comercial.

### Solucao — 3 entregas

#### 1. Migracao: novos campos em `lia_attendances`

```sql
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS total_sessions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_messages integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS historico_resumos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ultima_sessao_at timestamptz;
```

- `total_sessions`: incrementado a cada `summarize_session`
- `total_messages`: total acumulado de mensagens do lead
- `historico_resumos`: array JSON com os ultimos N resumos, formato:
  ```json
  [
    { "data": "2026-02-25", "resumo": "ASSUNTOS: SmartGum cores | PENDENCIAS: nenhuma | INTERESSE: 2", "msgs": 8 },
    { "data": "2026-02-24", "resumo": "ASSUNTOS: ioConnect TruAbutment, Rayshape | PENDENCIAS: comparativo | INTERESSE: 2", "msgs": 5 }
  ]
  ```
- `ultima_sessao_at`: timestamp da ultima sessao (util para filtros de inatividade)

#### 2. Modificar `summarize_session` em `dra-lia/index.ts`

Antes de gerar o resumo:

1. Buscar o registro atual de `lia_attendances` (`resumo_historico_ia`, `historico_resumos`, `total_sessions`, `total_messages`)
2. Incluir o `resumo_historico_ia` anterior no prompt da IA para que o novo resumo faça merge inteligente
3. Apos gerar o resumo, fazer o upsert com:
   - `resumo_historico_ia` = novo resumo (merged)
   - `total_sessions` = anterior + 1
   - `total_messages` = anterior + count de interacoes desta sessao
   - `historico_resumos` = prepend do novo resumo no array (manter max 20 entradas, dropar as mais antigas)
   - `ultima_sessao_at` = now()
4. Aumentar `max_tokens` para 150 para acomodar o merge

Prompt atualizado:
```text
System: "Resuma esta conversa para continuidade. Se houver RESUMO ANTERIOR, incorpore temas relevantes que nao foram rediscutidos. Formato: 'ASSUNTOS: [...] | PENDENCIAS: [...] | INTERESSE: [1-3]'. Max 200 chars."
User: "RESUMO ANTERIOR: {resumo_existente ou 'Nenhum'}\n\nCONVERSA ATUAL:\n{convoText}"
```

#### 3. Resetar flag `dra_lia_summarized` no frontend

No `DraLIA.tsx`, dentro de `handleSend`, adicionar:
```typescript
sessionStorage.removeItem('dra_lia_summarized');
```

E no `visibilitychange`, so disparar se houver pelo menos 2 mensagens enviadas na sessao (evita trigger prematuro ao abrir e fechar a aba).

### Resumo de arquivos

| # | Arquivo | Acao |
|---|---------|------|
| 1 | Migracao SQL | Adicionar `total_sessions`, `total_messages`, `historico_resumos`, `ultima_sessao_at` em `lia_attendances` |
| 2 | `supabase/functions/dra-lia/index.ts` | Buscar historico anterior, merge no prompt, acumular contadores e array de resumos, resetar flag |
| 3 | `src/components/DraLIA.tsx` | Resetar `dra_lia_summarized` a cada mensagem; gate `visibilitychange` por msg count |

### Resultado esperado

- Cada sessao com a LIA incrementa `total_sessions` e `total_messages`
- O `resumo_historico_ia` sempre contem o contexto acumulado (merged)
- O `historico_resumos` guarda os ultimos 20 resumos individuais com data e contagem de mensagens — permitindo reconstruir a jornada completa do lead
- No painel SmartOps, sera possivel ordenar leads por numero de interacoes e ver a evolucao temporal

