

## Plano: Ajustar Kanban com Etapas Reais do CRM Completo + Importar Leads

### Diagnostico

A planilha exportada contem **~1590 leads** de **4 funis reais** do Piperun:

```text
FUNIL DE VENDAS (pipeline principal):
  Sem contato, Contato Feito, Em Contato, Apresentação/Visita,
  Proposta Enviada, Negociação, Fechamento

FUNIL ESTAGNADOS (reativacao):
  Etapa 01 - Reativação, Etapa 02 - Reativação,
  Etapa 03 - Reativação, Etapa 04 - Reativação,
  Proposta Enviada - Estag, Apresentação/Visita - Estag  ← NOVO

CS ONBOARDING (pos-venda):
  Em espera, Sem Data / Agendar treinamento  ← NOVOS

FUNIL E-BOOK:
  Ebook Message Helper  ← NOVO
```

Status das oportunidades: **Aberta**, **Perdida**, **Ganha**

### Problemas Atuais

1. O Kanban nao tem a etapa "Apresentacao/Visita - Estag" nos estagnados
2. Nao existe secao CS Onboarding no Kanban
3. Nao existe parser para o export COMPLETO do Piperun (todos os funis juntos)
4. Leads Perdidos/Ganhos nao sao rastreados visualmente
5. No banco so existem 18 leads com `lead_status: "sem_contato"`

---

### Frente 1 — Novo Parser "piperun_full" para Export Completo

**Arquivo: `src/utils/leadParsers.ts`**

Criar `parsePiperunFull()` que mapeia Funil + Etapa para `lead_status`:

```text
MAPEAMENTO:
  "Funil de vendas" + "Sem contato"              → sem_contato
  "Funil de vendas" + "Contato Feito"             → contato_feito
  "Funil de vendas" + "Em Contato"                → em_contato
  "Funil de vendas" + "Apresentação/Visita"       → apresentacao
  "Funil de vendas" + "Proposta Enviada"          → proposta_enviada
  "Funil de vendas" + "Negociação"                → negociacao
  "Funil de vendas" + "Fechamento"                → fechamento
  "Funil Estagnados" + "Etapa 01*"                → est_etapa1
  "Funil Estagnados" + "Etapa 02*"                → est_etapa2
  "Funil Estagnados" + "Etapa 03*"                → est_etapa3
  "Funil Estagnados" + "Etapa 04*"                → est_etapa4
  "Funil Estagnados" + "Proposta Enviada*"        → est_proposta
  "Funil Estagnados" + "Apresentação/Visita*"     → est_apresentacao
  "CS Onboarding" + "Em espera"                   → cs_em_espera
  "CS Onboarding" + "Sem Data*"                   → cs_agendar
  "Funil E-book" + *                              → ebook
```

Campos mapeados da planilha:
- `nome`: extraido de "Titulo" (remove sufixo " - 2026-...")
- `email`: "E-mail (Pessoa)"
- `telefone_raw`: "Telefone Principal (Pessoa)" ou "Telefone (Pessoa)"
- `piperun_id`: "ID"
- `piperun_link`: "Link"
- `proprietario_lead_crm`: "Nome do dono da oportunidade"
- `produto_interesse`: "Produto de interesse"
- `area_atuacao`: "ÁREA DE ATUAÇÃO" ou "Área de Atuação"
- `especialidade`: "Especialidade principal" ou "Especialidade"
- `valor_oportunidade`: "Valor de P&S"
- `status_oportunidade`: "Status" (Aberta/Perdida/Ganha)
- `motivo_perda`: "(MP) Motivo de perda"
- `comentario_perda`: "(MP) Comentário"
- `temperatura_lead`: "Temperatura"
- `funil_entrada_crm`: "Funil"
- `lead_timing_dias`: "Lead-Timing"
- `cidade`: "Endereço - Cidade (Pessoa)"
- `uf`: "Endereço - Estado (UF) (Pessoa)"
- `tags_crm`: "Tags"
- `itens_proposta_crm`: "Itens da proposta"

Adicionar ao PARSER_OPTIONS como "PipeRun Export Completo".

---

### Frente 2 — Atualizar Kanban com Novas Secoes

**Arquivo: `src/components/SmartOpsKanban.tsx`**

**2a. Adicionar etapa "Apresentacao/Visita - Estag" aos estagnados:**

```text
STAGNANT_COLUMNS (atualizado):
  est_etapa1      → "Etapa 01 - Reativação"
  est_etapa2      → "Etapa 02 - Reativação"
  est_etapa3      → "Etapa 03 - Reativação"
  est_etapa4      → "Etapa 04 - Reativação"
  est_apresentacao → "Apresentação/Visita - Estag"   ← NOVO
  est_proposta    → "Proposta Enviada - Estag"
```

**2b. Adicionar secao CS Onboarding:**

Novo array:
```text
CS_COLUMNS:
  cs_em_espera  → "Em Espera"        (bg-teal-50 border-teal-300)
  cs_agendar    → "Agendar Treinamento" (bg-cyan-50 border-cyan-300)
```

**2c. Adicionar secao Ebook:**

Coluna simples para leads vindos do funil de e-book.

**2d. Indicador visual de Status (Ganha/Perdida):**

No card do lead, exibir badge verde "Ganha" ou vermelho "Perdida" quando `status_oportunidade != "aberta"`. Adicionar `status_oportunidade` e `valor_oportunidade` a interface Lead e ao select da query.

**2e. Atualizar STATUS_KEYS** para incluir todos os novos status no filtro da query.

---

### Frente 3 — Atualizar Stagnant Processor

**Arquivo: `supabase/functions/smart-ops-stagnant-processor/index.ts`**

Adicionar `est_apresentacao` na cadeia de progressao:

```text
ANTES:  est_etapa1 → est_etapa2 → est_etapa3 → est_etapa4 → est_proposta → estagnado_final
DEPOIS: est_etapa1 → est_etapa2 → est_etapa3 → est_etapa4 → est_apresentacao → est_proposta → estagnado_final
```

---

### Frente 4 — Importar os ~1590 Leads

Apos criar o parser, o usuario podera usar o botao "Importar" no Smart Ops, selecionar "PipeRun Export Completo" e carregar o arquivo XLSX. A importacao sera feita em batches de 500 via `import-leads-csv`.

---

### Resumo de Alteracoes

```text
MODIFICAR:
  src/utils/leadParsers.ts
    - Novo parser parsePiperunFull()
    - Nova opcao "PipeRun Export Completo" em PARSER_OPTIONS

  src/components/SmartOpsKanban.tsx
    - STAGNANT_COLUMNS: adicionar est_apresentacao
    - Novo CS_COLUMNS (cs_em_espera, cs_agendar)
    - Novo EBOOK status
    - STATUS_KEYS atualizado
    - Interface Lead: adicionar status_oportunidade, valor_oportunidade
    - Cards: badge Ganha/Perdida + valor quando disponivel
    - Nova secao "CS Onboarding" no render

  supabase/functions/smart-ops-stagnant-processor/index.ts
    - Adicionar est_apresentacao na cadeia PROGRESSION

DEPLOY:
  smart-ops-stagnant-processor
```

### Ordem de Execucao

1. Criar parser `parsePiperunFull` em leadParsers.ts
2. Atualizar Kanban com novos status e secoes
3. Atualizar stagnant processor e deploy
4. Importar leads via UI do Smart Ops

