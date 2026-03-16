

## Plano: Reorganizar Card de Lead — Estrutura v2 Completa

### Problema
O card atual tem 9 tabs fragmentadas com dados dispersos. A referência v2 tem 7 tabs coesas e orientadas à ação do vendedor: Histórico Completo (deal table + timeline unificada), Análise Cognitiva (grid de insights), Upsell & Previsão (motor preditivo), Fluxo Digital (equipamentos), LIS Breakdown (score), Ações Recomendadas (priorizadas com scripts), IA Chat.

### Mudanças

**`src/components/SmartOpsLeadsList.tsx`** — Reestruturação completa do DetailPanel:

| Tab Atual | → Nova Tab | Ação |
|---|---|---|
| 🔗 Identidade | Fundido em "📋 Histórico Completo" | Identity Graph fica no final do Histórico |
| 📊 LIS Score | "📊 LIS Breakdown" | Mantém + adiciona gráfico de histórico do score |
| ⚙️ Equipamentos | "🔄 Fluxo Digital" | Renomeia + enriquece com dados de produtos comprados |
| 🧠 IA | Fundido em "🧠 Análise Cognitiva" | Chips de IA + grid cognitivo (perfil, riscos, abordagem) |
| 💬 Chat | "💬 Perguntar à IA" | Mantém |
| ⏱️ Timeline | Fundido em "📋 Histórico Completo" | Deal table + timeline unificada |
| 💬 Conversas | Fundido em Timeline | WhatsApp/LIA viram eventos na timeline |
| 🧠 Behavioral | Fundido em Timeline | Produtos/cursos/carrinho viram eventos na timeline |
| 📋 Visão Geral | Removido (dados disponíveis nas outras tabs) | Campos CDP relevantes distribuídos |
| — | **NOVO**: "🚀 Upsell & Previsão" | Gerado pela IA (motor preditivo) |
| — | **NOVO**: "⚡ Ações Recomendadas" | Gerado pela IA (ações priorizadas) |

### Nova estrutura de tabs (7):

1. **📋 Histórico Completo**
   - Stats row (6 colunas): LTV, Deals fechados, Unidades, Ticket médio, Maior compra, Ciclo recompra
   - Deal Table: tabela com Date, Deal ID, Funil, Itens, Qtd, Frete, Parcelas, Total, Vendedor, Pessoa, Status (extraído de `piperun_deals_history`)
   - Timeline Unificada: TODOS os eventos em ordem cronológica, incluindo:
     - `lead_activity_log` (timeline principal)
     - `lead_form_submissions` (formulários com equipamento/produto mencionado)
     - `lead_course_progress` (Astron: curso, status, %)
     - `lead_product_history` (compras e-commerce)
     - `lead_cart_history` (carrinhos abandonados, valor, itens)
     - `lead_sdr_interactions` (contatos SDR)
     - `lead_state_events` (transições de estágio)
     - `message_logs` (campanhas SellFlux enviadas)
     - `agent_interactions` (conversas LIA)
     - `whatsapp_inbox` (mensagens WA)
   - Identity Graph (movido do tab antigo) + Mapa de Chaves

2. **🧠 Análise Cognitiva**
   - AI Panel com botão "Reanalisar" (chama `smart-ops-copilot`)
   - Grid cognitivo (2×3): Perfil de Compra, Padrão de Escalada, Perfil de Crédito, Riscos, Abordagem, Oportunidades
   - Dados preenchidos pela análise cognitiva salva + opção de regenerar via IA

3. **🚀 Upsell & Previsão** (NOVO)
   - 3 cards de previsão (Hot/Warm/Cold) com probabilidade, produto, valor estimado, janela
   - Projeção de LTV (grid 4 colunas: Atual, +12m, +24m, Com Equipamentos)
   - Análise de mix de produtos (barras horizontais com %)
   - Gerado pela IA com base nos deals history

4. **🔄 Fluxo Digital**
   - Mantém a estrutura atual de equipamentos
   - Adiciona seção "Gap do Fluxo — Oportunidades Não Exploradas" com tags coloridas
   - Enriquece com dados de `lead_product_history`

5. **📊 LIS Breakdown**
   - Composição do score em barras horizontais (6 eixos)
   - Fórmula exibida
   - Gráfico de histórico do score (barras verticais) usando `lead_state_events`

6. **⚡ Ações Recomendadas** (NOVO)
   - Lista de ações priorizadas (HOJE, ESTA SEMANA, 30 DIAS, 60-90 DIAS)
   - Cada ação com: ícone, título, descrição, script de abordagem
   - Gerado pela IA com base no contexto completo do lead

7. **💬 Perguntar à IA**
   - Mantém o chat contextual como está

### Timeline Unificada — Consolidação de Todas as Fontes

A timeline vai fundir 10 tabelas em uma lista cronológica única, cada item com ícone, dot color e formatação específica por tipo:

```text
Fonte                    Emoji   Dot Color    Info Exibida
──────────────────────────────────────────────────────────
lead_activity_log        📌      blue         event_type + entity_name + value
lead_form_submissions    📝      blue         form_name + equip/product mentioned
lead_course_progress     🎓      yellow       curso + status + progress %
lead_product_history     🛒      green        produto + valor + qtd compras
lead_cart_history         🛒❌    warn         valor + qtd itens + status (abandoned)
lead_sdr_interactions    📞      purple       canal + outcome + notes
lead_state_events        🔄      hot/cold     from → to + regression flag
message_logs             📨      blue         tipo + preview + status
agent_interactions       💬      lia-blue     user msg + agent response (resumo)
whatsapp_inbox           📱      green/blue   direction + text + intent
```

### CSS — `src/styles/intelligence-dark.css`
- Adicionar estilos para: `.intel-stats-row`, `.intel-stat-box`, `.intel-deal-table`, `.intel-cog-grid`, `.intel-cog-card`, `.intel-upsell-grid`, `.intel-upsell-card`, `.intel-action-list`, `.intel-action-item`, `.intel-action-script`, `.intel-action-priority`, `.intel-prob-bar`, `.intel-score-chart`
- Baseado diretamente no CSS da referência v2

### Abordagem de implementação
- Tabs Histórico, Fluxo Digital, LIS: renderização direta dos dados do lead (sem chamada IA)
- Tabs Cognitiva, Upsell, Ações: chamam `smart-ops-copilot` com prompts estruturados e cache o resultado em state
- A timeline unificada ordena todos os eventos por timestamp desc, com lazy loading (primeiros 100)

