

# Expandir Formulário Base para cobrir todos os campos do Card do Lead

## Situação Atual
- **BASE_FORM_FIELDS**: 49 campos (order_index 1–49)
- **Card do Lead** (SmartOpsLeadsList): ~196 campos em 15 seções Accordion

Muitos campos do card são preenchidos por sistemas (PipeRun, Astron, Loja Integrada, IA cognitiva) e não fazem sentido em formulário público. Vou adicionar os campos **preenchíveis por humano** que estão faltando.

## Campos a adicionar ao BASE_FORM_FIELDS (~25 novos)

### Seção CS & Suporte
- `cs_treinamento` (select: Pendente/Agendado/Concluído)
- `data_treinamento` (text, DD/MM/AAAA)
- `data_contrato` (text, DD/MM/AAAA)
- `reuniao_agendada` (radio: Sim/Não)
- `data_primeiro_contato` (text, DD/MM/AAAA)

### Seção Funil & Status (preenchíveis)
- `status_oportunidade` (select: aberta/ganha/perdida)
- `valor_oportunidade` (number)
- `proprietario_lead_crm` (text)
- `produto_interesse_auto` (text)

### Seção Equipamentos Ativos (seriais/ativação)
- `equip_scanner` (text)
- `equip_scanner_serial` (text)
- `equip_impressora` (text)
- `equip_impressora_serial` (text)
- `equip_cad` (text)
- `equip_cad_serial` (text)
- `equip_pos_impressao` (text)
- `equip_pos_impressao_serial` (text)
- `equip_notebook` (text)
- `equip_notebook_serial` (text)
- `insumos_adquiridos` (textarea)

### Seção Marketing/UTM
- `utm_source` (text)
- `utm_medium` (text)
- `utm_campaign` (text)
- `utm_term` (text)

### Seção Tags
- `motivo_perda` (text)
- `comentario_perda` (textarea)
- `id_cliente_smart` (text)

## Alterações

### 1. `src/components/SmartOpsFormBuilder.tsx`
Expandir `BASE_FORM_FIELDS` de 49 para ~76 campos (order_index 50–76), organizados nas categorias acima.

### 2. `src/components/SmartOpsFormEditor.tsx`
Adicionar os novos campos ao `DB_COLUMNS` nas categorias correspondentes para o dropdown "Mapear para":
- **CS & Suporte** (nova categoria)
- **Equipamentos** (expandir com seriais)
- **Marketing** (expandir com UTMs)
- **Comercial** (expandir com valor_oportunidade, status)

### 3. `supabase/functions/smart-ops-ingest-lead/index.ts`
Mapear os novos campos no `incomingData` (equip_*, cs_*, utm_*, etc.).

## Resultado
- Formulário Base com ~76 campos = 100% dos campos preenchíveis por formulário
- Campos de sistema (PipeRun sync, Astron sync, IA cognitiva, Loja Integrada) ficam de fora pois são preenchidos automaticamente
- Clonar o formulário base permite criar qualquer formulário especializado

