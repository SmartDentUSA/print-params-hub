
## Reorganizar rodapé do `PublicTurmaCard` (`src/pages/AgendaPublica.tsx`)

Hoje a tag de produto, Vagas e Instrutor estão em três blocos empilhados. O usuário quer duas colunas: produto + instrutor à esquerda, Vagas à direita.

### Mudanças

1. Unir os blocos atuais (tags de produto, métrica Vagas e linha do instrutor) em **um único container `flex justify-between`**.
2. **Coluna esquerda**:
   - Linha 1: tag(s) de produto (`ioConnect TruAbutment`, etc.) — mantém o estilo atual.
   - Linha 2 (logo abaixo): nome do instrutor com ícone `User`, texto pequeno em `text-muted-foreground`.
3. **Coluna direita**: bloco "VAGAS" + número grande (mesmo estilo), alinhado à direita, centralizado verticalmente com a coluna esquerda.
4. Remover o bloco separado do instrutor (`mt-3 pt-3 border-t` com User + nome) que ficava abaixo do rodapé.
5. Manter o botão **Inscreva-se** abaixo, largura total.
6. Para turmas presenciais (sem tags de produto), a coluna esquerda mostra só o instrutor; Vagas continua à direita.

### Resultado visual

```text
[ ioConnect TruAbutment ]              VAGAS
 👤 Danilo Coutigi                       20

           ( INSCREVA-SE )
```

### Fora de escopo
- Header (LIVE / Turma), capa, status pill, datas e editor do curso não mudam.
- `TurmaCard` admin e `CourseCard` interno não são tocados.
