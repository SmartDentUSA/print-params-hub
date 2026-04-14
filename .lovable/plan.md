

## Plano: Habilitar Categoria E (Depoimentos e Cursos)

### Situacao atual
- Categoria E (`Depoimentos e Cursos`) esta com `enabled: false` no banco de dados (tabela `knowledge_categories`)
- Existem **301 artigos ativos** nessa categoria, mas nenhum aparece para o usuario
- O frontend filtra categorias desabilitadas: `cats.filter(c => c.enabled)` em `KnowledgeBase.tsx` (linha 53)
- Os labels nos locales estao como "Ebooks e Guias" em vez de "Depoimentos e Cursos"

### Alteracoes necessarias

**1. Banco de dados** — Habilitar categoria E
- Migration SQL: `UPDATE knowledge_categories SET enabled = true WHERE letter = 'E';`

**2. Locales** — Corrigir nome da categoria E
- `src/locales/pt.json`: `"category_e": "Depoimentos e Cursos"`
- `src/locales/en.json`: `"category_e": "Testimonials and Courses"`
- `src/locales/es.json`: `"category_e": "Testimonios y Cursos"`

**3. Sitemaps** — Os sitemaps ja incluem todos os artigos ativos independente de `enabled`, entao nenhuma mudanca e necessaria ali.

### Resultado
- A pill "E - Depoimentos e Cursos" aparecera na barra de categorias da Base de Conhecimento
- Os 301 artigos da categoria E ficarao navegaveis e indexaveis
- URLs como `/base-conhecimento/e/{slug}` funcionarao normalmente

