

## Plano: Adicionar Instruções de Pré e Pós Processamento nos cards de produtos (Resinas)

### Problema
A tabela `resins` possui o campo `processing_instructions` com dados ricos em markdown para 3 resinas (Bite Splint +Flex, Vitality, Try-in Calcinável), mas a página `/support-resources` não busca nem exibe essas instruções nos cards.

### Solução

#### 1. Atualizar interface `UnifiedProduct` e fetch
- Adicionar campo `processing_instructions: string | null` à interface `UnifiedProduct`
- Na query de `resins`, incluir o campo `processing_instructions` no `.select()`
- Passar o valor ao construir o array `unified`

#### 2. Renderizar no card como Accordion
- Adicionar uma nova `AccordionItem` com value `"processing"` nos cards de resinas que tenham `processing_instructions`
- Titulo: "⚙️ Instruções de Processamento"
- Renderizar o markdown convertendo `##` em subtítulos, `•` em listas, e `>` em blocos de destaque
- Usar uma função simples de parse markdown-to-html (sem dependência externa)

### Arquivo afetado
- `src/pages/SupportResources.tsx`

