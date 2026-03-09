

# Reestruturação do Card de Cadastro ROI

## Contexto
O CSV define uma estrutura muito mais rica do que o formulário atual. O novo card deve ter seções dinâmicas para: itens do combo, comparação de CAD por tipo de procedimento, seleção de resina (do sistema), seleção de impressora, e workflow detalhado por etapa.

## Novas Tabelas (Migrations)

### 1. `roi_card_items` — Itens do Combo
```sql
CREATE TABLE roi_card_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roi_card_id UUID NOT NULL REFERENCES roi_cards(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  investimento_fora_combo NUMERIC DEFAULT 0,
  investimento_com_combo NUMERIC DEFAULT 0,
  economia_imediata NUMERIC DEFAULT 0, -- auto-calc: fora - com
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. `roi_card_cad_types` — Tipos de CAD por Procedimento
Cada row = 1 procedimento (Coroas, Placas, Modelos ortodônticos, etc.) com tempos/custos para 4 métodos de CAD.
```sql
CREATE TABLE roi_card_cad_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roi_card_id UUID NOT NULL REFERENCES roi_cards(id) ON DELETE CASCADE,
  procedure_name TEXT NOT NULL, -- "Coroas sobre dente", "Placas Miorrelaxantes", etc.
  cad_manual_time NUMERIC DEFAULT 0,
  cad_manual_cost NUMERIC DEFAULT 0, -- auto: hora_clinica * tempo
  cad_terceirizado_time NUMERIC DEFAULT 0,
  cad_terceirizado_cost NUMERIC DEFAULT 0, -- admin input fixo
  cad_ia_time NUMERIC DEFAULT 0,
  cad_ia_cost NUMERIC DEFAULT 0,          -- admin input fixo
  cad_mentoria_cost NUMERIC DEFAULT 0,    -- admin input fixo
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Novos campos em `roi_cards`
```sql
ALTER TABLE roi_cards
  ADD COLUMN resin_id UUID REFERENCES resins(id),
  ADD COLUMN printer_model_id UUID REFERENCES models(id),
  ADD COLUMN cam_support_type TEXT DEFAULT '',
  ADD COLUMN cam_support_time NUMERIC DEFAULT 0,
  ADD COLUMN cam_operator TEXT DEFAULT '',
  ADD COLUMN workflow_descriptions JSONB DEFAULT '{}';
```
- `resin_id`: link para resina do sistema (puxa apresentações automaticamente)
- `printer_model_id`: link para impressora do sistema
- `cam_*`: dados do CAM (software pré-impressão)
- `workflow_descriptions`: JSON com descrições de processo por etapa + operador

RLS para as novas tabelas: leitura pública, escrita admin (mesmo padrão).

## Refactor do Formulário (`SmartOpsROICardsManager.tsx`)

O Dialog de criação/edição será reorganizado em seções colapsáveis (Collapsible):

### Seção 1: Identidade (existente)
Nome, Categoria, Status, Imagem — sem alterações.

### Seção 2: 📦 Produtos do Combo (NOVA)
- Tabela dinâmica de itens: Descrição | Investimento Fora (R$) | Investimento Com Combo (R$) | Economia (auto-calc)
- Botão "+ Adicionar Item"
- Linha TOTAL auto-calculada
- "Economia financeira imediata" = TOTAL fora - TOTAL com
- CRUD inline com `roi_card_items`

### Seção 3: 🖥️ Selecione o CAD (NOVA)
- Tabela com procedimentos pré-definidos (9 tipos: Coroas sobre dente, Placas Miorrelaxantes, Modelos ortodônticos, Modelos para prótese, Inlay/Onlay, Facetas e Lentes, Enceramento MOCKUP, Coroas sobre Implante, Protocolo sobre impl)
- Colunas: Manual (Tempo) | Manual (Custo = hora_clinica × tempo) | Terceirizado (Tempo) | Terceirizado (Custo fixo) | IA (Tempo) | IA (Custo fixo) | Mentoria (Custo fixo)
- CRUD com `roi_card_cad_types`

### Seção 4: 🧪 Resina do Combo (NOVA)
- Select dropdown buscando `resins` do sistema
- Ao selecionar, mostra automaticamente as `resin_presentations` (apresentações/SKUs) em tabela read-only
- Salva `resin_id` no `roi_cards`

### Seção 5: 🖨️ CAM & Impressora (NOVA)
- Campo: Tipo de inserção de suportes (text)
- Campo: Tempo para inserir suportes (numeric)
- Campo: Operador (text)
- Select dropdown buscando `models` (impressoras) do sistema
- Salva `printer_model_id` e campos `cam_*` no `roi_cards`

### Seção 6: ⚡ Workflow por Etapa (existente, enriquecido)
- Mantém a tabela de tempos Manual vs Smart + ASB
- Adiciona textarea para "Descrição do processo" por etapa
- Adiciona campo "Operador" por etapa (ex: "Depende do profissional", "Qualquer operador")
- Salva em `workflow_descriptions` JSONB

### Seção 7: 💰 Financeiro (existente)
Sem alterações.

## Arquivos Alterados

| Arquivo | Ação |
|---------|------|
| Supabase migration | Criar `roi_card_items`, `roi_card_cad_types` + ALTER `roi_cards` |
| `SmartOpsROICardsManager.tsx` | Refatorar formulário com 7 seções colapsáveis |
| `types.ts` | Auto-atualizado pelo Supabase |

