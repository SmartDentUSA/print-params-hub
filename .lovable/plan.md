

## Plano: Auditoria Completa da L.I.A. + Populacao de Dados nos Dashboards Smart Ops

### Auditoria — Bugs Criticos Encontrados

**BUG 1 — Nome nao e detectado (CRITICO)**

O `ASK_NAME` foi alterado para "Ainda nao sei o seu nome! Como devo te chamar?" mas o regex de deteccao de nome no `detectLeadCollectionState()` (linhas 903 e 918) ainda procura pelo padrao ANTIGO:

```
/qual (o seu |seu )?nome|what's your name|cuál es tu nombre/i
```

A nova mensagem "Como devo te chamar?" / "What should I call you?" / "Como debo llamarte?" NAO faz match. Resultado: o backend nunca detecta que pediu o nome, e o lead fica preso num loop infinito.

**Correcao:** Atualizar as 2 ocorrencias do regex (linhas 903 e 918) para:

```
/qual (o seu |seu )?nome|como devo te chamar|what's your name|what should I call you|cuál es tu nombre|cómo debo llamarte/i
```

---

**BUG 2 — Email nao e detectado na nova mensagem de greeting (PARCIAL)**

O `GREETING_RESPONSES` foi alterado para "Para que eu possa te reconhecer, informe seu **e-mail**." Porem a deteccao de email no `detectLeadCollectionState()` (linhas 931-932) busca:

```
/e-?mail|email|correo/i.test(lastAssistant.content) && /melhor|best|mejor|enviar|acompanhar/i.test(lastAssistant.content)
```

A nova mensagem contem "e-mail" (match no primeiro regex) mas NAO contem "melhor|best|mejor|enviar|acompanhar" (falha no segundo regex). Isso significa que se o usuario digitar o email como resposta e nao houver session_entities, o sistema nao consegue detectar que estava esperando o email.

Na pratica, isso e PARCIALMENTE mitigado porque o email detection primario (linhas 890-896) varre TODAS as mensagens do usuario procurando qualquer email. Mas o fallback na linha 931-940 nao funciona para a nova mensagem.

**Correcao:** Atualizar o regex da linha 932 para:

```
/e-?mail|email|correo/i.test(lastAssistant.content) && /melhor|best|mejor|enviar|acompanhar|reconhecer|recognize|reconocerte|informe|provide/i.test(lastAssistant.content)
```

---

**BUG 3 — Todos os 18 leads estao com `lead_status: "novo"`**

O Kanban filtra por `lead_status IN ("sem_contato", "contato_feito", "em_contato", ...)`. Porem TODOS os 18 leads no banco tem `lead_status = "novo"`, que NAO e nenhuma dessas colunas. Resultado: o Kanban aparece 100% vazio.

O Bowtie tambem mostra metricas zeradas porque depende de `score`, `ultima_etapa_comercial`, e `status_atual_lead_crm` — todos nulos.

---

### Solucao: Populacao Inteligente dos Dados

Com 18 leads reais no banco, todos com `lead_status: "novo"`, precisamos:

1. **Adicionar "novo" como coluna no Kanban** — o status "novo" e valido e e o mais comum para leads da Dra. LIA
2. **Distribuir alguns leads para simular o funil** — usando o edge function `import-leads-csv`, inserir ~20 leads ficticios com `lead_status` variados e dados CRM preenchidos para popular todos os dashboards:
   - Kanban: leads em "sem_contato", "contato_feito", "em_contato", "apresentacao", "proposta_enviada", "negociacao", "fechamento"
   - Estagnados: leads em "est1_0", "est1_3", "est2_1", etc.
   - Bowtie: leads com scores variados (20, 50, 70, 90, 100+)
   - Funil de Oportunidades: leads com `ultima_etapa_comercial` preenchido
   - Leads por Produto: leads com `produto_interesse` variado (Edge Mini, Vitality, NanoClean, Chair Side Print, Smart Lab, IoConnect)
   - Pipeline Health: leads com `status_oportunidade: "ganha"` e `data_contrato` preenchido

---

### Frente 1: Corrigir Bugs de Deteccao na Edge Function

**Arquivo: `supabase/functions/dra-lia/index.ts`**

