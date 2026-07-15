## Objetivo

Renderizar as "Instruções de Pré/Pós-Processamento" no card da resina da Base de Conhecimento (KB → Catálogo → Resina) com o mesmo visual estruturado usado no card de Parâmetros de Impressão (seções coloridas 🔵 PRÉ / 🟢 PÓS / 🟣 extras, subseções com 🔹, notas com ⚠️ em callout âmbar, bullets/subbullets, e produtos do catálogo hiperlinkados).

Hoje o KB só mostra o texto cru com `whiteSpace: pre-wrap` em `KbTabCatalogo.tsx` (linhas 1020-1026). Já existe um parser + renderer completo em `ParameterTable.tsx` (linhas 68-283) — vamos extraí-lo em um componente compartilhado.

## Passos

1. **Criar `src/components/ProcessingInstructionsView.tsx`**
   - Mover `MarkdownElement`, `ParsedInstructions`, `parseMarkdownInstructions`, `linkifyProducts`, `renderMarkdownElement` para lá.
   - Exportar `<ProcessingInstructionsView instructions={string} />` que renderiza o mesmo bloco (blocos PRÉ / PÓS / seções extras com os mesmos ícones, classes e cores) — igual ao que está dentro do `AccordionContent` de `ParameterTable` (linhas 515-551), mas sem o Accordion (só o conteúdo, já que no KB o próprio Dialog é o container).
   - Usa `useCatalogProducts()` internamente para os hyperlinks.

2. **Refatorar `ParameterTable.tsx`**
   - Remover as funções locais duplicadas.
   - Substituir o miolo do `AccordionContent` por `<ProcessingInstructionsView instructions={processingInstructions} />`.
   - Mantém o Accordion + header "Instruções de Pré/Pós Processamento".
   - Sem mudança visual.

3. **Atualizar `src/components/knowledge/KbTabCatalogo.tsx`**
   - No `Dialog` de `procResin` (linhas 1015-1028), trocar o `<div style={{ whiteSpace: 'pre-wrap' ... }}>{procResin.processing_instructions}</div>` por `<ProcessingInstructionsView instructions={procResin.processing_instructions} />`.
   - Fallback: se o parser não encontrar nenhuma seção (`pre`, `post`, `sections` todos vazios), renderizar o texto original com `whiteSpace: pre-wrap` para não quebrar resinas cujo campo ainda não usa o formato `## PRÉ-PROCESSAMENTO / ## PÓS-PROCESSAMENTO`. Esse fallback fica dentro do próprio `ProcessingInstructionsView`.

## Detalhes técnicos

- Nenhuma mudança de dados/DB. Fluxo de tradução `useCardTranslations` continua injetando `processing_instructions` no idioma correto antes do componente renderizar.
- `useCatalogProducts` já é usado em `ParameterTable`; reutilizar sem novas queries.
- Sem alteração no dialog trigger, título, tamanho ou no modo de abertura.
- Classes Tailwind/tokens iguais aos do ParameterTable — herdam o tema atual do KB automaticamente.

## O que NÃO muda

- Layout do card do parâmetro de impressão.
- Estrutura do KB (abas, listagem, outros dialogs de specs/docs/sheet).
- Hooks de tradução, edge functions, schema.
