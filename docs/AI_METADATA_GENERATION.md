# 🪄 Geração Automática de Metadados por IA

## Funcionalidades

### 1. Título
- Gerado automaticamente por IA (Google Gemini 2.5 Flash) a partir do conteúdo
- Máximo 60 caracteres
- Otimizado para SEO com palavra-chave principal
- Tom profissional e direto
- Focado em benefício ou solução clara

### 2. Resumo (Excerpt)
- Gerado automaticamente por IA (Google Gemini 2.5 Flash)
- Máximo 160 caracteres
- Complementa o título sem repetir
- Desperta interesse para leitura completa
- Tom profissional e persuasivo

### 3. Slug (URL)
- Gerado automaticamente a partir do título
- Normalizado (lowercase, sem acentos, hífens)
- Garantia de unicidade (não duplica com artigos existentes)
- Preservado ao editar (não regenera se já existe)

### 4. Meta Description
- Gerada por IA (Google Gemini 2.5 Flash)
- Máximo 160 caracteres
- Inclui palavra-chave principal (título)
- Tom persuasivo e informativo
- Preservada ao editar (não regenera se já existe)

### 5. FAQs (10 perguntas e respostas)
- Geradas por IA com structured output
- Baseadas APENAS no conteúdo do artigo
- Perguntas naturais (como usuários pesquisam no Google)
- Respostas objetivas (50-150 palavras cada)
- Preservadas ao editar (não regeneram se já existem)

### 6. Lista de Keywords Disponíveis
- Exibe todas as keywords aprovadas do sistema (`external_links`)
- Mostra URLs associados para hyperlinks
- Visível na aba "AI Generation" (abaixo do Prompt IA)
- A IA de conteúdo usa automaticamente estas keywords

## Como Usar

### Gerar Título + Resumo (NOVO ✨)
1. Preencher **Conteúdo** (ou gerar por IA)
2. Ir para aba **"Content"**
3. Clicar em **"🪄 Gerar Título + Resumo por IA"** (abaixo do campo Resumo)
4. Aguardar geração (3-5 segundos)
5. Revisar e ajustar se necessário
6. Salvar artigo

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
    "title": "string (opcional se regenerate.title = true)",
    "contentHTML": "string",
    "existingSlug": "string (opcional)",
    "existingMetaDesc": "string (opcional)",
    "existingFaqs": "array (opcional)",
    "existingTitle": "string (opcional)",
    "existingExcerpt": "string (opcional)",
    "regenerate": {
      "title": "boolean (novo)",
      "excerpt": "boolean (novo)",
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
    "title": "string (se regenerate.title = true)",
    "excerpt": "string (se regenerate.excerpt = true)",
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
- **Tempo de resposta**: 3-5 segundos (slug + meta + 10 FAQs + título + excerpt)
- **Rate limit**: 100 requests/min por workspace

## Prompts Ideais Usados

### Título (max 60 chars)
```
Você é um especialista em SEO e copywriting para conteúdo odontológico.

Crie um título altamente otimizado para SEO baseado no conteúdo fornecido.

Regras obrigatórias:
- Máximo 60 caracteres
- Incluir palavra-chave principal do conteúdo
- Tom profissional e direto
- Focado em benefício ou solução clara
- Sem emojis
- Sem pontuação excessiva (!, ?, etc)
- Deve despertar curiosidade ou resolver dúvida
- Não inventar dados não presentes no conteúdo

Conteúdo: [primeiros 800 chars do HTML]

Retorne APENAS o título, sem aspas ou formatação.
```

### Resumo/Excerpt (max 160 chars)
```
Você é um especialista em SEO e copywriting para conteúdo odontológico.

Crie um resumo (excerpt) altamente persuasivo baseado no título e conteúdo fornecidos.

Regras obrigatórias:
- Máximo 160 caracteres
- Incluir palavra-chave principal do título
- Tom profissional e claro
- Focado em despertar interesse para leitura completa
- Sem emojis
- Frase completa, não cortada
- Não inventar dados não presentes no conteúdo
- Deve complementar o título, não repetir

Título: [título do artigo]
Conteúdo: [primeiros 500 chars do HTML]

Retorne APENAS o resumo (excerpt), sem aspas ou formatação.
```

### Meta Description (max 160 chars)
```
Você é um especialista em SEO e CTR (Click-Through Rate).

Crie uma meta description altamente persuasiva para o conteúdo abaixo.

Regras obrigatórias:
- Máximo 160 caracteres
- Incluir a palavra-chave principal (o título)
- Responder à intenção de busca
- Tom profissional e claro
- Focado em benefício + propósito
- Sem emojis
- Frase completa, não cortada
- Não inventar dados não presentes no título/conteúdo
```

### FAQs (10 perguntas/respostas)
```
Você é um especialista em conteúdo odontológico e SEO orientado a perguntas frequentes (People Also Ask - Google).

Gere EXATAMENTE 10 FAQs (perguntas e respostas) com base no conteúdo fornecido.

Regras obrigatórias:
- Exatamente 10 perguntas
- Cada resposta: 50 a 150 palavras
- Perguntas naturais, como usuários perguntariam no Google
- Ordem: das mais genéricas às mais específicas
- Usar APENAS informações presentes no conteúdo
- Tom profissional, claro e educativo
- Sem inventar novos dados
- Sem adicionar estatísticas externas
- Entregar no formato especificado via function calling
```

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
- Aba "Content": Botão "🪄 Gerar Título + Resumo por IA" (novo)
- Aba "SEO": Botões "🪄 Gerar Campos Vazios" e "🔄 Regenerar Todos"
- Aba "FAQs": Botão "🪄 Gerar 10 FAQs por IA"
- Aba "AI Generation": Lista de keywords aprovadas para hyperlinks

### Backend (Edge Function)
- `supabase/functions/ai-metadata-generator/index.ts`
- Usa Lovable AI (Google Gemini 2.5 Flash)
- Funções disponíveis:
  - `generateTitle()` - Gera título otimizado (max 60 chars)
  - `generateExcerpt()` - Gera resumo persuasivo (max 160 chars)
  - `generateSlug()` - Gera slug normalizado
  - `generateMetaDescription()` - Gera meta description SEO
  - `generateKeywords()` - Extrai keywords relevantes
  - `generateFAQs()` - Gera 10 FAQs estruturados
- Valida unicidade de slugs no banco de dados
- Retorna JSON estruturado com metadados

### Database
- Tabela `knowledge_contents`: Armazena title, excerpt, slug, meta_description e faqs
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

### Request Gerar Título + Resumo (NOVO)
```typescript
const { data, error } = await supabase.functions.invoke('ai-metadata-generator', {
  body: {
    title: 'Título Temporário', // Pode ser qualquer string
    contentHTML: '<h2>Introdução</h2><p>A calibração é essencial...</p>',
    regenerate: {
      title: true,
      excerpt: true
    }
  }
});
```

### Response Título + Resumo
```json
{
  "title": "Calibração de Impressora 3D: Guia Completo",
  "excerpt": "Aprenda técnicas profissionais de calibração para impressoras 3D de resina. Evite falhas e obtenha impressões perfeitas desde a primeira tentativa.",
  "slug": "calibracao-de-impressora-3d-guia-completo",
  "metaDescription": "..."
}
```

### Request Completo (Todos os Campos)
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

### Response Esperada (Completa)
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
