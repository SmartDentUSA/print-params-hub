

# Fluxo Interativo de Produtos na Dra. L.I.A.

## Objetivo
Quando o usuario seleciona a rota "Quero conhecer mais dos produtos", apos a coleta/verificacao do e-mail, mostrar cards interativos de produtos agrupados por categoria (igual ao fluxo de "acertar a impressao"), e quando o usuario selecionar um produto, a IA usa as informacoes do produto para responder.

## Arquitetura do Fluxo

```text
Usuario seleciona "Produtos"
  -> Backend pede e-mail (ja implementado)
  -> E-mail verificado / lead reconhecido
  -> "Em relacao a qual produto voce precisa de ajuda?"
  -> Frontend: mostra cards de categorias (RESINAS 3D, IMPRESSAO 3D, SCANNERS 3D, etc.)
  -> Usuario clica numa categoria
  -> Frontend: mostra cards dos produtos daquela categoria (com imagem + nome)
  -> Usuario clica num produto
  -> Frontend envia mensagem automatica: "Quero saber mais sobre [nome do produto]"
  -> Backend: usa descricao, processing_instructions, documentos do produto para responder
```

## Categorias de Produtos no Banco (system_a_catalog + resins)
- RESINAS 3D (Biocompativeis / Uso Geral) - 14 produtos
- IMPRESSAO 3D (Impressoras / Acessorios) - 6 produtos
- SCANNERS 3D (IOS / Bancada / Acessorios) - 8 produtos
- POS-IMPRESSAO (Cura / Acabamento) - 8 produtos
- CARACTERIZACAO (SmartGum / SmartMake) - 27 produtos
- DENTISTICA (Resinas Compostas / Cimentos) - 46 produtos
- SOFTWARES (exocad) - 2 produtos
- SOLUCOES (Chair Side Print) - 1 produto

## Mudancas Tecnicas

### 1. Novo Componente: `src/components/ProductsFlow.tsx`
Componente interativo (similar ao PrinterParamsFlow) com 3 etapas:

**Etapa 1 - Categorias:** Grid de botoes com as categorias de produto (ex: "RESINAS 3D", "IMPRESSAO 3D", "SCANNERS 3D"). Busca do `system_a_catalog` agrupando `product_category` distintos.

**Etapa 2 - Produtos da Categoria:** Cards com imagem + nome de cada produto na categoria selecionada. Busca do `system_a_catalog` filtrado por `product_category`. Tambem inclui resinas do tabela `resins` quando a categoria for "RESINAS 3D".

**Etapa 3 - Produto Selecionado:** Ao clicar num produto, dispara `onProductSelect(productName)` que o DraLIA vai usar para enviar como mensagem ao backend.

Dados por produto no card:
- `image_url` (thumbnail)
- `name`
- `product_subcategory` (badge)

### 2. Alterar `src/components/DraLIA.tsx`

**Novos estados:**
- `productsFlowStep`: `'category' | 'products' | null` - controla se o fluxo de produtos esta ativo
- Importar o novo componente `ProductsFlow`

**Interceptar rota "products":**
No `handleTopicSelect`, quando `opt.id === 'products'`:
- Similar ao que ja faz com `parameters` (intercepta no frontend)
- Setar `productsFlowStep = 'category'`
- NAO enviar mensagem ao backend ainda (o backend ja vai pedir e-mail)

**Ativar fluxo apos lead confirmado:**
Apos a deteccao de lead (quando `leadCollected` se torna `true` e `topicContext === 'products'`):
- Setar `productsFlowStep = 'category'`
- Isso vai mostrar os cards de categoria

**Renderizar ProductsFlow:**
Na area de mensagens (junto ao PrinterParamsFlow), renderizar:
```tsx
{productsFlowStep && topicContext === 'products' && (
  <ProductsFlow
    step={productsFlowStep}
    onStepChange={setProductsFlowStep}
    onProductSelect={(productName) => {
      setProductsFlowStep(null); // fecha o fluxo
      setInput(`Quero saber mais sobre ${productName}`);
      // disparar envio automatico
    }}
  />
)}
```

**Callback onProductSelect:**
Quando o usuario seleciona um produto, envia automaticamente uma mensagem ao backend: "Quero saber mais sobre [Nome do Produto]". O backend ja tem RAG que busca em `system_a_catalog` e `resins` por embeddings/ILIKE, entao vai retornar as informacoes do produto (descricao, instrucoes de processamento, links de documentos).

### 3. Alterar `supabase/functions/dra-lia/index.ts`

**Modificar mensagem RETURNING_LEAD e LEAD_CONFIRMED para rota products:**
Quando `topic_context === 'products'`, a mensagem de confirmacao de lead deve terminar com:
"Em relacao a qual produto voce precisa de ajuda?"
(em vez do generico "Como posso te ajudar hoje?")

Isso sera feito adicionando uma condicional apos a deteccao de lead:
- Se `topic_context === 'products'` no body da request, a mensagem final muda para incluir "Em relacao a qual produto voce precisa de ajuda?"
- O `topic_context` ja e enviado no body pelo frontend

**Garantir que RAG funciona para produtos:**
O sistema ja busca em `system_a_catalog` via embeddings (`agent_embeddings` com `source_type = 'catalog_product'`). O TOPIC_WEIGHTS ja prioriza `catalog_product` e `resin` quando `topic_context === 'products'`. Nenhuma mudanca necessaria no RAG.

### 4. Fluxo Completo Esperado

1. Usuario clica "Quero conhecer mais dos produtos"
2. Frontend envia mensagem ao backend -> Backend pede e-mail
3. Usuario digita e-mail -> Backend verifica lead
4. Backend retorna: "Que bom te ver de novo, Danilo! Em relacao a qual produto voce precisa de ajuda?"
5. Frontend detecta `leadCollected = true` + `topicContext === 'products'` -> mostra grid de categorias
6. Usuario clica "RESINAS 3D"
7. Frontend mostra cards de resinas (com imagem + nome)
8. Usuario clica "Resina 3D Smart Print Bio Vitality"
9. Frontend envia: "Quero saber mais sobre Resina 3D Smart Print Bio Vitality"
10. Backend usa RAG para buscar info -> responde com descricao, instrucoes, links

