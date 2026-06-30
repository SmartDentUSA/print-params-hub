
## Objetivo
Adicionar nas fichas técnicas dos 15 grupos já matchados (42 produtos em `system_a_catalog` / 43 em `products_catalog`) as 3 informações ausentes da planilha `SmartDent_Variacoes_Final_2026.xlsx`:

- **GTIN / EAN** (por variação)
- **Peso (kg)** (por variação)
- **Dimensões (cm)** (por variação)

## Como
1. Reprocessar a planilha (abas `🔀 Variações Completas`, `🧪 Resinas`, `🦷 Atos Resinas`, `🎨 SmartMake + SmartGum`, `⚙️ Zircônia + Fresas`) agrupando por **Grupo**.
2. Para cada grupo, montar 3 linhas formatadas no padrão "Variação → Valor":
   - `GTIN / EAN por variação` — ex.: `DA1: 7898... | DA2: 7898... | DA3: 7898...`
   - `Peso por variação (kg)` — ex.: `DA1: 0,025 | DA2: 0,025 | ...`
   - `Dimensões por variação (cm)` — ex.: `DA1: 5x3x2 | DA2: 5x3x2 | ...`
   - Quando todas as variações tiverem o mesmo valor, colapsar em linha única (`Peso (kg)`, `Dimensões (cm)`, `GTIN / EAN`) com o valor comum.
3. SQL idempotente:
   - **`system_a_catalog`**: fazer `jsonb_set` em `extra_data->system_a_live->technical_specs` adicionando/atualizando as 3 chaves (`GTIN / EAN`, `Peso (kg)`, `Dimensões (cm)` — ou as variantes "por variação"). Preservar as chaves já inseridas (Variações, SKUs, NCM, Categoria, Fonte).
   - Atualizar `manually_edited_at = now()` para blindar contra o cron de sync.
   - **`products_catalog`**: espelhar as mesmas 3 chaves em `technical_specifications` (jsonb) dos 43 produtos correspondentes.
4. Rodar via `supabase--insert` (UPDATE em dados existentes, sem migração de schema).

## Escopo (15 grupos / 42+43 produtos já matchados)
Mesmos grupos da rodada anterior (Atos, SmartGum, SmartMake variações ativas, Blocos Smart Zr Amann ativos, etc.). Os 21 grupos sem match no catálogo continuam fora — não serão criados aqui (já avisei na rodada anterior).

## Sem mexer
- Nenhuma alteração de UI (`KbTabCatalogo.tsx`, `TechnicalSpecsEditor.tsx`, `AdminCatalogFormSection.tsx`).
- Nenhuma migração de schema.
- Specs manuais já inseridas (ex.: Bio Vitality) não são tocadas — só adiciona-se chave nova se ainda não existir.

Aprove para eu executar os UPDATEs.
