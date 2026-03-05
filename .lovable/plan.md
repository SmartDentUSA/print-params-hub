

## Adicionar campo "Entrada no Sistema" para rastreabilidade de leads

### Problema

O `created_at` da tabela `lia_attendances` tem `DEFAULT now()` e representa quando o registro foi inserido no banco. Porem, quando leads sao sincronizados do PipeRun ou Loja Integrada, o `data_primeiro_contato` e `created_at` ficam com a mesma data (a data da sincronizacao), perdendo toda rastreabilidade de quando o lead realmente entrou no sistema versus quando ele foi criado no CRM externo.

Exemplo real: Nilson Aguiar — pedido de 27/04/2020, mas `created_at` e `1o Contato` mostram 05/03/2026 (data da sincronizacao).

### Solucao

**1. Migration — novo campo `entrada_sistema`**
- Adicionar coluna `entrada_sistema timestamptz NOT NULL DEFAULT now()` na `lia_attendances`
- Backfill: setar `entrada_sistema = created_at` para todos os registros existentes
- Esse campo NUNCA sera sobrescrito por nenhuma sincronizacao — e imutavel apos o INSERT

**2. Proteger o campo em todas as funcoes de ingestao**

Nos 4 pontos de entrada de leads:
- `smart-ops-ingest-lead` — no INSERT de novo lead, `entrada_sistema` sera preenchido automaticamente pelo DEFAULT. No UPDATE (lead existente), NAO incluir o campo no merge
- `smart-ops-ecommerce-webhook` — idem: no INSERT, DEFAULT preenche. No UPDATE, nunca tocar
- `smart-ops-piperun-webhook` — idem
- `smart-ops-sellflux-webhook` — idem
- Adicionar `"entrada_sistema"` na lista de `protectedFields` do smartMerge no `ingest-lead`

**3. Frontend — KanbanLeadDetail.tsx**

Na secao de datas (final do componente, linhas 526-527), reorganizar:
- Adicionar `Entrada no Sistema` como primeiro item, com destaque visual (emoji 🚪 e bold)
- Renomear "Criado" para "Criado (banco)" para clareza
- Manter "Atualizado" como esta

**4. Frontend — KanbanLeadCard.tsx**

Na linha 163, onde mostra a data no card, usar `entrada_sistema` como fallback primario em vez de `created_at`:
```
lead.piperun_created_at || lead.entrada_sistema || lead.created_at
```

**5. Types — atualizar o tipo Lead**

Adicionar `entrada_sistema: string` no interface Lead do KanbanLeadCard.tsx.

### Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| Migration SQL | Adicionar coluna + backfill |
| `src/integrations/supabase/types.ts` | Regenerar com novo campo |
| `src/components/smartops/KanbanLeadDetail.tsx` | Exibir "Entrada no Sistema" com destaque |
| `src/components/smartops/KanbanLeadCard.tsx` | Usar `entrada_sistema` no card + adicionar ao tipo Lead |
| `supabase/functions/smart-ops-ingest-lead/index.ts` | Adicionar a protectedFields |
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | Nao incluir no updateData |

### Resultado

O campo `entrada_sistema` sera a data imutavel de quando o lead foi registrado pela primeira vez no sistema, independente de datas historicas vindas do PipeRun, Loja Integrada ou qualquer outra fonte.

