## Goal

Make the cards do Catálogo (aba `/base-conhecimento?tab=catalogo`) mostrarem, para cada produto que é uma **Resina**, todas as informações que já existem no admin "Editar Resina":

1. **Documentos técnicos** completos (FDS, IFU, Certificados, Laudos, Apresentações em PDF, Guias) — hoje só FDS/IFU/Guia/Perfil aparecem via `catalog_documents`, faltando todos os PDFs cadastrados em `resin_documents`.
2. **Apresentações (SKUs)** — tabela `resin_presentations` (label + preço), hoje não aparece no card.
3. **Instruções de Pré e Pós Processamento** — campo `resins.processing_instructions`, hoje só acessível abrindo o modal "Parametrização".

## Mudanças (somente frontend)

### `src/components/knowledge/KbTabCatalogo.tsx`

1. **Buscar `id` da resina** no SELECT de `resins` (hoje só puxa name/slug/ctas). Guardar `resin.id` no `ResinInfo`.
2. **Carregar `resin_documents`** em paralelo (filtrando `active=true`, ordenado por `order_index`). Indexar por `resin_id` num `Map<string, ResinDoc[]>`.
3. **Carregar `resin_presentations`** em paralelo (todas, ordenado por `sort_order`). Indexar por `resin_id` num `Map<string, ResinPresentation[]>`.
4. **No render do card**, quando o produto casa com uma resina (já existe via `resinKey`):
   - Adicionar botões para **todos** os `resin_documents` da resina, classificados por `document_category`/nome (Certificado, Laudo, Apresentação, FDS, IFU, Guia, etc.) com ícones diferenciados. Deduplicar contra FDS/IFU já mostrados via CTA da resina para não duplicar.
   - Adicionar bloco compacto de **Apresentações (SKUs)**: listar `label` + `price` formatado (R$), até N itens, com um "ver mais" se passar.
   - Se `processing_instructions` existir, mostrar um botão extra **"🧪 Pré/Pós-Processamento"** que abre um pequeno dialog (ou expande inline) com o conteúdo renderizado (texto/markdown leve — pode reaproveitar o parser já usado em `ResinAccordion`).
5. Manter o botão **📖 Parametrização** como hoje (abre `KbResinSheetDialog`).
6. Não alterar produtos não-resina — toda lógica nova é guardada por `if (resin) { ... }`.

### Sem mudanças em backend

Tabelas `resins`, `resin_documents`, `resin_presentations` já têm RLS pública de leitura (são usadas no site público). Nada de migrations.

## Detalhes técnicos

- Novo tipo `ResinDoc { name, url, category, kind }` e `ResinPresentation { label, price }`.
- Classificador estendido: além de FDS/IFU/GUIA/PERFIL, reconhecer CERTIFICADO, LAUDO, APRESENTACAO (PPT/PDF), MSDS, RELATORIO.
- Ícones: 📄 FDS, 📘 IFU, 📗 Guia, 📋 Perfil, 🏅 Certificado, 🧪 Laudo, 🎯 Apresentação, 📎 Outros.
- Botões mantêm o estilo `kb-action-btn` atual; lista pode quebrar em múltiplas linhas (já tem `flexWrap`).
- Dedup: se um `resin_documents` for kind `FDS` e já existe `resin.cta_2_url` apontando pra um FDS, mostrar só uma vez (preferir o do `resin_documents` por ter nome descritivo).
- Apresentações: render como chips pequenos `Frasco 500g — R$ 250,00`, máx 4 visíveis com "+N".
- Pré/Pós: novo componente leve `KbProcessingDialog` (ou reaproveitar `Dialog` já importado) — alternativa simples: collapsible inline com `<details>`.

## O que NÃO muda

- Aba Resinas (que já mostra tudo).
- Cards de produtos não-resina.
- Admin / schema / edge functions.
- Mecânica de matching resin↔catalog (já corrigida com `resinKey`).
