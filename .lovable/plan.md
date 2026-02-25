

## Plano: Sync PipeRun + Atualização da UI Smart Ops Leads

### Diagnóstico do Sync

O `smart-ops-sync-piperun` deu timeout na chamada. Conforme o memory do projeto, requests do Supabase (AWS Frankfurt) sofrem bloqueio 403 "Maintenance" pelo Cloudflare do PipeRun. Nenhum lead no banco tem `piperun_id` preenchido — todos vieram da Dra. L.I.A. ou webhooks, nunca do sync direto.

O canal confiável de ingestão é o **webhook reverso** (`smart-ops-piperun-webhook`), que recebe dados pushados pelo PipeRun quando um deal muda. O sync direto via API provavelmente continuará falhando por bloqueio de IP.

**Ação**: Não vou alterar a lógica do sync (ela está correta), mas vou adicionar um botão na UI para disparar o sync e mostrar o resultado/erro claramente, além de um indicador visual de que o webhook é o canal primário.

### Mudanças na UI — SmartOpsLeadsList

A tabela de leads precisa mostrar os novos campos mapeados do PipeRun:

| Campo Novo | Coluna na Tabela | Detalhe Modal |
|---|---|---|
| `ultima_etapa_comercial` | Sim (badge) | Sim |
| `temperatura_lead` | Sim (ícone 🔥/❄️) | Sim |
| `status_oportunidade` | Já existe | Já existe |
| `valor_oportunidade` | Já existe | Já existe |
| `tags_crm` | No modal | Sim (badges) |
| `motivo_perda` / `comentario_perda` | No modal | Sim |
| `itens_proposta_crm` | No modal | Sim |
| `piperun_link` | Botão no modal | Sim (link externo) |
| `data_fechamento_crm` | No modal | Sim |
| `lead_timing_dias` | No modal | Sim |
| `tem_scanner` / `tem_impressora` | Coluna compacta | Sim |

### Mudanças Concretas

**1. `src/components/SmartOpsLeadsList.tsx`**

- Adicionar `ultima_etapa_comercial` à interface `LeadFull`
- Adicionar coluna "Temperatura" com ícones visuais (🔥 quente, 🟡 morno, ❄️ frio, — sem dados)
- Adicionar coluna "Última Etapa" mostrando a etapa comercial antes de estagnação (badge colorida)
- Adicionar coluna compacta "Equip." mostrando ícones se tem scanner/impressora
- No modal de detalhes: reorganizar em seções (Dados Pessoais, CRM/PipeRun, Equipamentos, IA/LIA, Ativos)
- Adicionar link para PipeRun no modal quando `piperun_link` existir
- Adicionar filtro por `temperatura_lead` (frio/morno/quente)
- Adicionar filtro por estagnação (leads em funil estagnado: `est1_*`, `est2_*`, `est3_*`)
- Atualizar STATUS_OPTIONS para incluir estágios de estagnação

**2. `src/components/SmartOpsTab.tsx`**

- Adicionar botão "Sync PipeRun" ao lado de "Atualizar Dados" que chama a edge function e mostra toast com resultado
- Adicionar indicador "Webhook ativo" como badge informativa

**3. `src/components/SmartOpsBowtie.tsx`**

- Usar `temperatura_lead` e `ultima_etapa_comercial` para classificar leads MQL/SAL/SQL no funil ao invés de depender apenas do score numérico
- Lógica: Se `ultima_etapa_comercial` existe e lead está em estagnação, usar a etapa anterior para classificar

### Ordem de Implementação

1. Atualizar `SmartOpsLeadsList.tsx` — novos campos, filtros, modal reorganizado
2. Atualizar `SmartOpsTab.tsx` — botão de sync PipeRun
3. Atualizar `SmartOpsBowtie.tsx` — classificação usando dados CRM reais

