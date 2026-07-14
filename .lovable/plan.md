Traduzir os cabeçalhos da tabela de preço (`DealerPriceTable`) conforme o idioma selecionado no cabeçalho da lista (PT/ES/EN). Também traduzir os rótulos do painel de resumo (Moeda, Idioma, Itens, Preço tabela total, Preço dealer total, Desconto) e o nome do produto exibido (usar `name_es`/`name_en` quando disponível, com fallback para `name`).

## Escopo

Arquivo: `src/components/smartops/distributors/DealerPriceTable.tsx`

1. Criar um pequeno dicionário local `I18N` com 3 idiomas (pt/es/en) contendo:
   - Cabeçalhos da tabela: Foto, COD, Produto, Pres, NCM/HS, GTIN/EAN, Unid (×), Preço tabela (Unit), % Desc., Preço dealer (Unit), Preço dealer
   - Painel de resumo: Moeda, Idioma, Itens, Preço tabela total, Preço dealer total, Desconto
   - Histórico: Data, Rótulo, Moeda, Idioma, Itens, Total dealer, título "Histórico de cotações"
   - Botões/textos: Importar catálogo, Salvar, Salvo, Salvar no histórico, Histórico, Gerar proposta, "Selecione um distribuidor…", "Tabela vazia…", "Sem categoria", etc.

2. Ler `lang = list.language || 'pt'` e usar `t = I18N[lang] ?? I18N.pt`.

3. Substituir todas as strings hardcoded pelos valores de `t`.

4. Para o nome do produto na coluna "Produto": exibir `it.name_es`/`it.name_en` conforme idioma; se vazio, fallback para `it.name`. Ao editar, continuar atualizando `it.name` (campo canônico) — tradução só afeta exibição.

## Escopo NÃO incluso

- Não altera o export (XLSX/PDF/DOCX) — pode ser feito depois se solicitado.
- Não altera o `DealerProposalWizard` — pode ser feito depois se solicitado.
- Não altera categorias/subcategorias (vêm do catálogo, geralmente já em PT).
