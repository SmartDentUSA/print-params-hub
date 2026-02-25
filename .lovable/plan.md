

## Minha Opinião: Sequência Estratégica de Implementação

Sim, o mapeamento PipeRun-Leads deveria vir **antes** da inteligência contextual da Dra. L.I.A. Aqui está o raciocínio:

---

### O Problema de Ordem

A Régua de Conhecimento (MQL/SAL/SQL) da L.I.A. depende de saber **em qual etapa do CRM o lead está**. Se os campos do PipeRun não estiverem mapeados corretamente na `lia_attendances`, a L.I.A. não tem como calibrar o tom da conversa. Ela ficaria "cega" para o contexto comercial.

Atualmente, o `smart-ops-sync-piperun` e o `smart-ops-piperun-webhook` já fazem sync, mas com limitações:

1. **Campos que já chegam**: `proprietario_lead_crm`, `status_atual_lead_crm`, `funil_entrada_crm`, `status_oportunidade`, `valor_oportunidade`, `tags_crm`, `temperatura_lead`, `motivo_perda`, `cidade`, `uf`, `produto_interesse`, `especialidade`, `tem_impressora`, `tem_scanner`

2. **O que falta para a Régua funcionar**: A L.I.A. precisa saber a **última etapa do funil comercial antes de cair em estagnado**. Hoje o sync salva `status_atual_lead_crm` (nome do stage atual), mas quando o lead vai para "Estagnados", o stage anterior é perdido. Sem esse dado, a classificação MQL/SAL/SQL por etapa CRM não funciona.

3. **Custom Fields do PipeRun**: A função `extractCustomField()` busca por nome textual ("produto de interesse", "tem scanner"), mas os nomes reais dos custom fields no PipeRun podem ser diferentes. Sem um mapeamento validado, dados podem estar chegando vazios.

---

### Sequência que eu recomendo

```text
FASE 0 — MAPEAMENTO PIPERUN (pré-requisito)
├── 1. Auditar campos reais do PipeRun (usar piperun-api-test com raw_get)
├── 2. Mapear custom_fields reais → campos lia_attendances
├── 3. Adicionar campo "ultima_etapa_comercial" para guardar o stage antes de estagnação
├── 4. Corrigir extractCustomField() com nomes reais
└── 5. Testar sync com 5-10 deals reais

FASE 1 — VISUAL DA L.I.A. (independente, pode ser paralelo)
├── GIF avatar
├── Textos de identidade
└── Email-first no frontend

FASE 2 — FLUXO DE QUALIFICAÇÃO (backend)
├── Novas mensagens (ASK_NAME, ASK_AREA, etc.)
├── Delay 2s no LEAD_CONFIRMED
└── Returning lead com resumo

FASE 3 — INTELIGÊNCIA CONTEXTUAL (depende da Fase 0)
├── Captura passiva no system prompt
├── extractContextualLeadData()
├── Régua MQL/SAL/SQL (agora com dados CRM reais)
├── Equipment context para returning leads
└── anti_competitor_ammo no summarize_session
```

---

### O que fazer na Fase 0 (concretamente)

**Passo 1**: Chamar `piperun-api-test` com `action: "get_deal"` em 3-5 deals reais para ver a estrutura exata dos custom fields. Os nomes podem ser "Produto de Interesse" ou "produto_de_interesse" ou "CF_12345" — precisamos saber.

**Passo 2**: Chamar `piperun-api-test` com `action: "list_stages"` para mapear todos os stages e seus IDs aos nossos status internos (sem_contato, contato_feito, etc.).

**Passo 3**: Adicionar um campo `ultima_etapa_comercial` na `lia_attendances` para que, quando o lead entrar no funil de estagnação, saibamos de onde ele veio. Isso é o que permite a classificação:
- Veio de "Sem Contato"/"Contato Feito" → MQL
- Veio de "Em Contato"/"Apresentação" → SAL  
- Veio de "Proposta Enviada"/"Negociação"/"Fechamento" → SQL

**Passo 4**: Atualizar `smart-ops-sync-piperun` e `smart-ops-piperun-webhook` para salvar `ultima_etapa_comercial` antes de mudar o `lead_status` para `est1_0`.

---

### Por que não fazer tudo junto

A Fase 1 (visual) pode rodar em paralelo sem dependência nenhuma. Mas misturar a Fase 3 (inteligência) sem a Fase 0 (mapeamento) resultaria em uma Régua que classifica por **comportamento na conversa** (regex de "preço", "proposta") mas ignora o dado mais rico que já existe: **o histórico comercial real no CRM**.

A captura contextual por regex é um complemento, não o dado primário. O dado primário é o CRM.

---

### Próximo passo concreto

Posso começar pela **Fase 0** agora: usar o `piperun-api-test` para auditar a estrutura real dos deals e stages, e depois ajustar o mapeamento. Quer que eu faça isso?

