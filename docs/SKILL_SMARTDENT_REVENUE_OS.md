# SKILL — SmartDent Revenue Intelligence OS (Sistema B)
## Contexto completo para Claude Code

---

## O QUE É ESTE PROJETO

**Sistema B** (`print-params-hub`) é o hub central de inteligência comercial da **SmartDent 3D** — empresa brasileira de odontologia digital especializada em impressão 3D.

- **URL produção**: https://parametros.smartdent.com.br / https://print-params-hub.lovable.app
- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS + Supabase + Vercel
- **IA**: Google Gemini (embeddings RAG) + Lovable AI Gateway (LLM streaming)
- **Repositório**: SmartDentUSA/print-params-hub (GitHub)
- **Deploy**: Vercel (frontend) + Supabase Cloud (backend/edge)

**Sistema A** é a plataforma de conteúdo/marketing (separada, 91 Edge Functions, não alterar).

---

## MÓDULOS DO SISTEMA B

| # | Módulo | Descrição |
|---|--------|-----------|
| 1 | Hub de Parâmetros | 260+ combinações resina × impressora, URLs SEO únicas |
| 2 | Base de Conhecimento | 304 artigos PT/EN/ES, blog técnico multilíngue |
| 3 | Dra. L.I.A. | Chatbot RAG conversacional (vetor + FTS + ILIKE) |
| 4 | Catálogo (system_a_catalog) | 454 produtos sincronizados com Loja Integrada |
| 5 | Gestão de Vídeos | 499 vídeos PandaVideo com analytics |
| 6 | Geração de Conteúdo IA | Pipeline de criação/enriquecimento/tradução de artigos |
| 7 | Autores E-E-A-T | Perfis completos para SEO E-E-A-T |
| 8 | LLM-as-a-Judge | Avaliação automática de qualidade da L.I.A. |
| 9–13 | SEO, Admin, Edge Functions | Ver documentação completa |

---

## MÓDULO EM DESENVOLVIMENTO ATIVO — Revenue Intelligence OS

Este é o módulo sendo construído agora. Gerencia o **pipeline comercial de leads** com um Workflow Portfolio 7×3 que mapeia a jornada de cada lead no ecossistema de odontologia digital.

### Tabelas principais

| Tabela | Papel |
|--------|-------|
| `lia_attendances` | Hub central do lead (CDP) — tabela mais importante |
| `smartops_forms` | Definição dos formulários de captação |
| `smartops_form_fields` | Campos de cada formulário |
| `smartops_form_field_responses` | Respostas dos campos de formulário (criada recentemente) |
| `v_workflow_portfolio` | View read-only do portfolio 7×3 (criada recentemente) |
| `system_a_catalog` | Catálogo de produtos (FK usada em formulários) |
| `lead_activity_log` | Timeline de eventos do lead |
| `lead_enrichment_audit` | Auditoria de merge/enriquecimento |
| `team_members` | Vendedores e equipe |

### Edge Functions (pasta supabase/functions/)

| Função | Responsabilidade |
|--------|-----------------|
| `smart-ops-ingest-lead` | ⭐ PRINCIPAL — Ingestão e merge de leads |
| `smart-ops-lia-assign` | CRM sync + seller routing (PipeRun) |
| `cognitive-lead-analysis` | Análise cognitiva DeepSeek |
| `smart-ops-send-waleads` | Envio de mensagens WhatsApp |
| `backfill-intelligence-score` | Cálculo de scores e portfolio (batch) |

### Componentes frontend relevantes

| Componente | Arquivo | Status |
|------------|---------|--------|
| `SmartOpsFormBuilder` | SmartOpsFormBuilder.tsx | ✅ Atualizado |
| `SmartOpsSdrCaptacaoEditor` | SmartOpsSdrCaptacaoEditor.tsx | ✅ Novo (criado recentemente) |
| `SmartOpsMappingFieldsEditor` | SmartOpsMappingFieldsEditor.tsx | ✅ Novo (criado recentemente) |
| `SmartOpsFormEditor` | SmartOpsFormEditor.tsx | ✅ Atualizado (prop filterMappingFields) |
| `WorkflowPortfolio` | WorkflowPortfolio.tsx | ⏳ Pendente (Prompt 3) |
| `LeadDetailPanel` | LeadDetailPanel.tsx | ⚠️ NÃO alterar sem pedido explícito |
| `PublicFormPage` | PublicFormPage.tsx | ⏳ Pendente (Prompt 1) |

