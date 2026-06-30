## Objetivo
Popular a **Tabela técnica** dos cards do catálogo com as 301 variações da planilha (33 grupos reais), expondo para cada variação: **GTIN/EAN**, **Peso (kg)** e **Dimensões (cm)**. Exibição é automática — o card já renderiza qualquer linha presente em `technical_specs` via `normalizeSpecs`.

## Escopo

### 1. Match planilha ↔ catálogo
- Ler `/mnt/user-uploads/SmartDent_Variacoes_Final_2026.xlsx_-_🔀_Variações_Completas.csv`.
- Para cada um dos 33 grupos reais, casar o "Grupo" com `system_a_catalog.name` por:
  1. Match exato (case-insensitive, trim).
  2. Slug normalizado (sem acentos, `'` → vazio, espaços → `-`).
  3. Match de subset/aliases conhecidos (ex.: `L'Aqua` ↔ `Laqua`, `Modelo Universal (Salmão)`).
- Gerar relatório de "não casados" — apresentar ao usuário antes de aplicar (sem inventar produtos).

### 2. Construção das specs por produto
Para cada variação válida, gerar até 3 linhas em `technical_specs`:
```
{ label: "GTIN/EAN — <Valor da Variação>",       value: "<EAN>" }
{ label: "Peso (kg) — <Valor da Variação>",      value: "<peso>" }
{ label: "Dimensões (cm) — <Valor da Variação>", value: "<dims>" }
```
- Pular linhas com campo vazio (não criar `"GTIN/EAN — X": ""`).
- Manter o **formato canônico** que o `TechnicalSpecsEditor` já entende (regex `^(GTIN\/EAN|Peso \(kg\)|Dimensões \(cm\))\s*[—–-]\s*(.+)$`) — assim a sub-seção "Variações" do editor admin já abre povoada e editável.

### 3. Merge idempotente (não destrutivo)
Para cada produto casado, aplicar via `supabase--insert` (UPDATE):
- **`system_a_catalog`**: ler `extra_data.system_a_live.technical_specs`, **remover** apenas as linhas existentes cujo `label` casa o regex de variação (GTIN/Peso/Dim — *), **append** as novas, gravar de volta + setar `system_a_live.manually_edited_at = now()` (protege contra sobrescrita pelo `smart-ops-refresh-system-a-cache`, conforme já implementado).
- Também espelhar para colunas top-level `technical_specs` (PT) e **NULL em `technical_specs_en/_es`** para o `translate-card-row` re-traduzir.
- **`products_catalog`** (mesma chave por nome/slug): mesma operação em `technical_specifications` (KbTabCatalogo prioriza esta tabela quando presente).

### 4. Exibição no card
- Nenhuma mudança de UI necessária: `KbTabCatalogo.tsx` → `rawSpecs` → `normalizeSpecs` já renderiza qualquer `{label, value}`.
- Linhas saem como:
  - `GTIN/EAN — Base Clear: 756014745092`
  - `Peso (kg) — Base Clear: 0,011`
  - `Dimensões (cm) — Base Clear: 16.0×3.0×3.0 cm`

### 5. Tradução EN/ES
- Após o UPDATE, disparar `translate-card-row` para cada produto afetado (`source='system_a_catalog'` e `source='products_catalog'`) — preserva os números e traduz só os labels ("GTIN/EAN — Base Clear" → "GTIN/EAN — Base Clear" / valores intactos).

### 6. Entregáveis
- 1 migração de dados (via `supabase--insert`, idempotente — pode ser re-rodada).
- Relatório no chat: produtos casados (com counts) e produtos não casados (para o usuário confirmar/criar alias antes de re-rodar).
- Print da Tabela técnica de 1 produto após aplicação para validação.

## O que NÃO faço
- Não crio produtos novos no catálogo.
- Não toco em produtos sem match exato/seguro.
- Não removo specs antigas não relacionadas (Indicação clínica, certificação ANVISA, etc.) — só substituo as 3 famílias de variação.
- Não rodo cron — atualização é manual / one-shot.

## Pergunta antes de aplicar
Categoria de produtos como **"Base para pigmentação de Zircônia 100ml"** (24 variações) e **"Fresas Smart-DLC para Zircônia"** (17 variações) podem não existir no `system_a_catalog` ainda. Posso:
- (A) aplicar só nos que casarem e te devolver a lista de "não casados"; ou
- (B) parar antes do UPDATE e listar todo o mapeamento (matched + unmatched) para você revisar primeiro.

Padrão recomendado: **(A)** — aplica nos 100% certos e reporta o resto.
