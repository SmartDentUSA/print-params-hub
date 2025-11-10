# Data Export API - Documentação Completa

## 📋 Visão Geral

O endpoint `/data-export` exporta **todos os dados completos** do **Sistema B (técnico)** e **Sistema A (comercial)** em formato estruturado para consumo por IA de atendimento, sincronização com sistemas externos, ou análise de dados.

### 🔄 Integração: Sistema A + Sistema B

- **Sistema B (Técnico)**: Brands, models, parameter_sets, resinas técnicas, base de conhecimento
- **Sistema A (Comercial)**: Produtos comerciais, depoimentos, reviews, KOLs, perfil da empresa (~284 registros)
- **API Unificada**: Um único endpoint retorna ambos sistemas em formato normalizado

---

## 🔗 Endpoint

```
GET https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export
```

---

## 🔓 Autenticação

❌ **Não requer autenticação** (endpoint público)

O endpoint retorna apenas dados ativos e aprovados (`active=true`, `approved=true`).

---

## 📊 Dados Exportados (12 Entidades)

### 1. **Brands** (Marcas de Impressoras)
- `id`, `name`, `slug`, `logo_url`, `active`
- `models_count` (quando `denormalize=true`)

### 2. **Models** (Modelos de Impressoras)
- `id`, `name`, `slug`, `brand_id`, `image_url`, `notes`, `active`
- `brand_name`, `brand_slug` (desnormalizado)

### 3. **Parameter Sets** (Parâmetros de Impressão)
- `id`, `brand_slug`, `model_slug`, `resin_name`, `resin_manufacturer`
- Parâmetros técnicos: `layer_height`, `cure_time`, `bottom_cure_time`, `lift_distance`, etc.

### 4. **Resins** (Resinas)
- `id`, `name`, `manufacturer`, `slug`, `description`, `price`, `type`, `color`, `image_url`
- SEO: `seo_title_override`, `meta_description`, `og_image_url`, `canonical_url`, `keywords[]`
- CTAs: `cta_1_label`, `cta_1_url`, `cta_1_description` (até 3 CTAs)
- `keyword_ids[]`, `keywords_data[]` (quando `denormalize=true`)
- `parameter_sets_count`, `public_url` (quando `denormalize=true`)

### 5. **Knowledge Categories** (Categorias A-Z)
- `id`, `name`, `letter`, `enabled`, `order_index`
- `contents_count` (quando `denormalize=true`)

### 6. **Knowledge Contents** (Artigos)
- `id`, `title`, `slug`, `excerpt`, `content_html`, `content_text` (quando `extract_text=true`)
- `category_id`, `category_name`, `category_letter` (desnormalizado)
- `author_id`, `author_name`, `author_specialty`, `author_photo_url`, `author_social_links` (quando `denormalize=true`)
- `content_image_url`, `content_image_alt`, `meta_description`, `keywords[]`
- `videos[]` (array de vídeos desnormalizados com `embed_url`)
- `faqs[]` (perguntas e respostas)
- `recommended_resins[]`, `recommended_resins_data[]` (quando `denormalize=true`)
- `keyword_ids[]`, `keywords_data[]` (quando `denormalize=true`)
- `file_url`, `file_name` (download)
- `public_url`, `seo_proxy_url`

### 7. **Knowledge Videos** (Vídeos)
- `id`, `content_id`, `content_title`, `title`, `url`, `embed_url`, `order_index`

### 8. **External Links** (Keywords para SEO)
- `id`, `name`, `url`, `description`, `category`, `subcategory`
- `keyword_type`, `search_intent`, `monthly_searches`, `cpc_estimate`, `competition_level`
- `relevance_score`, `related_keywords[]`, `source_products[]`
- `approved`, `ai_generated`, `usage_count`, `last_used_at`

### 9. **Authors** (Autores)
- `id`, `name`, `specialty`, `photo_url`, `mini_bio`, `full_bio`
- Redes sociais: `lattes_url`, `website_url`, `instagram_url`, `youtube_url`, `facebook_url`, `linkedin_url`, `twitter_url`, `tiktok_url`
- `articles_count` (quando `denormalize=true`)

### 10. **System A Catalog** 🆕 (Catálogo Comercial)

Dados sincronizados do Sistema A (plataforma comercial). Total: ~284 registros.

