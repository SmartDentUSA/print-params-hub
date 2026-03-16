

## Análise: Estrutura do Card do Lead — Referência vs Implementação Atual

### O que a referência HTML mostra (LABORATORIO MERIDIONAL como exemplo)

O card ideal tem duas partes: **Lead Row** (sidebar) e **Detail Panel** (painel direito).

**Lead Row (sidebar):**
- Avatar com iniciais (gradiente baseado em buyer_type: empresa=verde-limão, pessoa=roxo)
- Nome, email/empresa, LTV (em Syne, verde)
- Tags: tipo (🏢 Empresa / 👤 Pessoa), equipamentos (🔬 Scanner, 🖨️ Impressora, 💻 Exocad)
- Rodapé: stage do pipeline, LIS score (badge colorido), WF x/10

**Detail Panel (hero + tabs):**
- **Hero card**: avatar grande, buyer badge, nome (Syne 18px), meta-row (área, empresa, telefone, pipeline, source), blocos Workflow (barra 10 segmentos), LTV Total, LIS Score (número grande + heat badge)
- **5 tabs**: Identidade, LIS Score, Equipamentos, IA, Chat

### Comparação com o código atual

| Elemento | Referência HTML | React atual | Status |
|---|---|---|---|
| Lead Row (sidebar) | ✓ | ✓ Implementado identicamente | ✅ |
| Hero card (5 colunas grid) | ✓ | ✓ Implementado identicamente | ✅ |
| Tab Identidade (Identity Graph + Key Map) | ✓ | ✓ Implementado identicamente | ✅ |
| Tab LIS Score (breakdown 4 eixos + fórmula) | ✓ | ✓ Implementado identicamente | ✅ |
| Tab Equipamentos (chairside flow + gap analysis) | ✓ | ✓ Implementado identicamente | ✅ |
| Tab IA (Claude panel com análise/script/reativação) | ✓ | ❌ Não existe | 🔴 |
| Tab Chat (LIA chat contextual) | ✓ | ❌ Não existe | 🔴 |
| CSS dark theme | ✓ | ✓ Todas as classes mapeadas | ✅ |
| Tabs extras (Timeline, Conversas, Behavioral, Overview) | ❌ | ✓ (além do ref) | ✅ extra |

### Conclusão

A estrutura do card do lead **já está implementada fielmente** ao modelo de referência. O Lead Row e o Detail Panel (Hero + Identity Graph + LIS Score + Equipamentos) estão corretos.

As duas funcionalidades que faltam são:
1. **Tab IA** — painel com Claude Sonnet para gerar análise cognitiva, script WhatsApp e estratégia de reativação
2. **Tab Chat** — interface de chat contextual com a LIA usando dados completos do lead

### Plano para implementar as 2 tabs faltantes

**Tab IA (análise ao vivo):**
- Adicionar tab "🧠 IA" ao array de tabs
- Painel com header "Claude Sonnet — análise ao vivo"
- Corpo com texto placeholder + 3 action chips: "🧠 Análise", "🎯 Script", "🔄 Reativação"
- Cada chip chama a Edge Function `smart-ops-copilot` com prompt específico e contexto do lead
- Resultado renderizado inline no painel

**Tab Chat (LIA contextual):**
- Adicionar tab "💬 Chat" ao array de tabs
- Interface de chat: mensagens (msg-ai / msg-user), quick asks, input + botão enviar
- Chamada à Edge Function `smart-ops-copilot` com system prompt contendo contexto completo do lead
- Histórico de mensagens mantido em state local

| Arquivo | Ação |
|---|---|
| `src/components/SmartOpsLeadsList.tsx` | Adicionar tabs "IA" e "Chat" com lógica de chamada à Edge Function |
| `src/styles/intelligence-dark.css` | Adicionar classes `.intel-ai-panel`, `.intel-chat-wrap`, `.intel-msg`, `.intel-qa`, `.intel-chat-input` (já existem parcialmente) |

