# 🪄 Geração Automática de Metadados por IA

## Funcionalidades

### 1. Slug (URL)
- Gerado automaticamente a partir do título
- Normalizado (lowercase, sem acentos, hífens)
- Garantia de unicidade (não duplica com artigos existentes)
- Preservado ao editar (não regenera se já existe)

### 2. Meta Description
- Gerada por IA (Google Gemini 2.5 Flash)
- Máximo 160 caracteres
- Inclui palavra-chave principal (título)
- Tom persuasivo e informativo
- Preservada ao editar (não regenera se já existe)

### 3. FAQs (10 perguntas e respostas)
- Geradas por IA com structured output
- Baseadas APENAS no conteúdo do artigo
- Perguntas naturais (como usuários pesquisam no Google)
- Respostas objetivas (50-150 palavras cada)
- Preservadas ao editar (não regeneram se já existem)

### 4. Lista de Keywords Disponíveis
- Exibe todas as keywords aprovadas do sistema (`external_links`)
- Mostra URLs associados para hyperlinks
- Visível na aba "AI Generation" (abaixo do Prompt IA)
- A IA de conteúdo usa automaticamente estas keywords

## Como Usar

### Criar Novo Artigo
1. Preencher **Título** e **Conteúdo** (ou gerar por IA)
2. Ir para aba **"SEO"**
3. Clicar em **"🪄 Gerar Campos Vazios"**
4. Verificar Slug e Meta Description gerados
5. Ir para aba **"FAQs"**
6. Clicar em **"🪄 Gerar 10 FAQs por IA"** (ou use o botão na aba SEO que gera tudo junto)
7. Revisar e ajustar FAQs se necessário
8. Salvar artigo

### Editar Artigo Existente
- **Gerar Campos Vazios**: Gera apenas campos que ainda não existem
- **Regenerar Todos**: Sobrescreve todos os campos (slug, meta, FAQs)

## Endpoints

### `ai-metadata-generator`
- **URL**: `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/ai-metadata-generator`
- **Método**: POST
- **Auth**: Requer autenticação (JWT)
- **Body**:
  ```json
  {
    "title": "string",
    "contentHTML": "string",
    "existingSlug": "string (opcional)",
    "existingMetaDesc": "string (opcional)",
    "existingFaqs": "array (opcional)",
    "regenerate": {
      "slug": "boolean",
      "metaDescription": "boolean",
      "faqs": "boolean"
    }
  }
  ```
- **Response**:
  ```json
  {
    "slug": "string",
    "metaDescription": "string",
    "faqs": [
      { "question": "string", "answer": "string" },
      ...
    ]
  }
  ```

## Regras de Negócio

1. **Primeira Geração**: Sobrescreve campos vazios
2. **Edição Manual**: Preservada ao salvar
3. **Regeneração Forçada**: Botão "Regenerar Todos" sobrescreve tudo
4. **Validação**: Título e Conteúdo obrigatórios antes de gerar
5. **Unicidade**: Slug sempre único no banco

## Custos e Performance

- **Modelo**: Google Gemini 2.5 Flash (via Lovable AI)
- **Custo por geração**: ~0.0001 USD
- **Tempo de resposta**: 3-5 segundos (slug + meta + 10 FAQs)
- **Rate limit**: 100 requests/min por workspace

## 🔗 Gerenciamento de Keywords

### Visualizar Keywords Disponíveis

As keywords aprovadas do sistema são exibidas na aba **"AI Generation"**:

1. Ir para **Adicionar Conteúdo** → Aba **"AI Generation"**
2. Localizar seção **"🔗 Palavras-chave disponíveis para hyperlinks"**
3. Clicar em **"▶ Mostrar"** para expandir a lista

A lista mostra todas as keywords aprovadas no sistema (`external_links` com `approved = true`) e suas URLs associadas. A IA de conteúdo usa automaticamente estas keywords para criar hyperlinks internos.

### Editar URLs de Keywords

As URLs das keywords podem ser editadas diretamente na interface:

1. Expandir a seção **"🔗 Palavras-chave disponíveis para hyperlinks"**
2. Passar o mouse sobre a keyword desejada
3. Clicar no ícone **✏️** (editar) que aparece ao lado da URL
4. Modificar a URL no campo de input
5. Clicar em **✓** (salvar) ou **✕** (cancelar)

**Validações**:
- URLs devem ser válidas e começar com `http://` ou `https://`
- URLs inválidas são rejeitadas automaticamente com mensagem de erro
- Apenas usuários com role `admin` podem editar URLs (protegido por RLS)

**Feedback Visual**:
- Ícone ✏️ aparece apenas no hover
- Durante o salvamento, o botão mostra ⏳ (loading)
- Toast de sucesso/erro confirma a operação
- A lista é atualizada imediatamente após salvamento

**Nota Importante**: A edição de URLs **NÃO afeta conteúdos já publicados**. Apenas novos conteúdos gerados por IA após a mudança usarão as URLs atualizadas.

**Alternativa para Edição Avançada**: Para editar outros campos da keyword (nome, keywords relacionados, categoria, etc.), use a página **"External Links"** no menu de administração.

## Integração com o Sistema

### Frontend (AdminKnowledge.tsx)
- Aba "SEO": Botões "🪄 Gerar Campos Vazios" e "🔄 Regenerar Todos"
- Aba "FAQs": Botão "🪄 Gerar 10 FAQs por IA"
- Aba "AI Generation": Lista de keywords aprovadas para hyperlinks

### Backend (Edge Function)
- `supabase/functions/ai-metadata-generator/index.ts`
- Usa Lovable AI (Google Gemini 2.5 Flash)
- Valida unicidade de slugs no banco de dados
- Retorna JSON estruturado com metadados

### Database
- Tabela `knowledge_contents`: Armazena slug, meta_description e faqs
- Tabela `external_links`: Fornece keywords para a IA de conteúdo

## Troubleshooting

### Erro: "Title and contentHTML are required"
- Certifique-se de preencher Título e Conteúdo antes de gerar metadados

### Erro: "AI API error: 429"
- Rate limit excedido. Aguarde 1 minuto e tente novamente
- Verifique créditos disponíveis no Lovable AI

### Erro: "Slug já existe"
- A edge function adiciona sufixo numérico automaticamente (-1, -2, etc.)
- Se persistir, verifique RLS policies na tabela `knowledge_contents`

### FAQs gerados não fazem sentido
- Conteúdo HTML muito curto ou sem informação relevante
- Certifique-se de ter ao menos 500 palavras de conteúdo

## Exemplos

### Request Completo
```typescript
const { data, error } = await supabase.functions.invoke('ai-metadata-generator', {
  body: {
    title: 'Como Calibrar Impressora 3D de Resina',
    contentHTML: '<h2>Introdução</h2><p>A calibração é essencial...</p>',
    regenerate: {
      slug: false,
      metaDescription: false,
      faqs: true
    }
  }
});
```

### Response Esperada
```json
{
  "slug": "como-calibrar-impressora-3d-de-resina",
  "metaDescription": "Aprenda passo a passo como calibrar sua impressora 3D de resina para obter impressões perfeitas. Guia completo com dicas profissionais.",
  "faqs": [
    {
      "question": "Como calibrar impressora 3D de resina?",
      "answer": "A calibração envolve ajustar a altura do build plate, nivelamento da mesa e tempo de exposição UV. Siga estes passos..."
    },
    ...
  ]
}
```

## Links Úteis

- [Lovable AI Documentation](https://docs.lovable.dev/features/ai)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Google Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini)