---

## WORKFLOW PORTFOLIO 7×3 — CONCEITO CENTRAL

Grade visual que mapeia a jornada do lead em **7 etapas × subcategorias × 3 camadas**.

### As 7 Etapas e Subcategorias

| # | Etapa | Subcategorias |
|---|-------|--------------|
| 1 | Captura Digital | Scanner Intraoral · Scanner Bancada · Notebook · Acessórios · Peças/Partes |
| 2 | CAD | Software · Créditos IA · Serviço |
| 3 | Impressão 3D | Resina · Software · Impressora · Acessórios · Peças/Partes |
| 4 | Pós-Impressão | Equipamentos · Limpeza/Acabamento |
| 5 | Finalização | Caracterização · Instalação · Dentística/Orto |
| 6 | Cursos | Presencial · Online |
| 7 | Fresagem | Equipamentos · Software · Serviço · Acessórios · Peças/Partes |

### As 3 Camadas (cores no grid)

| Camada | Código | Cor | Significado |
|--------|--------|-----|-------------|
| Ativos SmartDent | `ativo` | 🟢 Verde `#4ade80` | Lead possui produto SmartDent |
| Concorrente Mapeado | `conc` | 🟡 Amarelo `#fbbf24` | Lead possui produto concorrente |
| Interesse SDR | `sdr` | 🔵 Azul `#60a5fa` | Lead demonstrou interesse |
| Mapeamento | `mapeamento` | 🟣 Roxo (sugerido) | Lead respondeu sobre o que possui |
| Sem sinal | `vazio` | ⚪ Cinza | Nenhum dado |

**Prioridade**: `ativo` > `conc` > `sdr` > `mapeamento` > `vazio`

### Estrutura do `portfolio_json` (JSONB em `lia_attendances`)

```json
{
  "etapa_1_scanner": {
    "scanner_intraoral": {
      "mapeamento": {
        "status": "possui",
        "valor": "Medit i700 Wireless",
        "fonte": "formulario_sdr_captacao",
        "data": "2026-03-19T..."
      }
    }
  }
}
```

### `workflow_cell_target` — formato de célula

Usado em `smartops_form_fields.workflow_cell_target` e `smartops_form_field_responses.workflow_cell_target`:

```
formato: "etapa_X_nome.subcategoria"
exemplo: "etapa_1_scanner.scanner_intraoral"
```

### `workflow_stage_target` — 25 células disponíveis

Usado em `smartops_forms.workflow_stage_target` (célula SDR/Interesse do formulário):

```
1_captura_digital__scanner_intraoral
1_captura_digital__scanner_bancada
1_captura_digital__notebook
1_captura_digital__acessorios
1_captura_digital__pecas_e_partes
2_cad__software
2_cad__credito_ia
2_cad__servicos
3_impressao__resinas
3_impressao__software
3_impressao__impressora_3d
3_impressao__acessorios
3_impressao__pecas_e_partes
4_pos_impressao__equipamentos
4_pos_impressao__limpeza_e_acabamento
5_finalizacao__caracterizacao
5_finalizacao__instalacao
5_finalizacao__destistica_orto
6_cursos__presencial
6_cursos__online
7_fresagem__equipamentos
7_fresagem__softwares
7_fresagem__servicos
7_fresagem__acessorios
7_fresagem__pecas_e_partes
```

---

## SCHEMA DO BANCO — ESTADO ATUAL (19/03/2026)

### `lia_attendances` — campos relevantes