### 11. **Resin Documents** 🆕 (Documentação Técnica)
- `id`, `resin_id`, `resin_name`, `resin_manufacturer`, `resin_slug` (relacionamento desnormalizado)
- `document_name` (nome do documento técnico)
- `document_description` (descrição do documento)
- `file_name` (nome do arquivo: ex. "datasheet.pdf")
- `file_url` (URL pública para download)
- `file_size` (tamanho em bytes)
- `order_index` (ordem de exibição)
- `public_document_url` (link direto para download)
- `resin_page_url` (link para página da resina no site)
- `active` (se o documento está ativo)

### 12. **Product Videos** 🆕 (Vídeos do PandaVideo Vinculados a Produtos)
- `id`, `pandavideo_id`, `pandavideo_external_id`
- **Produto vinculado**: `product_id`, `product_name`, `product_slug`, `product_category`, `product_subcategory`, `product_external_id`, `product_page_url`
- **Dados do vídeo**: `title`, `description`, `video_duration_seconds`
- **URLs PandaVideo**: `embed_url`, `hls_url`, `thumbnail_url`, `preview_url`
- **Campos personalizados**: `panda_custom_fields` (objeto JSON com campos customizados do PandaVideo)
- **Tags**: `panda_tags[]`
- **Transcrição**: `video_transcript` (texto extraído do vídeo)
- **Status**: `product_match_status` (matched/pending)
- **Metadata**: `folder_id`, `order_index`, `created_at`

**Categorias:**
- `company_info`: Perfil da empresa (1 registro)
- `category_config`: Configurações de categorias SEO (~25 registros)
- `resin`: Resinas comerciais com preços/cupons (~5 registros)
- `printer`: Impressoras 3D para venda
- `accessory`: Acessórios e ferramentas
- `video_testimonial`: Depoimentos em vídeo de clientes (~203 registros)
- `google_review`: Avaliações do Google (~45 registros)
- `kol`: Key Opinion Leaders (influenciadores/especialistas) (~12 registros)
- `landing_page`: Landing pages de marketing

**Campos Principais:**
- `external_id` (ID único do Sistema A)
- `source` (sempre 'system_a')
- `category` (uma das categorias acima)
- `name`, `slug`, `description`
- `image_url`, `price`, `promo_price`, `currency`
- `seo_title_override`, `meta_description`, `canonical_url`, `og_image_url`
- `keywords[]`, `keyword_ids[]`
- `cta_1/2/3_label`, `cta_1/2/3_url`, `cta_1/2/3_description`
- `rating`, `review_count`
- `approved`, `active`, `display_order`
- `extra_data` (JSONB com dados detalhados: videos, depoimentos, especificações, etc.)

**Separação Sistema A vs Sistema B:**
- ✅ **Resinas do Sistema B** (`resins`): Dados técnicos/editoriais (tipo, cor, parâmetros)
- ✅ **Resinas do Sistema A** (`system_a_catalog.resin`): Dados comerciais (preço, promoção, cupons)
- ✅ **Ambos podem coexistir** para a mesma resina (perfil técnico + perfil comercial)

---

## 🎛️ Parâmetros Query String

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `format` | `'full'` \| `'compact'` \| `'ai_ready'` | `'full'` | Formato de resposta |
| `include_brands` | `boolean` | `true` | Incluir marcas |
| `include_models` | `boolean` | `true` | Incluir modelos |
| `include_parameters` | `boolean` | `true` | Incluir parâmetros de impressão |
| `include_resins` | `boolean` | `true` | Incluir resinas |
| `include_knowledge` | `boolean` | `true` | Incluir base de conhecimento (artigos + vídeos) |
| `include_categories` | `boolean` | `true` | Incluir categorias KB |
| `include_keywords` | `boolean` | `true` | Incluir keywords SEO |
| `include_authors` | `boolean` | `true` | Incluir autores |
| `include_system_a` | `boolean` | `true` | Incluir catálogo comercial Sistema A (~284 registros) |
| `include_resin_documents` | `boolean` | `true` | Incluir documentos técnicos das resinas (PDFs, datasheets) |
| `include_catalog_documents` | `boolean` | `false` | Incluir documentos dos produtos do catálogo (manuais, especificações) |
| `include_product_videos` | `boolean` | `false` | Incluir vídeos do PandaVideo vinculados a produtos |
| `denormalize` | `boolean` | `true` | Expandir relacionamentos (IDs → objetos completos) |
| `extract_text` | `boolean` | `true` | Extrair texto puro do HTML (`content_html` → `content_text`) |
| `approved_only` | `boolean` | `true` | Apenas itens ativos/aprovados |
| `limit_contents` | `number` | `null` | Limitar quantidade de artigos (null = todos) |
| `with_stats` | `boolean` | `true` | Incluir estatísticas agregadas |

