

# Diagnostico: mairabragantini@hotmail.com — Inconsistencias Massivas

## Resumo do Problema

O banco de dados tem **apenas 5 deals** para esta lead, mas o CSV do CRM mostra **15 deals distintos**. O LTV no sistema mostra **R$ 3.059** quando o valor real de P&S ganhas e **R$ 96.787**.

## Comparacao Completa: CSV vs Banco de Dados

### Deals no CSV (CRM real) — 15 deals unicos

```text
Deal ID    | Status | Valor P&S   | Proposta  | Pipeline        | NO DB?
-----------|--------|-------------|-----------|-----------------|-------
38900102   | Ganha  | R$ 67.000   | PRO8378   | CS Onboarding   | FALTA
40408600   | Ganha  | R$ 9.000    | PRO8978   | CS Onboarding   | FALTA
40941355   | Ganha  | R$ 3.059    | PRO9381   | Tulip-Teste     | SIM (sem itens!)
41511485   | Ganha  | R$ 430      | PRO9675   | CS Onboarding   | FALTA
42058002   | Ganha  | R$ 2.565    | PRO9910   | CS Onboarding   | FALTA
42875726   | Ganha  | R$ 3.780    | PRO10502  | CS Onboarding   | FALTA
43990913   | Ganha  | R$ 1.809    | PRO10982  | CS Onboarding   | FALTA
46720443   | Aberta | R$ 0        | PRO12607  | Estagnados      | SIM (sem itens)
46908903   | Ganha  | R$ 5.620    | PRO12775  | CS Onboarding   | FALTA
49836533   | Ganha  | R$ 0        | PRO14552  | CS Onboarding   | FALTA
49846470   | Aberta | R$ 0        | PRO14556  | Estagnados      | SIM (sem itens)
49893165   | Ganha  | R$ 200      | PRO14570  | CS Onboarding   | FALTA
49989658   | Aberta | R$ 0        | PRO14598  | Estagnados      | SIM
53008622   | Ganha  | R$ 673      | PRO16598  | CS Onboarding   | FALTA
53339204   | Ganha  | R$ 0        | PRO16835  | CS Onboarding   | FALTA
53841602   | Ganha  | R$ 2.087    | PRO17167  | CS Onboarding   | FALTA
54683645   | Ganha  | R$ 564      | PRO17745  | CS Onboarding   | FALTA
57957130   | Aberta | R$ 2.723,60 | PRO19163  | Funil de vendas | SIM (com itens)
```

### O que o banco tem (5 deals)

| Deal ID  | Status | value | value_products | proposals/items |
|----------|--------|-------|----------------|-----------------|
| 49989658 | Aberta | 0     | 0              | [] vazio        |
| 49846470 | Aberta | 0     | 0              | 1 item (sem total) |
| 40941355 | ganha  | 3059  | **0**          | **[] VAZIO!**   |
| 46720443 | aberta | null  | —              | sem proposals   |
| 57957130 | aberta | 2723.6| 2723.6         | 4 itens OK      |

## Inconsistencias Identificadas

### 1. **13 deals FALTAM completamente** (todos do pipeline "CS Onboarding")
O sync do PipeRun (`smart-ops-sync-piperun`) provavelmente nao inclui o pipeline "CS Onboarding" (pipeline_id nao esta no escopo do sync), ou esses deals foram criados antes do sync ser ativado.

### 2. **Deal 40941355 tem value=3059 mas proposals=[] (sem itens)**
O sync capturou o deal mas nao conseguiu puxar a proposta PRO9381 com seus 6 itens (Bite Splint FLEX 250g, Vitality BL1, Modelo Salmao 1kg, Stain White, Teflon, Bandeja).

### 3. **LTV completamente errado**
- DB mostra: **R$ 3.059** (1 deal ganha)
- CRM real: **R$ 96.787** (12 deals ganhas com valor > 0)
- Diferenca: **R$ 93.728 faltando**

### 4. **Product Mix impossivel de calcular**
Com apenas 4 itens no DB (do deal 57957130) vs ~30 itens reais no CRM, o Product Mix Intelligence esta completamente incompleto.

## Causa Raiz

O motor de sync `smart-ops-sync-piperun` faz sync apenas dos pipelines configurados. O pipeline **"CS Onboarding" (pipeline_id variavel)** nao esta sendo sincronizado, e e justamente onde a maioria dos deals ganhos desta lead (e provavelmente de muitos outros clientes) estao registrados.

## Plano de Correcao (2 acoes)

### Acao 1: Importar o CSV via `import-proposals-csv`
Executar a edge function `import-proposals-csv` com este CSV para preencher os 13 deals faltantes no `piperun_deals_history` da lead. Isso corrigira automaticamente o LTV, o Product Mix e a tabela de Propostas Detalhadas.

### Acao 2: Adicionar pipeline "CS Onboarding" ao sync do PipeRun
Verificar e adicionar os pipeline_ids do "CS Onboarding" ao escopo do `smart-ops-sync-piperun` para que futuros deals neste pipeline sejam capturados automaticamente. Isso evitara que o problema se repita para esta e outras leads.

**Nenhuma alteracao de UI necessaria** — o problema e 100% de dados faltantes no banco. As tabelas de Propostas Detalhadas e Product Mix Intelligence ja funcionam corretamente quando os dados estao presentes (como comprovado pelo deal 57957130 que tem itens).