```
Campos legacy (equipamentos):
  equip_scanner, equip_impressora, equip_cad, software_cad,
  equip_pos_impressao, equip_fresadora, equip_notebook,
  insumos_adquiridos, impressora_modelo

Campos SDR (interesse):
  sdr_scanner_interesse, sdr_impressora_interesse,
  sdr_software_cad_interesse, sdr_cursos_interesse,
  sdr_insumos_lab_interesse, sdr_pos_impressao_interesse,
  sdr_solucoes_interesse, sdr_dentistica_interesse,
  sdr_caracterizacao_interesse, sdr_fresagem_interesse,
  sdr_scanner_modelo, sdr_cad_licenca, sdr_resina_atual,
  sdr_cura_modelo, sdr_cursos_modalidade, sdr_cursos_area,
  sdr_fresadora_marca, sdr_fresadora_modelo

Campos de status:
  status_scanner, status_cad, status_impressora,
  status_pos_impressao, status_insumos

Campos de hits (matching deal_items):
  hits_e2_software, hits_e3_impressora, hits_e3_resina,
  hits_e3_software, hits_e4_equipamentos,
  hits_e7_equipamentos, hits_e7_software, hits_fresagem

Campo novo (criado em 19/03/2026):
  portfolio_json JSONB DEFAULT '{}'

Campo de deduplicação:
  merged_into (leads mesclados têm este campo preenchido)
```

### `smartops_forms` — colunas relevantes

```
Colunas originais:
  id, name, slug, form_purpose, title, subtitle, description,
  theme_color, success_message, success_redirect_url,
  active, submissions_count, created_at

form_purpose CHECK (10 valores):
  'nps','sdr','roi','cs','captacao','evento'  ← legados
  'sdr_captacao','cm_update_deal','cs_update_deals','st_update_deals' ← novos

Colunas novas (criadas em 19/03/2026):
  hero_image_url TEXT
  hero_image_alt TEXT
  campaign_identifier TEXT
  product_catalog_id UUID REFERENCES system_a_catalog(id)
  workflow_stage_target TEXT
```

### `smartops_form_fields` — colunas relevantes

```
id, form_id, label, field_type, db_column, custom_field_name,
options (jsonb), required (bool), placeholder, order_index,
workflow_cell_target TEXT  ← nova (criada em 19/03/2026)
```

### `smartops_form_field_responses` — criada em 19/03/2026

```
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
form_id UUID REFERENCES smartops_forms(id) ON DELETE CASCADE
field_id UUID REFERENCES smartops_form_fields(id) ON DELETE CASCADE
lead_id UUID REFERENCES lia_attendances(id) ON DELETE CASCADE
value TEXT
workflow_cell_target TEXT
created_at TIMESTAMPTZ DEFAULT now()
RLS: habilitado com policy authenticated_full_access
```

### Trigger ativo

```
Nome: trg_portfolio_cell_on_response
Tabela: smartops_form_field_responses
Evento: AFTER INSERT
Função: fn_portfolio_cell_update()
Ação: jsonb_set cirúrgico em lia_attendances.portfolio_json
```

### View

```
Nome: v_workflow_portfolio
Filtro: WHERE merged_into IS NULL
Retorna: 27.663 leads ativos (verificado em 19/03/2026)
Uso: substituir leituras diretas de lia_attendances no WorkflowPortfolio.tsx
```

---

## REGRAS DE NEGÓCIO CRÍTICAS

### Golden Rule (NÃO violar)
Se existe um deal **aberto no pipeline de VENDAS** no PipeRun → **NUNCA** sobrescrever `owner_id` nem `stage_id`.

### Smart Merge (lead-enrichment.ts)
- `PROTECTED`: nunca sobrescrever (email, piperun_id, id, etc.)
- `ALWAYS_UPDATE`: último valor vence (utm_*, status_oportunidade, etc.)
- `MERGE_ARRAYS`: append + dedup (tags_crm, etc.)
- `MERGE_JSONB`: deep merge (raw_payload, sellflux_custom_fields)
- `ENRICHMENT_ONLY` (padrão): só preenche se null

