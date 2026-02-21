
# Fluxo Guiado de Parametros na Dra. L.I.A.

## Objetivo

Quando o usuario clicar em "Quero acertar na Impressao!", ao inves de enviar a mensagem para a IA, o chat exibe um fluxo interativo 100% frontend com botoes e cards, buscando dados diretamente do Supabase:

**Marca** (botoes) -> **Modelo** (cards com imagem) -> **Resinas + Variacoes de layer height** (cards expansiveis com parametros inline)

## Fluxo Visual (conforme mockups)

1. **Selecione a Marca**: Header azul "Claro! Para te ajudar com os parametros, qual e a marca da sua impressora?" + grid de botoes com nomes das marcas (Anycubic, Creality, Elegoo, etc.)
2. **Selecione o Modelo**: Header azul "Selecione o modelo da sua impressora" + label "{Brand} Models" + grid 2 colunas de cards com thumbnail da impressora + nome
3. **Selecione a Resina e Espessura**: Header azul "Selecione a resina e a espessura das camadas" + imagem do modelo selecionado + lista de resinas, cada uma com botoes de layer height (0.05mm, 0.1mm). Ao clicar numa variacao, expande mostrando os parametros (Camadas Normais e Camadas Inferiores) inline. Clicar em outra resina colapsa a anterior.

## Detalhes Tecnicos

### Arquivo: `src/components/DraLIA.tsx`

**Novos estados**:
- `printerFlowStep`: `null | 'brand' | 'model' | 'resin'` — controla qual etapa esta ativa
- `printerFlowData`: objeto com `{ brands, models, resins, params, selectedBrand, selectedModel }` — dados carregados do Supabase
- `expandedResin`: `string | null` — qual resina esta com parametros expandidos
- `selectedLayerHeight`: `Record<string, number>` — layer height selecionado por resina

**Mudanca no `handleTopicSelect`**:
- Quando `opt.id === 'parameters'`, NAO envia mensagem para a IA
- Em vez disso, seta `printerFlowStep = 'brand'` e faz fetch das marcas via Supabase (query direta no `brands` table filtrado por marcas que existem em `parameter_sets`)
- Adiciona uma mensagem assistant com texto fixo "Claro! Para te ajudar com os parametros, qual e a marca da sua impressora?"

**Queries Supabase por etapa**:
- Marcas: `SELECT DISTINCT b.name, b.slug FROM brands b INNER JOIN parameter_sets ps ON ps.brand_slug = b.slug WHERE b.active = true AND ps.active = true ORDER BY b.name`
- Modelos (apos selecionar marca): `SELECT DISTINCT m.name, m.slug, m.image_url FROM models m INNER JOIN parameter_sets ps ON ps.model_slug = m.slug WHERE ps.brand_slug = '{brand}' AND m.active = true AND ps.active = true ORDER BY m.name`
- Resinas + Params (apos selecionar modelo): `SELECT ps.*, r.image_url as resin_image FROM parameter_sets ps LEFT JOIN resins r ON r.name = ps.resin_name WHERE ps.brand_slug = '{brand}' AND ps.model_slug = '{model}' AND ps.active = true ORDER BY ps.resin_name, ps.layer_height`

**Renderizacao condicional no chat**:
- O fluxo guiado e renderizado como um componente inline dentro do chat (apos a ultima mensagem assistant)
- Cada etapa e um bloco visual com header azul (#1e3a5f) e conteudo abaixo
- Botao "Voltar" em cada etapa para retroceder

**Componentes visuais** (inline no DraLIA.tsx, sem criar arquivos separados):

1. **BrandButtons**: grid de botoes outline com nome da marca, hover com borda azul
2. **ModelCards**: grid 2 colunas, cada card com thumbnail (48x48), nome do modelo, descricao curta
3. **ResinAccordion**: lista vertical, cada item com:
   - Thumbnail da resina (32x32)
   - Nome + fabricante
   - Botoes de layer height (pills: "0.05mm", "0.1mm")
   - Ao clicar na pill: expande abaixo mostrando parametros em 2 colunas (Camadas Normais | Camadas Inferiores)
   - Clicar em outra resina colapsa a anterior automaticamente

**Parametros exibidos** (conforme mockup):
- Camadas Normais: Altura da Camada, Tempo de Cura, Espera antes/apos cura, Intensidade da Luz, Ajuste X/Y
- Camadas Inferiores: Tempo de Adesao, Camadas base, Espera antes/apos cura base, Espera apos elevacao

### Preservacao do fluxo existente

- Os outros 3 topicos (commercial, products, support) continuam enviando mensagem para a IA normalmente
- O fluxo de lead collection (nome/email) permanece obrigatorio ANTES de mostrar os topicos
- O botao "Novo assunto" reseta o fluxo guiado tambem
- Se o usuario digitar algo no input durante o fluxo guiado, a mensagem vai para a IA normalmente (o fluxo guiado nao bloqueia o input)