---

## 📦 Formatos de Resposta

### 1. `format=full` (Padrão)

Retorna **todos os dados completos** com desnormalização ativada.

**Tamanho:**
- Sem Sistema A: ~15-30 MB
- Com Sistema A: ~30-50 MB (inclui 284 registros comerciais)

**Uso:** Sincronização completa, backup, análise detalhada

```json
{
  "success": true,
  "timestamp": "2025-10-21T12:00:00Z",
  "format": "full",
  "stats": {
    "brands": 15,
    "models": 45,
    "parameter_sets": 230,
    "resins": 85,
    "knowledge_categories": 4,
    "knowledge_contents": 32,
    "knowledge_videos": 18,
    "keywords": 150,
    "authors": 3,
    "system_a_catalog": 284,
    "system_a_products": 5,
    "resin_documents": 47,
    "total_html_size_mb": "12.5"
  },
  "data": {
    "brands": [...],
    "models": [...],
    "parameter_sets": [...],
    "resins": [...],
    "knowledge_categories": [...],
    "knowledge_contents": [...],
    "knowledge_videos": [...],
    "keywords": [...],
    "authors": [...],
    "system_a_catalog": {
      "items": [...],
      "grouped": {
        "company_info": [...],
        "category_config": [...],
        "resin": [...],
        "printer": [...],
        "video_testimonial": [...],
        "google_review": [...],
        "kol": [...]
      },
      "stats": {
        "total": 284,
        "resins": 5,
        "testimonials": 203,
        "reviews": 45,
        "kols": 12
      }
    }
  }
}
```

---

### 2. `format=compact`

Remove campos redundantes e desnormalizações para reduzir tamanho.

**Tamanho:** ~2-5 MB  
**Uso:** Indexação, listagens, aplicações móveis

```json
{
  "success": true,
  "timestamp": "2025-10-21T12:00:00Z",
  "format": "compact",
  "data": {
    "brands": [
      {
        "id": "uuid",
        "name": "Anycubic",
        "slug": "anycubic",
        "logo_url": "https://...",
        "active": true
      }
    ],
    "models": [
      {
        "id": "uuid",
        "name": "Photon M3",
        "slug": "photon-m3",
        "brand_id": "uuid",
        "brand_name": "Anycubic",
        "brand_slug": "anycubic",
        "active": true
      }
    ],
    "knowledge_contents": [
      {
        "id": "uuid",
        "title": "Como Escolher Resina",
        "slug": "como-escolher-resina",
        "excerpt": "...",
        "category_id": "uuid",
        "keyword_ids": ["uuid1", "uuid2"],
        "public_url": "https://..."
      }
    ]
  }
}
```

---

### 3. `format=ai_ready` ⭐ (Otimizado para IA)

Formata dados especificamente para consumo por LLMs (ChatGPT, Claude, etc.).

**Tamanho:**
- Sem Sistema A: ~20-50 MB (com texto extraído)
- Com Sistema A: ~35-70 MB (inclui 284 registros comerciais com `extra_data` detalhado)

**Uso:** RAG (Retrieval-Augmented Generation), chatbots, assistentes virtuais

**Características:**
- ✅ Extrai texto puro de HTML (`content_text`)
- ✅ Agrupa dados por contexto semântico (técnico vs. comercial)
- ✅ Traduz campos para português
- ✅ Inclui contexto da empresa
- ✅ Desnormaliza todos os relacionamentos
- ✅ **NOVO**: Inclui `catalogo_sistema_a` com produtos, depoimentos, reviews, KOLs

