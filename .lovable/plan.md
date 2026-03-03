

# Plano: Itens de Proposta Granulares + Equipamentos/Técnico por Categoria

## Contexto

O campo `itens_proposta_crm` já existe e contém texto bruto como:
```
PRO 5969 [1.0000] Halot One Pro, PRO 5969 [1.0000] Scanner Intraoral I600, ...
```

O usuário quer: (1) parsing granular para filtros e disparos, (2) quando deal ganho/aprovado, popular automaticamente campos de equipamentos por categoria, cada um com número de série e data de ativação.

## 1. Migration: Novos campos na `lia_attendances`

```sql
-- Itens de proposta parseados (JSONB array com nome, qty, categoria)
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS itens_proposta_parsed jsonb DEFAULT '[]';

-- Equipamentos/Técnico (populados quando deal ganho)
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_scanner text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_scanner_serial text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_scanner_ativacao date;

ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_impressora text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_impressora_serial text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_impressora_ativacao date;

ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_cad text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_cad_serial text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_cad_ativacao date;

ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_pos_impressao text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_pos_impressao_serial text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_pos_impressao_ativacao date;

ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_notebook text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_notebook_serial text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS equip_notebook_ativacao date;

ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS insumos_adquiridos text;
```

Total: 16 novos campos.

## 2. `piperun-field-map.ts` — Parser de itens de proposta

Criar função `parseProposalItems(rawText: string)` que:
- Parseia o texto bruto `PRO XXXX [qty] Nome Item`
- Classifica cada item em categorias: `scanner`, `impressora`, `cad`, `pos_impressao`, `notebook`, `insumos`
- Usa keywords: "Scanner" → scanner, "Mars/Halot/MiiCraft/INO/Prusa" → impressora, "Wash&Cure/Mercury/UW" → pos_impressao, "Notebook/Avell" → notebook, "CAD/SmartMake/Exocad" → cad, "Resina/Kit/Glaze/Nano" → insumos
- Retorna `{ parsed: [{name, qty, category}], equipments: {scanner, impressora, cad, pos_impressao, notebook, insumos} }`

## 3. `smart-ops-sync-piperun` e `smart-ops-piperun-webhook` — Auto-populate

Quando `status_oportunidade === "ganha"` e `itens_proposta_crm` existe:
1. Chamar `parseProposalItems()` 
2. Salvar `itens_proposta_parsed` (JSONB)
3. Popular `equip_scanner`, `equip_impressora`, `equip_cad`, `equip_pos_impressao`, `equip_notebook`, `insumos_adquiridos` com os nomes dos itens correspondentes
4. Serial e data de ativação ficam em branco (preenchidos manualmente pelo CS depois)

Nos estágios `proposta_enviada`, `negociacao`, `fechamento` → apenas parsear e salvar `itens_proposta_parsed` sem popular equipamentos.

## 4. `KanbanLeadCard.tsx` — Badge de proposta nos cards

Nos cards de leads em status `proposta_enviada`, `negociacao`, `fechamento`, e leads ganhos: mostrar badges dos itens da proposta parseados (ex: "🖨️ Halot One", "📷 I600").

## 5. `KanbanLeadDetail.tsx` — Seção Equipamentos/Técnico

Nova seção "Equipamentos & Técnico" no detail panel mostrando:
- 📷 Scanner: {nome} | Nº Série: {serial} | Ativação: {data}
- 🖨️ Impressora: {nome} | Nº Série: {serial} | Ativação: {data}
- 💻 CAD: {nome} | Nº Série: {serial} | Ativação: {data}
- ♨️ Pós-Impressão: {nome} | Nº Série: {serial} | Ativação: {data}
- 💻 Notebook: {nome} | Nº Série: {serial} | Ativação: {data}
- 🧪 Insumos: {lista}

E seção "Itens da Proposta" listando todos os itens parseados com categoria.

## 6. Lead interface + LEAD_SELECT

Adicionar os 16 novos campos ao tipo `Lead` e ao `LEAD_SELECT`.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Migration SQL | 16 novos campos |
| `_shared/piperun-field-map.ts` | `parseProposalItems()` + classificador por keywords |
| `smart-ops-sync-piperun/index.ts` | Chamar parser quando deal ganho |
| `smart-ops-piperun-webhook/index.ts` | Chamar parser quando deal ganho |
| `KanbanLeadCard.tsx` | Badges de itens proposta + Lead interface |
| `KanbanLeadDetail.tsx` | Seção Equipamentos/Técnico + Itens Proposta |
| `SmartOpsKanban.tsx` | Expandir LEAD_SELECT |

