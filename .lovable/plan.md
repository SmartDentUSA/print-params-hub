## Usar PDF enviado como fundo da proposta + preencher campos do distribuidor + agrupar por categoria/subcategoria

O upload `Paginafundo_porposta.pdf` (A4 portrait, 595×842 pt) tem header Smart Dent BR/USA, certificados, barras "Price Table" (topo) e footer com `WWW.SMARTDENT.COM.BR`, além dos rótulos: **Empresa, Razão Social, Contato — Responsável de Compras, E-mail, País, ID Dealer SmartDent, DATA DA PROPOSTA**.

### 1. Salvar o fundo como asset (imagem)

jsPDF não aceita PDF como imagem — precisamos rasterizar:

- Rodar `pdftoppm -png -r 200 Paginafundo_porposta.pdf` no sandbox.
- Salvar em `src/assets/proposal-bg.png`.
- Importar como `import proposalBg from "@/assets/proposal-bg.png"` e converter em dataURL memoizado.

### 2. Reescrever `exportPriceTablePdf` em portrait A4

Layout (595 × 842 pt):

```
Header do fundo (logo, endereços, certificados)      y: 0–130
Área de campos (por cima dos rótulos do fundo)       y: 130–210
Barra "Price Table" do fundo                         y: ~205
Tabela de preços (autoTable, várias páginas)         y: 225 – 760
Footer do fundo (barra + WWW.SMARTDENT.COM.BR)       y: 760–842
```

Coordenadas dos campos (a serem ajustadas visualmente conferindo o PNG):

- `Empresa:` → `x≈82, y≈154`
- `Razão Social:` → `x≈320, y≈154`
- `Contato — Responsável de Compras:` → `x≈195, y≈168`
- `E-mail:` → `x≈82, y≈182`
- `País:` → `x≈82, y≈196`
- `ID Dealer SmartDent:` → `x≈168, y≈210`
- `DATA DA PROPOSTA` → `x≈480, y≈210`

Fonte Helvetica bold 9pt cinza-escuro para os valores; `doc.splitTextToSize` para não vazar. Callback `didDrawPage` da autoTable redesenha fundo + campos em cada página nova.

### 3. Agrupar tabela por Categoria → Subcategoria

A tabela **não** pode ser uma lista corrida — agrupar por `category` e `subcategory` na ordem em que aparecem:

1. Ordenar `items` por `(category, subcategory, name)`.
2. Percorrer os items e construir chunks: para cada nova `category`, inserir uma "linha-título" tipo banner escuro com o nome da categoria (colspan em todas as colunas). Para cada nova `subcategory` dentro da categoria, inserir uma linha mais clara com o nome da subcategoria.
3. autoTable aceita isso via `body` heterogêneo com `styles.fillColor` por row. Estratégia mais limpa: **um `autoTable` por subcategoria**, usando `startY` incremental do `lastAutoTable.finalY`. Antes de cada bloco desenho manualmente:
   - Faixa da **categoria** (só na primeira subcategoria daquela categoria): retângulo cinza-escuro 1F1F1F, texto branco bold 10pt.
   - Faixa da **subcategoria**: retângulo cinza claro E5E5E5, texto preto 9pt.
4. Cada `autoTable` reusa o mesmo header ("COD, Produto, Pres #, Pres, NCM/HS, GTIN/EAN, Unid, Preço, Desc., Preço dealer"). Se ficar poluído, ligo `showHead: 'firstPage'` só no primeiro bloco e `showHead: 'never'` nos subsequentes — decidir na hora de acordo com legibilidade. Default: cabeçalho em todos os blocos, curtinho.
5. Itens sem `category` viram grupo "Outros"; sem `subcategory` viram subgrupo "Geral".
6. Ao trocar de página no meio de um grupo, o `didDrawPage` redesenha o fundo/campos; a autoTable naturalmente redesenha o header da tabela.

### 4. Campos usados (do `Distributor`)

- Empresa → `nome_fantasia`
- Razão Social → `razao_social`
- Contato → `buyer_name ?? owner_name`
- E-mail → `buyer_email ?? owner_email`
- País → `pais`
- ID Dealer SmartDent → primeiro campo existente entre `id_dealer`, `dealer_code`, `codigo_dealer`; fallback = `id.slice(0,8).toUpperCase()`
- DATA DA PROPOSTA → `list.created_at ?? now()` formatado por locale (`pt-BR`/`es-ES`/`en-US`)

### 5. Total dealer

Uma única linha `Total dealer: <valor>` alinhada à direita logo acima do rodapé (`y≈748`), depois do último grupo. Se o último grupo terminar perto do rodapé, força quebra para a próxima página antes de escrever o total (via `doc.addPage()` + `didDrawPage` do próprio jsPDF chamado manualmente).

### 6. Fora do escopo

- Exports XLSX e DOCX ficam como estão (o pedido é para o PDF).
- Não altero UI do wizard nem o modelo de dados.
- Sem cotações de câmbio, assinatura ou QR.

### Passos de implementação

1. Rasterizar `Paginafundo_porposta.pdf` → `src/assets/proposal-bg.png`.
2. Editar `src/components/smartops/distributors/DealerProposalExport.ts`:
   - Portrait A4, importar `proposalBg`, dataURL memoizado.
   - Helper `drawBackgroundAndHeader(doc, distributor, list, lang)` usado no `didDrawPage`.
   - Helper `groupByCategory(items)` que produz `[{category, subcategory, rows}]`.
   - Loop desenhando faixa de categoria/subcategoria + `autoTable` por bloco.
   - Total dealer no fim.
3. Verificar o PDF gerado com `pdftoppm` de amostra para conferir alinhamento antes de fechar.