```json
{
  "success": true,
  "timestamp": "2025-10-21T12:00:00Z",
  "format": "ai_ready",
  "stats": { ... },
  "context": {
    "company": "Smart Dent",
    "domain": "Impressão 3D Odontológica",
    "website": "https://parametros.smartdent.com.br",
    "last_sync": "2025-10-21T12:00:00Z"
  },
  "data": {
    "parametrizacao": {
      "marcas": [...],
      "modelos": [...],
      "parametros": [...]
    },
    "produtos": {
      "resinas": [
        {
          "id": "uuid",
          "nome": "Smart Print Model Plus",
          "fabricante": "Smart Dent",
          "descricao": "...",
          "tipo": "standard",
          "preco": 299.90,
          "palavras_chave": ["resina", "odontologia"],
          "keywords_detalhadas": [
            {
              "id": "uuid",
              "nome": "resina odontológica",
              "buscas_mensais": 1200
            }
          ],
          "cta_principal": {
            "label": "Comprar Agora",
            "url": "https://...",
            "descricao": "Compre com 10% de desconto"
          },
          "url_publica": "https://parametros.smartdent.com.br/resina/smart-print-model-plus"
        }
      ]
    },
    "conhecimento": {
      "categorias": [...],
      "artigos": [
        {
          "id": "uuid",
          "titulo": "Como Escolher a Melhor Resina para Odontologia",
          "slug": "como-escolher-melhor-resina-odontologia",
          "categoria": "Adesivos",
          "categoria_letra": "A",
          "resumo": "Guia completo para escolher resinas...",
          "conteudo_texto": "Texto puro extraído do HTML (10-50kb)...",
          "autor": {
            "id": "uuid",
            "nome": "Dr. João Silva",
            "especialidade": "Odontologia Digital",
            "foto": "https://...",
            "redes_sociais": {
              "instagram": "https://...",
              "youtube": "https://..."
            }
          },
          "videos": [
            {
              "id": "uuid",
              "titulo": "Tutorial Completo",
              "url": "https://youtube.com/watch?v=...",
              "embed_url": "https://youtube.com/embed/..."
            }
          ],
          "faqs": [
            {
              "question": "Qual a melhor resina para modelos?",
              "answer": "A Smart Print Model Plus oferece..."
            }
          ],
          "resinas_recomendadas": [
            {
              "id": "uuid",
              "nome": "Smart Print Model Plus",
              "fabricante": "Smart Dent",
              "imagem": "https://...",
              "link": "https://...",
              "preco": 299.90
            }
          ],
          "url_publica": "https://parametros.smartdent.com.br/base-conhecimento/a/como-escolher-melhor-resina"
        }
      ]
    },
    "keywords": {
      "seo": [
        {
          "id": "uuid",
          "nome": "impressão 3D odontológica",
          "intencao_busca": "informacional",
          "buscas_mensais": 5400,
          "pontuacao_relevancia": 95
        }
      ]
    },
    "autores": [...],
    "catalogo_sistema_a": {
      "estatisticas": {
        "total": 284,
        "resins": 5,
        "testimonials": 203,
        "reviews": 45,
        "kols": 12
      },
      "perfil_empresa": [
        {
          "id": "uuid",
          "nome": "Smart Dent",
          "descricao": "Especialista em impressão 3D odontológica",
          "url_canonica": "https://smartdent.com.br",
          "dados_completos": {
            "corporate": { "mission": "...", "vision": "..." },
            "contact": { "email": "...", "phone": "...", "whatsapp": "..." },
            "seo": { "competitive_advantages": [...] }
          }
        }
      ],
      "configuracoes_categorias": [
        {
          "categoria": "Resinas",
          "palavras_chave": ["resina odontológica", "resina 3d"],
          "dados_adicionais": { "market_keywords": [...] }
        }
      ],
      "resinas_3d": [
        {
          "id": "uuid",
          "external_id": "product_123",
          "nome": "Resina NextDent C&B",
          "slug": "nextdent-c-b",
          "descricao": "Resina para coroas e pontes...",
          "imagem": "https://...",
          "preco": 450.00,
          "preco_promocional": 399.00,
          "moeda": "BRL",
          "palavras_chave": ["resina odontológica", "c&b"],
          "ctas": {
            "cta1": {
              "label": "Comprar no WhatsApp",
              "url": "https://wa.me/...",
              "descricao": "Fale conosco e ganhe 10% de desconto"
            },
            "cta2": {
              "label": "Ver no Site",
              "url": "https://smartdent.com.br/produto/..."
            }
          },
          "dados_completos": {
            "sales_pitch": "A melhor resina para coroas e pontes...",
            "benefits": ["Alta precisão", "Biocompatível", "Fácil acabamento"],
            "videos": {
              "youtube": ["https://youtube.com/..."],
              "testimonials": ["https://youtube.com/..."]
            },
            "google_merchant": {
              "ean": "7891234567890",
              "brand": "NextDent",
              "availability": "in_stock"
            },
            "coupons": [
              { "code": "PROMO10", "discount": 10, "type": "percentage" }
            ]
          }
        }
      ],
      "impressoras_3d": [{ ... }],
      "acessorios": [{ ... }],
      "depoimentos_video": [
        {
          "id": "uuid",
          "external_id": "testimonial_456",
          "cliente": "Dr. Maria Santos",
          "depoimento": "A resina é excelente! Uso há 2 anos e...",
          "imagem": "https://img.youtube.com/vi/.../maxresdefault.jpg",
          "avaliacao": 4.8,
          "dados_completos": {
            "client": {
              "profession": "Dentista",
              "specialty": "Ortodontia",
              "location": "São Paulo, SP"
            },
            "media": {
              "youtube_url": "https://youtube.com/watch?v=...",
              "instagram_url": "https://instagram.com/p/..."
            },
            "ai_analysis": {
              "sentiment_score": 0.96,
              "keywords": ["qualidade", "precisão", "recomendo"],
              "extracted_benefits": ["Fácil de usar", "Resultado perfeito"]
            }
          }
        }
      ],
      "avaliacoes_google": [
        {
          "id": "uuid",
          "autor": "João Silva",
          "avaliacao_texto": "Atendimento excelente! Produto chegou rápido.",
          "nota": 5.0
        }
      ],
      "lideres_opiniao": [
        {
          "id": "uuid",
          "nome": "Dr. Pedro Oliveira",
          "mini_cv": "20 anos de experiência em odontologia digital",
          "foto": "https://..."
        }
      ]
    }
  }
}
```

