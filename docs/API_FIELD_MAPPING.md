# Knowledge Base API - Mapeamento de Campos

## Endpoint
```
GET https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/get-product-data
Query params: slug, approved
```

## Campos SEO (Sistema A → Sistema B)

| Sistema B espera       | Sistema A retorna          | Tipo     | Descrição                                    |
|------------------------|----------------------------|----------|----------------------------------------------|
| `seo_title_override`   | `seo_title_override`       | string   | Título SEO customizado (gerado por IA)       |
| `meta_description`     | `seo_description_override` | string   | Meta description gerada por IA               |
| `og_image_url`         | `image_url`                | string   | URL da imagem do produto (Open Graph)        |
| `canonical_url`        | `canonical_url`            | string   | URL canônica (evita conteúdo duplicado)      |
| `slug`                 | `slug`                     | string   | Slug do produto (URL amigável)               |
| `keywords`             | `keywords`                 | array    | Palavras-chave para SEO                      |

## Campos Básicos

| Sistema B espera | Sistema A retorna | Tipo   | Descrição                  |
|------------------|-------------------|--------|----------------------------|
| `name`           | `name`            | string | Nome do produto            |
| `description`    | `description`     | string | Descrição completa         |
| `price`          | `price`           | number | Preço do produto           |
| `image_url`      | `image_url`       | string | URL da imagem principal    |
| `category`       | `category`        | string | Categoria do produto       |

## Exemplo de Resposta

```json
{
  "success": true,
  "data": {
    "name": "Smart Print Model Plus",
    "description": "Resina odontológica de alta precisão...",
    "price": 299.90,
    "image_url": "https://cdn.awsli.com.br/800x800/...",
    "seo_title_override": "Smart Print Model Plus - Resina 3D Odontológica",
    "seo_description_override": "Descubra a Smart Print Model Plus...",
    "canonical_url": "https://loja.smartdent.com.br/resina-3d-smart-print-model-plus",
    "slug": "resina-3d-smart-print-model-plus",
    "keywords": ["resina 3D", "odontologia", "modelo", "biocompatível"]
  }
}
```

## Notas Importantes

⚠️ **Campos que NÃO existem na API:**
- ❌ `meta_description` (use `seo_description_override`)
- ❌ `og_image_url` (use `image_url`)

✅ **Todos os campos SEO são opcionais** (nullable)

✅ **Keywords é um array** (não string)

## Histórico de Mudanças

### v2.0 (2025-10-20)
- ✅ Corrigido mapeamento: `meta_description` → `seo_description_override`
- ✅ Corrigido mapeamento: `og_image_url` → `image_url`
- ✅ Adicionados campos extras: `seo_title_override`, `canonical_url`, `slug`
- ✅ Total de campos SEO: **6 campos** (3 visíveis + 6 SEO = 9 campos totais)

### v1.0 (anterior)
- ❌ Mapeamento incorreto de `meta_description` e `og_image_url`
- ⚠️ Perda de dados SEO gerados por IA do Sistema A
