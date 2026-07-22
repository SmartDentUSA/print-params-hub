## Objetivo
Gerar `/mnt/documents/arvore-7-etapas-workflow-produtos.txt` cruzando as **7 etapas do fluxo digital** (com suas células) contra o catálogo real (`system_a_catalog` + `catalog_product_variations`), listando os produtos que existem no banco em cada célula.

## Estrutura das 7 etapas (conforme sua lista)
1. **Captura Digital** — Scanner Intraoral · Scanner Bancada · Notebook · Acessórios · Peças/Partes
2. **CAD** — Software · Créditos IA CAD · Serviço
3. **Impressão 3D** — Resina · Software · Impressora · Acessórios · Peças/Partes
4. **Pós-Impressão** — Equipamentos · Limpeza/Acabamento
5. **Finalização** — Caracterização · Instalação · Dentística/Orto
6. **Cursos** — Presencial · Online
7. **Fresagem** — Equipamentos · Software · Insumos · Serviço · Acessórios · Peças/Partes

## Fonte de dados
- `system_a_catalog` (parents ativos): `name`, `slug`, `product_category`, `product_subcategory`, `id`
- `catalog_product_variations` (join por `catalog_product_id`): `sku`, `presentation`, `color`, `gtin_ean`

## Regras de matching produto → célula
Mapeamento determinístico por nome canônico (case/acento-insensitive) contra a lista que você enviou. Para cada célula:
- Match exato pelo nome do produto.
- Fallback por prefixo/família (ex.: "Resina 3D Smart Print Bio Vitality*" → célula Resina; "SmartGum *" e "SmartMake *" → Caracterização; "Cimento UNIKK Veneer *" e "Tryin UNIKK *" → Instalação; "Resina Composta * Atos *" e "SmartOrto" → Dentística/Orto; "Blocos de Zircônia Smart Zr *" e "Fresa *" → Fresagem/Insumos).
- Produtos do catálogo que **não** casarem com nenhuma célula vão para uma seção final `⚠️ Não mapeados` (para você revisar).
- Produtos listados por você que **não existirem** no banco vão para `❌ Ausentes no banco` (dentro da célula).

## Formato do TXT
```
1 · CAPTURA DIGITAL
├── Scanner Intraoral (n produtos · v variações)
│   ├── Scanner Intraoral MEDIT i500
│   │   ├── SKU 1234 · 1un · — · GTIN …
│   │   └── (sem variações)
│   └── ❌ Ausente no banco: Scanner intraoral BLZ Leap 500
├── Scanner Bancada …
…
Rodapé:
  Totais: 7 etapas · N células · P produtos · V variações
  ⚠️ Não mapeados (no catálogo mas fora do fluxo): …
```

## Passos
1. Ler todos os parents ativos e suas variações do banco (uma query cada).
2. Em Python (script em `/tmp`), construir dicionário `célula → [produto]` aplicando os matchers acima.
3. Renderizar árvore, contar totais, listar ausentes por célula e não-mapeados globais.
4. Gravar em `/mnt/documents/arvore-7-etapas-workflow-produtos.txt` e emitir `<presentation-artifact>`.

## Nível de detalhe por variação
Compacto: `SKU · apresentação · cor · GTIN`. (Me avise se quiser incluir NCM/peso/preço BRL — fácil de adicionar.)

## Fora do escopo
- Nenhuma alteração em banco, schema ou UI.
- Nenhuma reclassificação de `product_category`/`product_subcategory` — o mapeamento fica só no TXT.