1. **Linha 903** — Atualizar regex de deteccao de nome:
```
ANTES: /qual (o seu |seu )?nome|what's your name|cuál es tu nombre/i
DEPOIS: /qual (o seu |seu )?nome|como devo te chamar|what's your name|what should I call you|cuál es tu nombre|cómo debo llamarte/i
```

2. **Linha 918** — Mesma correcao (segunda ocorrencia):
```
ANTES: /qual (o seu |seu )?nome|what's your name|cuál es tu nombre/i
DEPOIS: /qual (o seu |seu )?nome|como devo te chamar|what's your name|what should I call you|cuál es tu nombre|cómo debo llamarte/i
```

3. **Linha 932** — Atualizar regex de deteccao de email:
```
ANTES: /melhor|best|mejor|enviar|acompanhar/i
DEPOIS: /melhor|best|mejor|enviar|acompanhar|reconhecer|recognize|reconocerte|informe|provide/i
```

---

### Frente 2: Adicionar "novo" ao Kanban

**Arquivo: `src/components/SmartOpsKanban.tsx`**

Adicionar coluna "Novo" no inicio do array COLUMNS (linha 22):

```
{ key: "novo", label: "Novo", color: "bg-emerald-50 border-emerald-300" },
```

Isso garante que os 18 leads existentes aparecam imediatamente no Kanban.

---

### Frente 3: Popular Dados de Demonstracao

Inserir ~25 leads ficticios no `lia_attendances` com dados distribuidos para popular todos os dashboards. Usarei SQL INSERT direto via o migration tool (como data operation).

Dados planejados:

```text
LEAD STATUS DISTRIBUTION:
  3x sem_contato     (score 10-20)
  3x contato_feito   (score 30-40)
  3x em_contato      (score 50-65)
  2x apresentacao    (score 70-75)
  2x proposta_enviada (score 80-85)
  2x negociacao      (score 90-95)
  2x fechamento      (score 100, status_oportunidade: ganha)
  
STAGNATION FUNNELS:
  2x est1_0, 1x est1_3, 1x est2_1, 1x est2_4, 1x est3_0
  1x estagnado_final

PRODUCT DISTRIBUTION:
  Edge Mini, Vitality, NanoClean, Chair Side Print, Smart Lab, IoConnect

CRM ENRICHMENT:
  ultima_etapa_comercial: variado
  funil_entrada_crm: "Comercial", "Estagnados"
  proprietario_lead_crm: "Thiago", "Marcelo"
  temperatura_lead: "frio", "morno", "quente"
  area_atuacao: variado
  especialidade: variado
  tem_impressora/tem_scanner: variado
  data_contrato: para leads com status "ganha"
  cs_treinamento: "concluido" para 2 leads
  ativo_scan/ativo_print/ativo_insumos: true para leads CS
  data_ultima_compra_insumos: para 1 lead (CS Ongoing)
```

---

### Frente 4: Ajustar Bowtie para Incluir Status "novo"

**Arquivo: `src/components/SmartOpsBowtie.tsx`**

Na query da linha 193, o MQL conta apenas `lead_status = "novo"`, o que ja esta correto. Porem preciso confirmar que os novos leads com scores variados aparecem corretamente no Funil de Oportunidades.

A funcao `classify` (linha 222) ja faz fallback por score, entao leads com score >= 60 serao automaticamente classificados como "em_contato", "em_negociacao" ou "fechamento".

Nenhuma alteracao necessaria no Bowtie — os dados populados irao alimentar automaticamente.

---

### Resumo de Alteracoes

```text
MODIFICAR:
  supabase/functions/dra-lia/index.ts
    - Linha 903: regex nome (adicionar "como devo te chamar" + en + es)
    - Linha 918: regex nome (mesma correcao)
    - Linha 932: regex email (adicionar "reconhecer|informe|recognize|provide|reconocerte")

  src/components/SmartOpsKanban.tsx
    - Linha 22: adicionar coluna "Novo" no COLUMNS

DATA INSERT (via insert tool):
  ~25 leads ficticios no lia_attendances com dados distribuidos
```

### Ordem de Execucao

1. Corrigir regex na edge function (bugs criticos)
2. Deploy da edge function
3. Adicionar coluna "novo" no Kanban
4. Inserir dados de demonstracao no banco
5. Verificar dashboards populados

