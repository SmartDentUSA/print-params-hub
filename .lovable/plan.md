

## Análise: Quais dados serão utilizados na nova view?

### Resposta curta: SIM, TUDO

O plano prevê consumir **todas** as fontes de dados do lead. Veja o mapeamento completo:

### Dados já carregados pela query principal (`lia_attendances`)

A query atual do `SmartOpsLeadsList` já faz `select("*")` na tabela `lia_attendances` (~200 colunas), que inclui:

| Domínio | Campos | Status |
|---|---|---|
| Core (identidade) | nome, email, telefone, cidade, uf, especialidade | Incluído |
| Qualificação SDR | sdr_scanner_interesse, sdr_impressora_interesse, etc. (15 campos) | Incluído |
| PipeRun CRM | piperun_deals_history (JSONB), proposals_data, piperun_* (25+ campos) | Incluído |
| Cognitive AI | psychological_profile, primary_motivation, objection_risk, etc. | Incluído |
| Intelligence Score | intelligence_score (JSONB com 4 eixos), workflow_score | Incluído |
| Equipamentos | equip_scanner, equip_impressora, equip_cad + seriais + ativações | Incluído |
| E-commerce | lojaintegrada_* (22 campos), ltv_total, total_deals | Incluído |
| Astron Academy | astron_courses_total, astron_plans_active, etc. (12 campos) | Incluído |
| Automação | proactive_count, proactive_sent_at, cooldowns | Incluído |

### Dados carregados sob demanda (ao selecionar um lead)

Seguindo o padrão do `KanbanLeadDetail`, ao clicar em um lead na sidebar, o detalhe carregará:

| Fonte | Tabela | O que mostra |
|---|---|---|
| Timeline completa | `lead_activity_log` | Todos os eventos: CRM, e-commerce, LIA, suporte, meta ads, formulários (200 últimos + Realtime) |
| Conversas Dra. LIA | `agent_interactions` | Histórico de perguntas/respostas web (100 últimas) |
| WhatsApp Inbox | `whatsapp_inbox` | Mensagens recebidas/enviadas + intent + mídia (100 últimas) |
| Mensagens Sistema | `message_logs` | Alertas sistema→vendedor e campanhas vendedor→lead (50 últimos) |
| Chamados técnicos | via `lead_activity_log` (event_type = 'support_ticket_*') | Aparece na timeline |

### Fontes que existem mas NÃO são consumidas hoje

As 6 tabelas de Behavioral Intelligence **não** são consultadas diretamente pelo frontend atual:

| Tabela | Dados | Será incluída? |
|---|---|---|
| `lead_product_history` | Produtos comprados, valores, frequência | **Sim — nova seção "Histórico de Compras"** |
| `lead_course_progress` | Cursos Astron: progresso, conclusão | **Sim — nova seção "Cursos"** |
| `lead_form_submissions` | Formulários preenchidos, equipamentos mencionados | **Sim — timeline** |
| `lead_cart_history` | Carrinhos abandonados | **Sim — nova seção "Carrinhos"** |
| `lead_sdr_interactions` | Contatos SDR, notas | **Sim — nova seção "Interações SDR"** |
| `lead_state_events` | Transições de estágio com regressões | **Sim — nova seção "Jornada de Estágio"** |

### Plano atualizado

Para honrar o requisito de "TUDO relacionado ao lead", o painel de detalhe terá as seguintes tabs:

```text
LeadDetailPanel
├── Hero Card (LTV, deals, score, buyer_type, equipment badges)
├── Tab: Visão Geral (campos CDP consolidados — o que já existe)
├── Tab: Timeline (lead_activity_log + Realtime — já existe)
├── Tab: Conversas (agent_interactions + whatsapp_inbox + message_logs — já existe)
├── Tab: Behavioral (NOVO)
│   ├── Histórico de Compras (lead_product_history)
│   ├── Carrinhos Abandonados (lead_cart_history)
│   ├── Formulários (lead_form_submissions)
│   ├── Progresso Cursos (lead_course_progress)
│   ├── Interações SDR (lead_sdr_interactions)
│   └── Transições de Estágio (lead_state_events)
└── Tab: Intelligence (score breakdown + cognitive analysis — já existe)
```

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/SmartOpsLeadsList.tsx` | **Reescrever** — split-panel dark + todas as tabs acima |
| `src/styles/intelligence-dark.css` | **Novo** — tema dark scoped |
| `src/index.css` | **Editar** — import do CSS |

### Resumo

- **200+ campos do CDP** (`lia_attendances`) — todos visíveis
- **6 tabelas behavioral** — todas consultadas sob demanda ao selecionar lead
- **4 tabelas de comunicação** — agent_interactions, whatsapp_inbox, message_logs, lead_activity_log
- **Realtime** — timeline com subscription para novos eventos

Total: **~10 tabelas** consultadas para montar a visão completa de um lead.