### Reativação de Deal SDR-CAPTAÇÃO (§4.5)
Quando lead existente preenche formulário `sdr_captacao` E tem deal em "retivação":
1. Fecha deal existente como "Perdido" com motivo `reativacao_formulario`
2. Cria novo Deal no Round Robin de vendedores ativos
3. Novo deal NÃO herda o owner do deal anterior

### Inserção no portfolio_json
Regra de prioridade ao escrever:
- Célula vazia → escreve
- Já tem dado → COALESCE (só preenche se null)
- Marca concorrente → seta camada `conc`
- Produto SmartDent → seta camada `ativo` (prioridade máxima)

---

## INTEGRAÇÕES EXTERNAS

| Sistema | Uso |
|---------|-----|
| **PipeRun** | CRM principal — Pessoa → Empresa → Deal |
| **SellFlux** | Automação de marketing |
| **WhatsApp (WaLeads)** | Mensagens automáticas para lead e vendedor |
| **Meta Ads** | Webhook de leads de anúncios |
| **Loja Integrada** | E-commerce — webhooks de vendas |
| **Supabase Storage** | Bucket `catalog-images` para imagens HERO dos formulários |

---

## FLUXO DE INGESTÃO DE LEAD (smart-ops-ingest-lead)

```
POST payload
  → Detectar source (formulario / meta_lead_ads / sellflux / ecommerce)
  → Extrair campos (~76 campos explícitos)
  → Filtros de segurança (email obrigatório, test domains)
  → Busca lead existente por email
  → SE existente → Smart Merge
  → SE novo → INSERT (lead_status = "novo")
  → Fire-and-forget:
      smart-ops-lia-assign (CRM)
      cognitive-lead-analysis (DeepSeek)
      SellFlux webhooks
  → Resposta: { success, lead_id, is_existing, fields_updated }
```

---

## TAREFAS PENDENTES (ordem de prioridade)

| # | Tarefa | Arquivo(s) | Status |
|---|--------|-----------|--------|
| 1 | PublicFormPage → gravar em `smartops_form_field_responses` após submit | PublicFormPage.tsx | ⏳ Prompt 1 |
| 2 | smart-ops-ingest-lead → regra reativação de Deal SDR-CAPTAÇÃO | supabase/functions/smart-ops-ingest-lead/ | ⏳ Prompt 2 |
| 3 | WorkflowPortfolio → ler `portfolio_json` + camada mapeamento | WorkflowPortfolio.tsx | ⏳ Prompt 3 |
| 4 | Corrigir erro Edge Function ao trocar tipo de campo | SmartOpsFormEditor.tsx / SmartOpsMappingFieldsEditor.tsx | ⏳ Prompt 4 |

---

## O QUE NÃO ALTERAR (escopo restrito)

- `LeadDetailPanel.tsx` — não tocar sem pedido explícito
- `lead_activity_log` — não alterar schema
- Integrações PipeRun / SellFlux / Meta Ads existentes — não modificar
- Sistema A (repositório separado) — não relacionado
- RLS de tabelas já existentes — não modificar sem pedido explícito
- Golden Rule do PipeRun — nunca violar

---

## DOCUMENTAÇÃO DE REFERÊNCIA

O arquivo `docs/AUDITORIA_WORKFLOW_FORMULARIOS_CRM.md` no repositório contém a documentação completa e atualizada (v1.7) de todo o sistema. **Sempre leia este arquivo antes de implementar qualquer mudança relacionada ao Workflow 7×3, formulários ou ingestão de leads.**

---

## PADRÕES DE CÓDIGO DO PROJETO

- TypeScript estrito
- Supabase client via hook `useSupabaseClient()` ou import direto de `@/integrations/supabase/client`
- Toast notifications via `useToast()` (shadcn/ui)
- Tratamento de erro: `console.error` + toast para erros visíveis ao usuário
- Erros silenciosos (não bloqueantes): try/catch sem toast, apenas `console.error`
- Componentes UI: shadcn/ui (Button, Input, Select, Dialog, etc.)
- Estilização: Tailwind CSS utility classes
- Edge Functions: Deno + TypeScript, CORS headers obrigatórios
