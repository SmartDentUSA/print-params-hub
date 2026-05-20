## Problema observado

Cada participante é renderizado como uma tabela com **número de células variável por linha**:

- Linha "Nome" → 3 células (label + nome + telefone)
- Linha "Nota Fiscal" → 4 células (label + NF + Cidade + Estado)
- Linha "Acompanhantes" → 7 células (label + 3 blocos de Nome/Email/Tel)
- Demais linhas → 2 células

Como o gerador atual usa `gridSpan` com células-fantasma vazias para "completar" a linha, o Word recalcula a largura dinamicamente e as linhas com mais conteúdo (Nota Fiscal e Acompanhantes) estouram as margens. Isso é exatamente o sintoma reportado: "quando há mais de uma informação na mesma linha, quebra e extrapola margens".

## Causa raiz

O DOCX foi montado **sem `<w:tblGrid>` fixo** e sem `columnWidths` consistentes. Em docx-js isso vira tabelas com largura derivada do conteúdo, e o Word redistribui colunas por linha de forma independente, gerando o overflow.

## Solução

Reescrever a edge function `smartops-gerar-doc-turma` para usar um **grid fixo de 12 colunas** (largura total = 9360 DXA, igual ao conteúdo de uma página US Letter com margens de 1") e mesclar células via `columnSpan` em cada linha, sempre fechando os 12 slots.

### Mapeamento de larguras

```text
Total da tabela: 9360 DXA (12 colunas × 780 DXA)

Linha                | label | conteúdo
---------------------|-------|----------------------------
Contrato (ID)        |  3    |  9
Nome / Tel           |  3    |  6 (nome) | 3 (tel)
Nota Fiscal/Cid/UF   |  3    |  3 (NF)  | 4 (cidade) | 2 (UF)
Responsável venda    |  3    |  9
CPF / CNPJ           |  3    |  9
Equipamentos         |  3    |  9
Insumos / Kits       |  3    |  9
Acompanhantes        |  3    |  3 + 3 + 3   (cada bloco = Nome|E-mail|Tel empilhados como parágrafos)
Observações          |  3    |  9
```

A linha "Acompanhantes" deixa de ter 7 células lado a lado (causa principal do overflow): cada bloco vira **uma célula única** com 3 parágrafos internos (Nome / E-mail / Tel), preservando a leitura mas mantendo o grid de 12 colunas.

### Detalhes técnicos (docx-js)

- `Table.width = { size: 9360, type: WidthType.DXA }`
- `Table.columnWidths = Array(12).fill(780)`
- Cada `TableCell.width = { size: 780 * span, type: WidthType.DXA }` com `columnSpan: n`
- `tableLayout: TableLayoutType.FIXED` para o Word respeitar as larguras
- Cell margins: `{ top: 80, bottom: 80, left: 120, right: 120 }`
- `ShadingType.CLEAR` para o fundo azul claro do label
- Page size US Letter explícito: `{ width: 12240, height: 15840 }`, margens 1440 DXA

### Arquivos afetados

- `supabase/functions/smartops-gerar-doc-turma/index.ts` — reescrever a função (recriar no repo se hoje só existir em produção). Recebe `?turma_id=...`, consulta inscrições + companions + equipamentos/insumos no Supabase e devolve `.docx` com `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- `src/components/GerarDocButton.tsx` — sem mudanças (continua chamando o mesmo endpoint).

### Validação

1. Após gerar o docx, rodar `python /tmp/validate_document.py` para conferir esquema OOXML.
2. Converter para PDF via LibreOffice e inspecionar página 1 para confirmar que nenhuma linha extrapola a margem direita, especialmente "Nota Fiscal" e "Acompanhantes".
3. Testar com turma que tenha participante com 3 equipamentos e 2 acompanhantes (caso João Augusto Carnielli na BLZ INO200) — esse é o pior cenário.

## Observação importante

A função `smartops-gerar-doc-turma` **não está versionada no repositório** (só `GerarDocButton.tsx` referencia ela). Vou recriar o arquivo `supabase/functions/smartops-gerar-doc-turma/index.ts` do zero, replicando a estrutura visível no DOCX atual (cabeçalho azul, tabela por participante, blocos Equipamentos/Insumos/Acompanhantes) já com o grid corrigido. Se você tiver a versão atual em outro lugar, me passe para eu preservar regras de negócio específicas (filtros, ordenação, formatação de campos).
