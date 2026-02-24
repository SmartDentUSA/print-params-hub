

# Ajustes no Smart Ops: Renomear Faixas do Funil + Modal Saude do Pipeline

## Resumo

Tres ajustes no componente `SmartOpsBowtie.tsx`:

1. **Renomear as faixas do Funil de Oportunidades** para refletir as etapas do Piperun
2. **Adicionar modal de edicao dos campos de Saude do Pipeline** (Meta, Conquistado, etc.)
3. **Kanbans de reativacao** -- ja existem no componente `SmartOpsKanban.tsx` na aba "Kanban". Eles aparecem abaixo do pipeline principal quando ha leads com status `est*`. Se nao aparecem, e porque nenhum lead possui esse status no banco. Nenhuma alteracao necessaria aqui.

---

## Alteracao 1: Renomear faixas do Funil de Oportunidades

No arquivo `src/components/SmartOpsBowtie.tsx`, alterar o array `FAIXAS` (linhas 40-45):

| De (atual) | Para (novo) | Etapas Piperun correspondentes |
|---|---|---|
| Em Processo | Contato Realizado | Sem Contato |
| Boas Chances | Em Contato | Em Contato, Apresentacao/Visita |
| Comprometido | Em Negociacao | Proposta Enviada, Negociacao |
| Conquistado | Fechamento | Fechamento |

Atualizar tambem a funcao `classify` (linhas 179-184) e os labels correspondentes na secao "Saude do Pipeline" (linha 414 "Conquistado" vira "Fechamento").

## Alteracao 2: Modal de edicao dos campos de Saude do Pipeline

Atualmente a secao "Saude do Pipeline" (linhas 399-441) exibe Meta, Conquistado, A Realizar, Pipeline Necessario e Pipeline Existente -- mas nao tem como editar esses valores diretamente.

Adicionar um botao de engrenagem no header do card "Saude do Pipeline" que abre um modal para editar:

- **Meta** (ja existe no modal de Metas como `pipelineMeta`, mas colocar acesso direto aqui)
- **Conquistado** (campo manual override, salvo em `site_settings` como `smartops_pipeline_conquistado_override`)
- **Pipeline Existente** (campo manual override, salvo em `site_settings` como `smartops_pipeline_existente_override`)

Se os overrides estiverem preenchidos, usam o valor manual; caso contrario, mantem o calculo automatico.

---

## Detalhes tecnicos

### Arquivo: `src/components/SmartOpsBowtie.tsx`

1. **FAIXAS** -- renomear labels e keys:
```
em_processo -> contato_realizado, "Contato Realizado"
boas_chances -> em_contato, "Em Contato"  
comprometido -> em_negociacao, "Em Negociacao"
conquistado -> fechamento, "Fechamento"
```

2. **classify()** -- atualizar retorno para novos keys

3. **pipeline section** -- atualizar labels ("Conquistado" -> "Fechamento", etc.)

4. **Novo modal** -- adicionar Dialog com campos editaveis para override manual dos valores de saude do pipeline, salvando/lendo de `site_settings`

### Arquivo: `src/components/SmartOpsGoals.tsx`

Nenhuma alteracao necessaria -- as metas do bowtie continuam funcionando como estao.

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| `src/components/SmartOpsBowtie.tsx` | Editar -- renomear faixas, adicionar modal saude pipeline |