---

### Estrutura Completa dos Parâmetros Técnicos (formato ai_ready)

Cada registro em `parametrizacao.parametros` contém **17 campos técnicos completos** com nomes em português e unidades explícitas:

#### Identificação
- `id`: UUID único do registro
- `marca`: Slug da marca (ex: "elegoo")
- `modelo`: Slug do modelo (ex: "mars-5-ultra")
- `resina_nome`: Nome completo da resina (ex: "Smart Print Bio Vitality")
- `resina_fabricante`: Fabricante da resina (ex: "Smart Dent")

#### Parâmetros de Camada
- `altura_camada_mm`: Altura de cada camada em milímetros (ex: 0.05)
- `tempo_cura_segundos`: Tempo de exposição UV por camada em segundos (ex: 1.0)
- `tempo_cura_base_segundos`: Tempo de exposição nas camadas iniciais de base em segundos (ex: 30.0)
- `camadas_base`: Número de camadas de base para aderência à plataforma (ex: 8)

#### Parâmetros de Luz
- `intensidade_luz_percentual`: Potência da fonte UV em percentual (ex: 100)
- `anti_aliasing`: Suavização de bordas (true/false)

#### Parâmetros de Movimento
- `distancia_elevacao_mm`: Altura de afastamento da resina após cura em milímetros (ex: 5.0)
- `velocidade_elevacao_mm_s`: Velocidade ao subir a plataforma em mm/s (ex: 3.0)
- `velocidade_retracao_mm_s`: Velocidade ao descer a plataforma em mm/s (ex: 3.0)

#### Ajustes Dimensionais
- `ajuste_xy_x_percentual`: Compensação dimensional no eixo X em percentual (ex: 100)
- `ajuste_xy_y_percentual`: Compensação dimensional no eixo Y em percentual (ex: 100)
- `compensacao_xy_mm`: Ajuste fino XY em milímetros (ex: 0.0)

#### Tempos de Espera
- `tempo_espera_antes_cura_segundos`: Pausa antes da exposição UV em segundos (ex: 0)
- `tempo_espera_depois_cura_segundos`: Pausa após exposição UV em segundos (ex: 0)
- `tempo_espera_apos_elevacao_segundos`: Pausa após movimento da plataforma em segundos (ex: 0)

