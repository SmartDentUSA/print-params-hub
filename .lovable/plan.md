

## Plano: Popular Smart Ops Leads com conversas da LIA

### Problema atual

A lista de leads no Smart Ops consulta apenas a tabela `lia_attendances`, que tem apenas 1 registro de teste. Enquanto isso, a tabela `leads` tem **15 leads reais** vindos da Dra. LIA, com conversas ativas na `agent_interactions` (alguns com 200+ mensagens). Esses leads nao aparecem no Smart Ops.

### Abordagem

Duas frentes: (A) popular `lia_attendances` com os leads existentes via edge function de backfill, e (B) garantir que todo novo lead da LIA seja automaticamente inserido em `lia_attendances` ao ser criado (alem do `summarize_session` que ja faz upsert apos inatividade).

```text
ESTADO ATUAL                          ESTADO DESEJADO
───────────                           ───────────────
leads (15 registros dra-lia)          leads (15)
  ↓ NÃO conecta                        ↓ backfill + auto-sync
lia_attendances (1 teste)             lia_attendances (15+)
  ↓ consultada pelo SmartOps            ↓ Smart Ops mostra todos
SmartOps Leads = vazio                SmartOps Leads = populado com
                                        nome, email, resumo IA,
                                        qtd mensagens, última interação
```

### Implementacao

#### 1. Edge function `backfill-lia-leads` (nova, one-shot)

Busca todos os leads com `source = 'dra-lia'` da tabela `leads`, cruza com `agent_interactions` para pegar contagem de mensagens e data da ultima interacao, e faz upsert em `lia_attendances` para cada um:

- `nome`, `email`, `source: 'dra-lia'`
- `especialidade` (de `leads.specialty`)
- `data_primeiro_contato` (de `leads.created_at`)
- `lead_status: 'novo'`

Opcionalmente, gera o resumo IA para cada lead que tem conversas (chamando gemini-2.5-flash-lite para cada um).

#### 2. Modificar `upsertLead` no `dra-lia/index.ts`

Apos criar/atualizar o lead na tabela `leads`, tambem fazer upsert em `lia_attendances` imediatamente (sem esperar o timer de inatividade de 5 min). Isso garante que todo novo lead aparece no Smart Ops assim que se identifica.

Campos preenchidos no momento do upsert:
- `nome`, `email`, `source: 'dra-lia'`
- `especialidade` (se coletada)
- `data_primeiro_contato: now()`
- `lead_status: 'novo'`
- `rota_inicial_lia` (topic_context se ja selecionou)

O `summarize_session` (5 min inatividade) continua funcionando e atualiza o `resumo_historico_ia` depois.

#### 3. Melhorar `SmartOpsLeadsList.tsx`

Adicionar colunas relevantes para leads da LIA:
- **Resumo IA** — mostrar `resumo_historico_ia` como tooltip ou texto truncado na tabela
- **Rota LIA** — mostrar `rota_inicial_lia` (qual topico o lead escolheu)
- **Msgs** — contagem de mensagens (consultar `agent_interactions` por email/lead_id, ou armazenar como campo)
- **Ultima interacao** — data/hora da ultima mensagem

Adicionar filtro por `source` com opcao "dra-lia" pre-selecionavel.

No dialog de detalhes do lead, mostrar o `resumo_historico_ia` em destaque no topo, com formatacao visual diferenciada.

#### 4. Sem migracao de banco necessaria

Todos os campos ja existem em `lia_attendances`:
- `resumo_historico_ia`, `rota_inicial_lia`, `especialidade`, `area_atuacao`, `data_primeiro_contato`, `lead_status`, `source`

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/backfill-lia-leads/index.ts` | Nova edge function one-shot para popular lia_attendances com leads existentes |
| `supabase/functions/dra-lia/index.ts` | Modificar `upsertLead` para tambem fazer upsert em `lia_attendances` imediatamente |
| `src/components/SmartOpsLeadsList.tsx` | Adicionar colunas Resumo IA, Rota LIA; melhorar dialog de detalhes com resumo em destaque |

