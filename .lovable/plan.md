## Diagnóstico do problema

Desempacotei o `imersao_BLZ_INO200.docx` e o `word/document.xml` tem um **mismatch entre `<w:tblGrid>` e as células** — esse é o motivo do layout quebrado:

```text
<w:tblGrid>: 3 colunas (1900 + 3946 + 3946 = 9792)

Linha header (banda azul):
  <w:tc gridSpan="2" w:w="9792">  ← ERRADO
  Diz que ocupa 2 colunas mas tem largura total da tabela (9792)
  Deveria ser gridSpan="3"

Linhas de dados (Contrato/Equipamento/Insumos):
  <w:tc w:w="1900">  +  <w:tc w:w="7892">  ← ERRADO
  Segunda célula tem 7892 mas não tem gridSpan
  Deveria ter gridSpan="2" (3946+3946=7892)
```

Word/Google Docs vê 2 células onde o grid promete 3 → recalcula larguras na marra → colunas estouram, células deslocadas, bordas mal alinhadas. É exatamente o sintoma de "layout quebrado".

## Bloqueio: o código gerador não está neste repositório

A edge function `smartops-gerar-doc-turma` **está deployada** em `okeogjgqijbfkudfjadz` (responde 401 sem auth), mas não existe em `supabase/functions/` deste projeto Lovable. Os 3 projetos Lovable acessíveis (landing-craftsman-76, dental-cad-form-submit, schedule-sync-smart-meet) também não parecem ter esse código.

## O que preciso de você

Antes de eu corrigir, me diga **onde mora o código fonte do `smartops-gerar-doc-turma`**:

1. Foi deployado manualmente no Supabase via CLI/dashboard a partir de outro repo (System A)?
2. Está em outro projeto Lovable que não está na minha lista?
3. Quer que eu **recrie a função aqui** em `supabase/functions/smartops-gerar-doc-turma/` (e nesse caso vai sobrescrever a versão atual no deploy)?

## Correção (quando eu tiver acesso ao código)

Duas opções, em ordem de preferência:

- **Opção A (recomendada): simplificar o grid pra 2 colunas reais.**
  Em vez de declarar 3 colunas no `tblGrid` e depois fazer ginástica com `gridSpan`:
  ```
  <w:tblGrid>
    <w:gridCol w:w="1900"/>
    <w:gridCol w:w="7892"/>
  </w:tblGrid>
  ```
  Header vira `gridSpan="2"` (correto: 2 de 2 colunas).
  Linhas de dados ficam naturais sem gridSpan.

- **Opção B: manter 3 colunas no grid e arrumar os spans.**
  Header: `gridSpan="3"`.
  Linhas de dados: segunda célula com `gridSpan="2"`.

A opção A é mais limpa e menos suscetível a regressão.

Me confirma onde está o código (ou autoriza recriar aqui) e eu aplico o fix.