#### Metadados
- `observacoes`: Notas e recomendações técnicas (texto livre)
- `ativo`: Status do parâmetro (true/false)
- `criado_em`: Data de criação do registro (ISO 8601)
- `atualizado_em`: Data da última atualização (ISO 8601)

**Exemplo de registro completo:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "marca": "elegoo",
  "modelo": "mars-5-ultra",
  "resina_nome": "Smart Print Bio Vitality",
  "resina_fabricante": "Smart Dent",
  "altura_camada_mm": 0.05,
  "tempo_cura_segundos": 1.0,
  "tempo_cura_base_segundos": 30.0,
  "camadas_base": 8,
  "intensidade_luz_percentual": 100,
  "anti_aliasing": true,
  "distancia_elevacao_mm": 5.0,
  "velocidade_elevacao_mm_s": 3.0,
  "velocidade_retracao_mm_s": 3.0,
  "ajuste_xy_x_percentual": 100,
  "ajuste_xy_y_percentual": 100,
  "compensacao_xy_mm": 0.0,
  "tempo_espera_antes_cura_segundos": 0,
  "tempo_espera_depois_cura_segundos": 0,
  "tempo_espera_apos_elevacao_segundos": 0,
  "observacoes": "Perfil otimizado para detalhes finos em odontologia",
  "ativo": true,
  "criado_em": "2025-01-10T12:00:00Z",
  "atualizado_em": "2025-01-15T14:30:00Z"
}
```

---

## 💡 Exemplos de Uso

### Exemplo 1: Exportar TUDO para IA (uso principal)

```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=ai_ready"
```

**Retorna:**
- ✅ ~20-50 MB de dados estruturados
- ✅ Texto puro extraído de HTML
- ✅ Todos os relacionamentos desnormalizados
- ✅ Pronto para RAG (ChatGPT/Claude)

---

### Exemplo 2: Apenas Base de Conhecimento (compacto)

```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=compact&include_brands=false&include_models=false&include_parameters=false&include_resins=false"
```

**Retorna:**
- ✅ ~1-2 MB de dados
- ✅ Apenas artigos, categorias e autores
- ✅ Sem desnormalização

---

### Exemplo 3: Apenas 10 artigos mais recentes (teste)

```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?limit_contents=10&with_stats=true"
```

**Retorna:**
- ✅ Amostra de 10 artigos
- ✅ Estatísticas completas do sistema
- ✅ Útil para testes e desenvolvimento

---

### Exemplo 4: Apenas parâmetros técnicos (sem KB)

```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?include_knowledge=false&include_authors=false&include_keywords=false"
```

**Retorna:**
- ✅ Brands, Models, Parameter Sets, Resins
- ✅ ~2-5 MB
- ✅ Útil para sincronização de produtos

---

### Exemplo 5: Cache HTTP (economizar banda)

```bash
# Request inicial
curl -i "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export"
# Copiar valor do header ETag da resposta

