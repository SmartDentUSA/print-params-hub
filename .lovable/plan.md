Renomear o rótulo "Apresentações" → "Rendimento" nos dois locais mencionados, com tradução para EN e ES.

## Alterações

1. **`src/components/AdminModal.tsx`** (linhas 2471/2474)
   - Comentário `{/* SEÇÃO: Apresentações (SKUs) */}` → `{/* SEÇÃO: Rendimento */}`
   - Título visível `📦 Apresentações (SKUs)` → `📦 Rendimento`

2. **`src/locales/pt.json`** (linha 296)
   - `"presentations": "Apresentações"` → `"presentations": "Rendimento"`

3. **`src/locales/en.json`** (linha 296)
   - `"presentations": "Presentations"` → `"presentations": "Yield"`

4. **`src/locales/es.json`** (linha 296)
   - `"presentations": "Presentaciones"` → `"presentations": "Rendimiento"`

## Traduções aplicadas
| Idioma | Termo |
| --- | --- |
| PT-BR | Rendimento |
| EN | Yield |
| ES | Rendimiento |

## Fora do escopo
- Nome da tabela `resin_presentations`, estados internos `presentations` e chave i18n `presentations` permanecem (mudança é só de rótulo visível).
- `KbResinDocsDialog` ("Apresentações & Materiais") não é o card do catálogo de produto — não alterado.