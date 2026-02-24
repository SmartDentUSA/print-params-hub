

# Kanban com 7 Etapas do Piperun + Funil de Oportunidades + Saude do Pipeline

## Verificacao da Tabela

A tabela `lia_attendances` ja possui **todos os 52 campos** solicitados. Nenhuma coluna esta faltando. Nenhuma migration necessaria.

---

## 1. Kanban com 7 Etapas do Piperun

### Arquivo: `src/components/SmartOpsKanban.tsx`

Substituir as 3 colunas atuais (Novo, Em Contato, Qualificado) pelas 7 etapas reais do funil do Piperun:

| Coluna | key (lead_status) | Cor |
|---|---|---|
| Sem Contato | `sem_contato` | azul claro |
| Contato Feito | `contato_feito` | azul |
| Em Contato | `em_contato` | amarelo |
| Apresentacao/Visita | `apresentacao` | laranja |
| Proposta Enviada | `proposta_enviada` | roxo |
| Negociacao | `negociacao` | indigo |
| Fechamento | `fechamento` | verde |

Alteracoes:
- Atualizar constante `COLUMNS` com as 7 etapas e cores
- Mudar grid de `md:grid-cols-3` para scroll horizontal com `overflow-x-auto` e colunas de largura fixa (`min-w-[220px]`)
- Atualizar query `.in("lead_status", [...])` para incluir os 7 valores
- Cada coluna mostra contador e cards com drag-and-drop
- Manter alerta de 15 min para leads na coluna "Sem Contato"

---

## 2. Funil de Oportunidades (abaixo do Bowtie)

### Arquivo: `src/components/SmartOpsBowtie.tsx`

Adicionar novo Card "Funil de Oportunidades" abaixo do funil ampulheta existente.

Tabela com 4 faixas baseadas no campo `score`:

| Temperatura | Faixa | Cor | Criterio |
|---|---|---|---|
| < 60 | Em Processo | vermelho escuro | `score < 60` |
| 60-80 | Boas Chances | laranja | `score >= 60 AND score < 80` |
| 90 | Comprometido | dourado | `score >= 80 AND score < 100` |
| 100 | Conquistado | verde | `score >= 100` ou `status_atual_lead_crm = 'Ganha'` |

Colunas da tabela: Temperatura | Status | Mes Atual (count) | Mes Seguinte (count) | Meses Seguintes (count)

Funcionalidades:
- Navegacao por mes com setas (estado `selectedMonth`)
- Contagem agrupada por faixa de score e mes de `created_at`
- Layout visual com barras coloridas (como triangulo invertido do Piperun)

---

## 3. Saude do Pipeline (abaixo do Funil de Oportunidades)

### Arquivo: `src/components/SmartOpsBowtie.tsx`

Adicionar novo Card "Saude do Pipeline" com:

**Lado esquerdo** - 3 caixas empilhadas:
- Meta (+): constante configuravel (ex: 50 leads/mes)
- Conquistado (-): count de `score >= 100` no mes
- A Realizar (=): Meta - Conquistado

Seta "x3" conectando A Realizar ao Pipeline Necessario.

**Lado direito** - Gauge SVG:
- Pipeline Necessario = A Realizar x 3
- Pipeline Existente = count de leads ativos com `score < 100`
- Saude = (Pipeline Existente / Pipeline Necessario) x 100
- Gauge semicircular SVG com escala 0-300 e gradiente vermelho->amarelo->verde
- Ponteiro indicando o valor atual

---

## Resumo de Alteracoes

| Arquivo | O que muda |
|---|---|
| `src/components/SmartOpsKanban.tsx` | 3 colunas -> 7 colunas do Piperun, scroll horizontal |
| `src/components/SmartOpsBowtie.tsx` | Adicionar Funil de Oportunidades + Saude do Pipeline abaixo do Bowtie |

Nenhuma migration necessaria - todos os campos ja existem na tabela.