# Request subsequente com ETag
curl -H 'If-None-Match: "12345678-1234567890"' "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export"
# Retorna: 304 Not Modified (sem body, economiza banda)
```

---

### Exemplo 6: Buscar documentos técnicos de resinas 🆕

```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=ai_ready&include_resin_documents=true"
```

**Retorna (formato `ai_ready`):**
```json
{
  "produtos": {
    "resinas": [...],
    "documentos_tecnicos": [
      {
        "id": "uuid",
        "resina": {
          "id": "uuid",
          "nome": "NextDent Model 2.0",
          "fabricante": "NextDent",
          "slug": "nextdent-model-2-0",
          "url_pagina": "https://parametros.smartdent.com.br/resina/nextdent-model-2-0"
        },
        "documento": {
          "nome": "Datasheet Técnico",
          "descricao": "Especificações técnicas completas da resina NextDent Model 2.0",
          "nome_arquivo": "nextdent-model-datasheet.pdf",
          "url_download": "https://okeogjgqijbfkudfjadz.supabase.co/storage/v1/object/public/resin-documents/nextdent-model-datasheet.pdf",
          "tamanho_bytes": 2450000
        },
        "ordem_exibicao": 1,
        "ativo": true,
        "criado_em": "2025-01-10T12:00:00Z",
        "atualizado_em": "2025-01-15T14:30:00Z"
      }
    ]
  }
}
```

**Uso para IA:**
- ✅ **Chatbot:** "Qual o datasheet da resina NextDent Model 2.0?" → Responde com link direto para download
- ✅ **SGE:** Cita datasheets oficiais como fonte técnica
- ✅ **Assistente virtual:** "Tem manual de uso da resina X?" → Lista todos os documentos disponíveis
- ✅ **Sincronização:** E-commerce exibe documentação técnica nas páginas de produto

**Desabilitar documentos:**
```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=ai_ready&include_resin_documents=false"
```

---

### Exemplo 7: Buscar vídeos do PandaVideo vinculados a produtos 🆕

```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=ai_ready&include_product_videos=true"
```

**Retorna (formato `ai_ready`):**
```json
{
  "videos_produtos": [
    {
      "id": "634b60df-e4d6-4e41-b796-3633e0c4ce4a",
      "pandavideo_id": "634b60df-e4d6-4e41-b796-3633e0c4ce4a",
      "produto": {
        "id": "uuid",
        "nome": "GLAZEON-SPLINT (Smart Dent)",
        "slug": "glazeon-splint",
        "categoria": "PÓS-IMPRESSÃO",
        "subcategoria": "ACABAMENTO E FINALIZAÇÃO",
        "external_id": "356341240",
        "url_pagina": "https://parametros.smartdent.com.br/produto/glazeon-splint"
      },
      "video": {
        "titulo": "GlazeON - Splint",
        "descricao": "Tutorial de aplicação do GlazeON em splints",
        "duracao_segundos": 180,
        "embed_url": "https://player-vz-23eb8993-7f2.tv.pandavideo.com.br/embed/?v=634b60df-e4d6-4e41-b796-3633e0c4ce4a",
        "hls_url": "https://b-vz-23eb8993-7f2.tv.pandavideo.com.br/634b60df-e4d6-4e41-b796-3633e0c4ce4a/playlist.m3u8",
        "thumbnail": "https://b-vz-23eb8993-7f2.tv.pandavideo.com.br/634b60df-e4d6-4e41-b796-3633e0c4ce4a/thumbs/thumb_0001.jpg",
        "preview": "https://b-vz-23eb8993-7f2.tv.pandavideo.com.br/634b60df-e4d6-4e41-b796-3633e0c4ce4a/previews/preview.mp4",
        "transcricao": "Texto extraído do áudio do vídeo..."
      },
      "campos_personalizados": {
        "ID_Lojaintegrada": "356341240",
        "Nome_do_Produto": "GLAZEON-SPLINT (Smart Dent)",
        "Categoria": "PÓS-IMPRESSÃO",
        "Subcategoria": "ACABAMENTO E FINALIZAÇÃO"
      },
      "tags": ["tutorial", "splint", "glazeon", "pos-impressao"],
      "status_vinculo": "matched",
      "ordem_exibicao": 1,
      "criado_em": "2025-01-10T12:00:00Z"
    }
  ]
}
```

**Uso para IA:**
- ✅ **Chatbot:** "Tem vídeo tutorial do produto GlazeON?" → Retorna embed do PandaVideo
- ✅ **SGE:** Mostra vídeos relacionados aos produtos nas respostas
- ✅ **Assistente virtual:** "Como usar o produto X?" → Lista vídeos instrucionais
- ✅ **Sincronização:** E-commerce exibe vídeos do PandaVideo nas páginas de produto
- ✅ **Análise:** Transcrição completa dos vídeos para busca semântica

**Buscar apenas vídeos (sem outros dados):**
```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?include_product_videos=true&include_brands=false&include_models=false&include_parameters=false&include_resins=false&include_knowledge=false&include_categories=false&include_keywords=false&include_authors=false&include_system_a=false&include_resin_documents=false"
```

---

```typescript
// Fetch completo para IA
async function fetchDataForAI() {
  const response = await fetch(
    'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=ai_ready'
  );
  
  const data = await response.json();
  
  console.log('Artigos:', data.data.conhecimento.artigos.length);
  console.log('Resinas:', data.data.produtos.resinas.length);
  console.log('Stats:', data.stats);
  
  return data;
}

