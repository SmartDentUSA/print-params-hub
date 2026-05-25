## Diagnóstico

A lead **marcy** (`subscriber 695289048`) ficou no card com email sintético `mc_695289048@instagram.lead` porque, quando ela respondeu no Instagram com o e-mail real `marcelaalbuquerque.ma88@gmail.com`, o `UPDATE` no `lia_attendances` falhou com:

```
duplicate key value violates unique constraint "lia_attendances_email_ci_key"
```

Já existia o lead canônico **Marcela Albiquerque** (`b7d20a3e-1a10-4147-81bb-191e4c4507c0`, criado em 2026-05-13 via PipeRun, mesmo telefone `+5516992445679`, com `piperun_id=59752994`).

O bridge hoje apenas loga `manychat_email_update_conflict` e **mantém o sintético no card**, criando uma duplicata órfã. Pior: o handoff posterior dispararia `smart-ops-ingest-lead` apontando para a duplicata, não para o lead canônico já existente no PipeRun.

## Correção

Tratar conflito de e-mail (e, por simetria, conflito de telefone) como **sinal de identidade** e fazer **merge no canônico** em vez de descartar o dado.

### Mudança única em `supabase/functions/manychat-lia-bridge/index.ts`

Criar helper `mergeIntoCanonical(supabase, manychatLead, identifier)` que:

1. Busca o lead canônico dono do e-mail/telefone (`WHERE email ILIKE ? AND merged_into IS NULL` ou `WHERE telefone_normalized = ? AND merged_into IS NULL`), preferindo o mais antigo com `piperun_id` preenchido.
2. Se encontrar e for diferente do lead atual do ManyChat:
   - Copia `manychat_subscriber_id`, `manychat_collected_at`, `instagram`, e quaisquer campos novos (`area_atuacao`, `especialidade`, `produto_interesse_auto/raw`, `telefone_normalized/raw`) para o canônico (UPDATE só onde estiver NULL — Smart Merge / append-only).
   - Marca o lead duplicado: `merged_into = canonical.id`, `manychat_subscriber_id = NULL` (libera o índice único, se houver), `updated_at = now()`.
   - Retorna o lead canônico atualizado para o restante do fluxo usar.
3. Loga `manychat_merged_into_canonical` com `from_lead_id`, `to_lead_id`, `matched_by`.

Aplicar o helper em três pontos:

**a) Após capturar e-mail válido** (linha ~398):
- Tenta `UPDATE email=?`.
- Se erro `lia_attendances_email_ci_key` → chama `mergeIntoCanonical` por email; substitui `lead` local pelo canônico e continua o fluxo (próximas perguntas, handoff) já gravando no canônico.

**b) Após capturar telefone normalizado** (linha ~429):
- Mesmo padrão: se `UPDATE telefone_normalized=?` falhar por unique (`lia_attendances_telefone_normalized_key` ou similar) → `mergeIntoCanonical` por telefone.
- Também: mesmo sem erro de UPDATE, antes de gravar, verificar se já existe canônico com esse telefone e merge se sim (telefone é identificador forte, evita criar duplicatas silenciosas como aconteceu com marcy).

**c) Em `findOrCreateLead` permanece igual** — a deduplicação só faz sentido depois que temos email ou telefone real; o lookup inicial continua por `manychat_subscriber_id`.

### Backfill manual (uma vez)

Após deploy, executar via migration uma vez para corrigir a marcy:

```sql
UPDATE lia_attendances SET
  manychat_subscriber_id = '695289048',
  manychat_collected_at = (SELECT manychat_collected_at FROM lia_attendances WHERE id='00d0f892-c2bc-48f2-8355-035a4dd12719'),
  area_atuacao = COALESCE(area_atuacao, 'CLÍNICA OU CONSULTÓRIO'),
  especialidade = COALESCE(especialidade, 'ENDODONTISTA'),
  produto_interesse_auto = COALESCE(produto_interesse_auto, 'impressora_3d'),
  produto_interesse_raw  = COALESCE(produto_interesse_raw, 'impressora_3d | RayShape Edge Mini'),
  instagram = COALESCE(instagram, 'marcy')
WHERE id = 'b7d20a3e-1a10-4147-81bb-191e4c4507c0';

UPDATE lia_attendances SET
  merged_into = 'b7d20a3e-1a10-4147-81bb-191e4c4507c0',
  manychat_subscriber_id = NULL
WHERE id = '00d0f892-c2bc-48f2-8355-035a4dd12719';
```

## Validação

1. Repetir simulação: subscriber novo + email já existente no CDP → bridge deve marcar duplicata como `merged_into` e atualizar canônico com `manychat_subscriber_id` e campos novos.
2. Log `manychat_merged_into_canonical` presente.
3. Card do lead canônico (Marcela) passa a mostrar timeline ManyChat, produto, área, especialidade — sem perder histórico PipeRun.
4. Handoff (`smart-ops-ingest-lead`) dispara com `lia_attendance_id` = canônico, evitando criar Person/Deal duplicados no PipeRun.

## Não muda

- Fluxo de qualificação, formato das mensagens, idempotência do handoff.
- `smart-ops-ingest-lead` (já trata `lia_attendance_id` como força-merge).
- Schema do banco (apenas usa `merged_into` que já existe).