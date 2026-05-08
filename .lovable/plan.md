
## Diagnóstico do lead "Marcia Veraldi"

ID: `2b3d6f4c-40e4-4c6e-a848-3c121e9564e4`  ·  CNPJ `45.780.540/0001-73`  ·  Cuiabá/MT  ·  piperun_id `59560182`

O lead **existe e os números do CRM são reais** (1175 deals distintos no Piperun desde 2021, pipelines `Exportação` + `Funil Estagnados` — é uma **distribuidora**, não duplicação). O problema está em 4 campos derivados que ficaram inconsistentes entre si.

### O que o card mostra vs. o que o banco diz

| Campo do card | Valor exibido | Origem real no banco | Diagnóstico |
|---|---|---|---|
| Nome / cidade / 1175 deals / R$ 2.549.565 | OK | `nome`, `cidade='Cuiabá'`, `total_deals=1175`, `ltv_total=2549565.01` | **Correto** |
| 👤 B2C | B2C | `buyer_type='B2B'` no banco | UI exibindo errado OU classificador rebaixou |
| 22-Sócio (mensagem anterior) | Sócio | `area_atuacao='49-Sócio-Administrador'` | Prefixo numérico do Piperun não foi removido |
| e-mail | "e-mail não informado" | `email='e-mail não informado'` (string literal!) | Placeholder gravado como dado, deveria ser `NULL` |
| Score ERP 10 / RISCO / REATIVACAO | RISCO | `omie_score=10`, `omie_classificacao='REATIVACAO'`, `omie_faturamento_total=0`, `omie_total_pedidos=0` | **Bug raiz** — Omie não casou o CNPJ |
| Status WF 0/10 / "Contato Feito" / `real_status=RISCO_OPERACIONAL` | RISCO | derivado de Omie zerado + deals antigos abertos | Consequência do bug acima |

### Causa raiz

**O sync Omie não está encontrando o CNPJ `45.780.540/0001-73`** (último sync `2026-04-19`, mas `omie_total_pedidos=0` e `omie_faturamento_total=0`). Com Omie zerado:

1. `omie_score` cai para 10 → label `RISCO`
2. `omie_classificacao` vira `REATIVACAO` (último Omie purchase = nunca)
3. Trigger de `real_status` (mem: unified-real-status-logic-v2) marca `RISCO_OPERACIONAL` apesar dos R$ 2,5M de LTV CRM
4. RFM ignora o histórico (mem: rfm-scoring-rules-v1 usa só deal history → deveria ser VIP 280, não RISCO)

Ou seja: **um único campo quebrado (Omie billing) está contaminando 4 indicadores do card**.

### Achados secundários

- **1175 deals sem `proposal_id`** (todos): viola a política `incremental-lead-data-policy-v3` (dedup por proposal_id). Hoje a deduplicação só funciona porque `deal_id` é distinto, mas qualquer reprocessamento pode duplicar.
- **`email='e-mail não informado'`**: provavelmente vindo do parser Piperun. Quebra qualquer matching futuro por email e regras `is null`.
- **`area_atuacao` com prefixo `49-`**: idem — o normalizador do Piperun não está strip-ando o código.
- **`buyer_type=B2B` no banco mas UI mostra B2C**: precisa confirmar se é bug do `KanbanLeadCard` ou se o classificador automático está sobrescrevendo na renderização.

### Plano de ação proposto (apenas investigação adicional + correções pontuais — nenhum refactor)

#### 1. Re-sync Omie focado neste lead
Disparar manualmente o edge function de sync Omie passando o CNPJ `45.780.540/0001-73` para descobrir **por que não casa**. Hipóteses: (a) cliente cadastrado no Omie com CNPJ formatado diferente; (b) cadastrado só com CPF `026.754.549-58`; (c) `uf` divergente. Inspecionar logs.

#### 2. Limpar placeholders sujos do lead (1 lead, migração pontual)
- `email = NULL` quando valor for literal `'e-mail não informado'` (varrer toda a tabela — provavelmente há centenas)
- `area_atuacao` strip do prefixo `^\d+-\s*` (ex.: `49-Sócio-Administrador` → `Sócio-Administrador`)

#### 3. Corrigir incoerência B2C/B2B no card
Verificar `KanbanLeadCard.tsx` — se o badge é derivado de `buyer_type` da DB ou recalculado no cliente. Se recalculado, alinhar com a coluna.

#### 4. Guard de coerência no `real_status`
Adicionar regra na trigger `unified-real-status-logic`: **se `ltv_total > 100000` e `omie_faturamento_total = 0`, NÃO marcar `RISCO_OPERACIONAL`** — emitir flag `OMIE_SYNC_GAP` em vez disso. Evita que toda distribuidora B2B cuja sync Omie falhe vire "risco".

#### 5. Backfill `proposal_id` nos deals históricos (opcional, médio porte)
Reprocessar `piperun_deals_history` deste e de outros leads grandes para popular `proposal_id` a partir da API Piperun, alinhando com `incremental-lead-data-policy-v3`.

### Itens fora deste plano (apenas reportar, sem mexer)
- Distribuir 1175 deals entre múltiplas pessoas da mesma empresa: NÃO fazer (mem `Identity & Merging`: nunca separar pessoas reais; e aqui só existe 1 pessoa registrada com este CNPJ).
- Refatorar todo o pipeline Omie identity-resolution-v5: fora do escopo desta investigação.

### Ordem de execução sugerida
1. Itens 1 e 3 (investigação rápida, leitura de logs + 1 arquivo)
2. Item 2 (migração de limpeza, ~50 linhas SQL)
3. Item 4 (alteração na trigger, ~10 linhas)
4. Item 5 (somente se você priorizar — é maior)

Quer que eu execute a partir do passo 1, ou prefere atacar diretamente uma dessas correções?
