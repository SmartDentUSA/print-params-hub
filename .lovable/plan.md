

## Inventário COMPLETO de Campos do Lead (Fluxo Digital)

### Mudança vs plano anterior
O plano anterior usava um mapeamento hardcoded de ~50 campos "relevantes". O usuário quer **TODOS os campos** da tabela `lia_attendances` — são **~290 campos**. A abordagem será **dinâmica**: iterar todas as keys do objeto `lead` e agrupá-las por prefixo automaticamente.

### Abordagem

**Componente: `src/components/smartops/LeadFieldsInventory.tsx`**

- Recebe `lead: Record<string, any>`
- Agrupa campos automaticamente por prefixo:
  - `equip_*` → 🔧 Equipamentos
  - `sdr_*` → 📱 SDR & Captação
  - `omie_*` → 🏭 Omie ERP
  - `piperun_*` → 📊 PipeRun CRM
  - `lojaintegrada_*` → 🛒 Loja Integrada
  - `empresa_*` → 🏢 Empresa
  - `pessoa_*` → 👤 Pessoa
  - `hits_*` → 📈 Hits (Vendas)
  - `astron_*` → 🎓 Astron Academy
  - `cognitive_*` → 🧠 Análise Cognitiva
  - `sellflux_*` → 📨 SellFlux
  - `frete_*` → 🚚 Frete
  - `timeline_*` → ⏱️ Timelines
  - `platform_*` → 📣 Plataforma Ads
  - `utm_*` → 🔗 UTM
  - `data_ultima_compra_*` → 🛍️ Última Compra
  - `ativo_*` → ✅ Ativos
  - `status_*` → 🏷️ Status
  - `last_form_*` → 📝 Último Formulário
  - `intelligence_*` → 🎯 Intelligence Score
  - `workflow_*` → 🔄 Workflow
  - `imersao_*` → 🏫 Imersão
  - `nps_*` → ⭐ NPS
  - `recompra_*` → 🔄 Recompra
  - `next_*` → 🔮 Previsões
  - `ltv_*` → 💰 LTV
  - `academy_*` → 📚 Academy
  - `map_fresadora_*` → 🔩 Mapeamento Fresadora
  - `crm_lock_*` → 🔒 CRM Lock
  - `suporte_*` → 🎧 Suporte
  - Sem prefixo reconhecido → 📋 Geral
- Cada grupo é um `Collapsible` (shadcn) com contador `(preenchidos/total)`
- Cada campo mostra: ícone ✅/⬜, nome do campo, valor (truncado a 120 chars para JSON)
- Toggle global "Mostrar apenas preenchidos"
- Barra de busca para filtrar campos por nome ou valor
- Dark theme inline (consistente com LeadDetailPanel)

**Integração: `src/components/smartops/LeadDetailPanel.tsx`**

- Importar e renderizar `<LeadFieldsInventory lead={detail.lead} />` na aba `fluxo`, após oportunidades (linha ~1884)

### Arquivos
1. `src/components/smartops/LeadFieldsInventory.tsx` — novo
2. `src/components/smartops/LeadDetailPanel.tsx` — inserir componente

### Sem mudanças de banco ou backend
LIA e Copilot já acessam todos os campos via `select("*")`.