// Fetch com cache
async function fetchWithCache() {
  const cachedETag = localStorage.getItem('data-export-etag');
  
  const headers: Record<string, string> = {};
  if (cachedETag) {
    headers['If-None-Match'] = cachedETag;
  }
  
  const response = await fetch(
    'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export',
    { headers }
  );
  
  if (response.status === 304) {
    console.log('✅ Usando cache local');
    return JSON.parse(localStorage.getItem('data-export-data')!);
  }
  
  const data = await response.json();
  
  // Salvar cache
  const etag = response.headers.get('ETag');
  if (etag) {
    localStorage.setItem('data-export-etag', etag);
    localStorage.setItem('data-export-data', JSON.stringify(data));
  }
  
  return data;
}
```

---

## 🚀 Performance

| Métrica | Valor |
|---------|-------|
| **Tempo de resposta (sem cache)** | 3-8 segundos |
| **Tempo de resposta (com cache)** | <100ms (304 Not Modified) |
| **Tamanho `compact`** | 2-5 MB |
| **Tamanho `full`** | 15-30 MB |
| **Tamanho `ai_ready`** | 20-50 MB |
| **Cache-Control** | `public, max-age=3600` (1 hora) |
| **ETag Support** | ✅ Sim |

---

## 🔒 Segurança

### ✅ O que é exposto:
- Apenas dados com `active=true` ou `approved=true`
- Dados públicos do site (artigos, resinas, parâmetros)
- Nenhum dado sensível

### ❌ O que NÃO é exposto:
- Emails de usuários
- Senhas
- Dados de autenticação
- Artigos não aprovados (`active=false`)
- Keywords não aprovadas (`approved=false`)

---

## ⚠️ Rate Limits e Custos

### Rate Limits Recomendados:
- **Produção:** 60 requisições/hora por IP
- **Desenvolvimento:** 300 requisições/hora

### Custos Estimados (Supabase):
- **Edge Function:** ~8s × $0.000040/seg = $0.00032 por request
- **Cache hit (304):** ~0.1s × $0.000040/seg = $0.000004 por request (99% mais barato!)
- **Recomendação:** Sempre usar cache HTTP para reduzir custos

---

## 🎯 Casos de Uso

### 1. IA de Atendimento (Principal)
```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=ai_ready"
```
**Uso:** ChatGPT, Claude, ou IA custom fazem 1 request e obtêm 100% do conhecimento do sistema para RAG.

### 2. Sincronização CRM/ERP
```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=compact&include_knowledge=false"
```
**Uso:** Sincronizar produtos (resinas) e parâmetros com sistema externo.

### 3. Indexação de Busca (Algolia/Elasticsearch)
```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=full&extract_text=true"
```
**Uso:** Indexar todo o conteúdo para busca full-text.

### 4. Backup Automatizado
```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?format=full" > backup-$(date +%Y%m%d).json
```
**Uso:** Backup diário de todos os dados.

### 5. Business Intelligence
```bash
curl "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/data-export?with_stats=true" | jq '.stats'
```
**Uso:** Análise de métricas e KPIs do sistema.

---

## 📝 Changelog

### v1.0 (2025-10-21)
- ✅ Primeiro release
- ✅ Suporte a 3 formatos (`full`, `compact`, `ai_ready`)
- ✅ Desnormalização completa de relacionamentos
- ✅ Extração de texto HTML
- ✅ Cache HTTP com ETag
- ✅ 9 entidades exportadas
- ✅ 14 query parameters configuráveis

---

## 🐛 Troubleshooting

### Problema: Timeout (>30s)
**Solução:** Use `limit_contents=50` para limitar artigos, ou desabilite entidades não necessárias.

### Problema: Resposta muito grande
**Solução:** Use `format=compact` ou `extract_text=false`.

### Problema: Dados desatualizados
**Solução:** Aguarde até 1 hora (cache) ou force refresh enviando header `Cache-Control: no-cache`.

### Problema: 304 Not Modified mas precisa de dados novos
**Solução:** Remova header `If-None-Match` ou envie `Cache-Control: no-cache`.

---

## 📞 Suporte

Para dúvidas ou problemas:
- 📧 Email: suporte@smartdent.com.br
- 🔗 Website: https://parametros.smartdent.com.br
- 📚 Docs: https://docs.smartdent.com.br

---

**Desenvolvido com ❤️ pela equipe Smart Dent**
