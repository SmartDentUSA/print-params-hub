## Objetivo

No modal de agendamento de treinamento (`EnrollmentModal`), permitir que o operador:
1. Busque por **PipeRun ID, Deal ID interno OU e-mail**;
2. Veja uma **lista de deals** quando houver mais de um (típico de B2B: mesma empresa com vários deals, ou pessoa com histórico);
3. Escolha o deal correto, mesmo quando o deal tem **apenas empresa**, **empresa + pessoa**, ou **apenas pessoa** (B2B/B2C).

## Mudanças

### 1. Backend — nova RPC `fn_search_deals_for_training`

Substitui (mantém a antiga como wrapper) e retorna **lista** de deals candidatos:

```text
input : p_query text  (ID numérico OU e-mail)
output: jsonb { found: bool, results: [ { lead_id, deal_id, piperun_id, deal_title,
                                          person_name, company_name, email,
                                          telefone_fmt, deal_type: 'b2b'|'b2c'|'b2b2c',
                                          status, value, updated_at } ] }
```

Estratégias de match (todas com `merged_into IS NULL`):
- Se input é **só dígitos** → busca por `piperun_id`, `deals.piperun_deal_id`, e `piperun_deals_history[*].deal_id` (comportamento atual, agora retornando todos os matches do histórico).
- Se input **contém `@`** → busca por `lia_attendances.email` (ILIKE), `piperun_emails_history`, e `deals` joined no lead pelo e-mail. Retorna **todos os deals abertos+ganhos** dos leads encontrados, ordenados por `updated_at DESC`, limite 50.

Classificação `deal_type` por linha:
- `b2b`  = tem `empresa_nome/cnpj` e **sem** `person_name`;
- `b2c`  = tem `person_name` e **sem** `empresa_nome`;
- `b2b2c`= tem ambos.

A RPC já existente `fn_get_deal_from_history(lead_id, deal_id)` continua sendo usada para carregar o payload completo do deal escolhido — sem alteração.

### 2. Hook `useDealSearch`

- Renomear `result` → `result` (single) + adicionar `results` (lista).
- Após busca, popular `results`. Se 1 resultado, auto-selecionar (mantém UX atual para ID exato). Se vários, deixar UI escolher e então chamar `fn_get_deal_from_history` para hidratar o `matched_deal`.
- Novo método `selectDeal(lead_id, deal_id)` que faz o fetch cirúrgico.

### 3. Frontend — `EnrollmentModal` Step 1

- Trocar input: aceita dígitos **OU** e-mail (remover `replace(/\D/g, '')`).
- Placeholder: `"PipeRun ID, Deal ID ou e-mail..."`.
- Quando `results.length > 1`, renderizar lista de cards compactos com:
  - Nome (pessoa ou empresa), badge `B2B`/`B2C`/`B2B2C`, deal_title, status, valor, updated_at;
  - Botão "Selecionar" por linha → chama `selectDeal` → avança step 2.
- Quando 1 resultado, fluxo atual (botão "Continuar").
- Step 2 e seguintes: garantir que campos `person_name`, `email`, `telefone_br` aceitem deals **só-empresa** vazios sem travar validação (manter já editáveis pelo operador).

## Detalhes técnicos

- A RPC é `SECURITY DEFINER`, search_path = public; segue padrão da `fn_search_deal_for_training`.
- Index não é estritamente necessário (já existem em `piperun_id` e `email`), mas adicionar `CREATE INDEX IF NOT EXISTS idx_lia_email_lower ON lia_attendances (lower(email)) WHERE merged_into IS NULL` para acelerar busca por e-mail.
- Cap de 50 resultados para evitar payload pesado.
- Nenhuma alteração em `EnrollmentSubmit`, validação, ou backend de criação da matrícula.

## Fora de escopo

- Mudanças no fluxo PipeRun webhook / ingest.
- Mudanças em outras telas (Kanban, Lead Card).
- Permitir busca por telefone (pode ser próximo passo se pedido).
