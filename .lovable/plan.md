

## Fluxo Mapeamento → portfolio_json do Lead

### Problema
Os campos de mapeamento do formulário (scanner, impressora, CAD, etc.) são salvos na tabela `smartops_form_field_responses` com o `workflow_cell_target`, mas **nada os converte em entradas na coluna `portfolio_json`** do lead. O `smart-ops-leads-api` já renderiza a camada "mapeamento" do Workflow 7×3 a partir de `portfolio_json`, mas essa camada fica sempre vazia.

### Solução

Criar um **trigger de banco** que, ao inserir uma resposta em `smartops_form_field_responses`, atualiza automaticamente o `portfolio_json` do lead correspondente com a camada `mapeamento`.

### Arquivos e Mudanças

#### 1. SQL Migration — Trigger `fn_sync_form_response_to_portfolio`

Criar uma função PL/pgSQL que:
- Dispara no `AFTER INSERT` em `smartops_form_field_responses`
- Converte o `workflow_cell_target` (ex: `3_impressao__impressora_3d`) em `stageKey` + `subcat` (ex: `etapa_3_impressao` / `impressora`)
- Faz `jsonb_set` no `portfolio_json` do lead, adicionando `{ "mapeamento": { "valor": "<value>", "status": "mapeado" } }` na célula correta
- Atualiza `portfolio_updated_at = now()`

Mapeamento de `workflow_cell_target` → `stageKey.subcat`:

```text
1_captura_digital__scanner_intraoral  → etapa_1_scanner.scanner_intraoral
2_cad__software                       → etapa_2_cad.software
3_impressao__impressora_3d            → etapa_3_impressao.impressora
(etc. — 25 células totais)
```

#### 2. Atualizar `smart-ops-ingest-lead/index.ts`

Após o `ingest-lead` retornar o `lead_id`, e o `PublicFormPage` gravar as `field_responses`, o trigger do banco cuidará do resto automaticamente. Nenhuma mudança necessária no edge function.

#### 3. Backfill — Processar respostas já existentes

Executar um UPDATE que leia todas as respostas em `smartops_form_field_responses` e popule o `portfolio_json` dos leads que já têm respostas mas `portfolio_json` não reflete os dados de mapeamento.

### Resultado
- Formulários de mapeamento preenchem automaticamente a 4ª camada (roxo) do Workflow 7×3
- O card do lead mostra imediatamente o que o lead possui (scanner, impressora, CAD, etc.)
- LIA e Copilot passam a ter visibilidade dos equipamentos mapeados via formulário

