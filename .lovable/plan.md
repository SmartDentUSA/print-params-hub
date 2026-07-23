## Objetivo

Ajustar `src/components/smartops/ProfessionalMixSummary.tsx` para que o MIX seja apresentado exatamente no formato das imagens enviadas — sem mudar as fontes de dados, sem novos campos editáveis e sem tocar em regras de negócio.

## Mudanças

1. **Promover a tabela "Equipamentos e software" para o topo da seção**, imediatamente após o cabeçalho (badge de expertise + stats). Ela passa a ser o bloco principal do MIX.

2. **Ordem fixa de categorias na tabela** (conforme imagens):
   1. Scanner intraoral
   2. Dispositivos
   3. Impressora 3D
   4. Pós-impressão — Wash & Cure
   5. Pós-impressão — Cura profissional
   6. CAD

3. **Sempre renderizar as 6 linhas de categoria**, mesmo sem histórico. Quando vazia, "Produtos adquiridos" mostra "Sem histórico" e as demais colunas ficam com "—". Isso deixa o layout idêntico ao normativo (imagem 1 e 2).

4. **Coluna "Origem"** com regra confirmada:
   - `Histórico de compras` para itens de e-commerce faturado.
   - `Proposta ganha` para itens vindos apenas de deals ganhos no CRM.
   - Categoria CAD: quando derivado automaticamente das regras (Medit Clinic App / BLZdental Lite CAD), rotular `Automático`; quando o vendedor digitou no campo CAD, rotular `Manual`.

5. **Remover o bloco antigo "Equipamentos" (cards com % do mix)** — redundante com a tabela normativa. O campo de input CAD (edição manual com botão de lápis) é movido para dentro da célula "Produtos adquiridos" da linha CAD quando não há histórico, preservando a função de edição existente.

6. **Manter a seção "Consumíveis"** logo abaixo da tabela, sem alterações (não aparece nas imagens, mas o usuário pediu apenas reordenar/estilizar — não remover consumíveis).

7. **Estilo**: cabeçalho da tabela em `bg-muted/40`, tipografia levemente maior (`text-sm` no corpo), `rowSpan` na coluna Categoria (já existe), separadores sutis entre grupos de categoria, badges de Origem discretos. Sem mudar cores da marca.

## Fora do escopo

- Não alterar queries, classificação de produtos, cálculo de expertise, i18n ou schema.
- Não transformar linhas em inputs editáveis.
- Não mexer em `CoursesProfessionalProfile.tsx` nem em `CoursesPage.tsx`.
