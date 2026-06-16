
# Estender o tradutor existente a todos os cards (PT/EN/ES)

Reutilizar o padrão já em produção (`translate-content` + colunas `_en`/`_es` na própria linha + auto-trigger no viewer). Aplicar a todas as tabelas que alimentam cards da Base de Conhecimento.

## Padrão atual (já funciona em artigos)
- Tabela `knowledge_contents` tem `title_en`, `title_es`, `content_html_en`, `content_html_es`.
- Quando o usuário entra com `language=en|es` e a coluna está vazia → edge function `translate-content` traduz via Lovable AI e faz `UPDATE` no row.
- Próximos acessos leem direto do banco (cache permanente, custo zero).

## Tabelas a estender (cards de KB)

| Tabela | Campos PT a traduzir |
|---|---|
| `system_a_catalog` (produtos) | `name`, `description`, `product_category`, `product_subcategory`, `cta_1_label`, `cta_1_description`, `cta_2_label`, `cta_3_label`, `cta_4_label` |
| `resins` | `name`, `description`, `processing_instructions`, `cta_1..4_label` |
| `products_catalog` | `technical_specifications` (jsonb com `{label,value}`) |
| `knowledge_videos` | `title`, `description` |
| `distributors` | `name`, `description`, `region`, `specialty` |
| `smartops_events` | `title`, `description`, `location` |
| `knowledge_categories` | `name`, `description` |

Cada campo `X` ganha `X_en` e `X_es` (text ou jsonb conforme o original). Migration única.

## Edge function: `translate-card-row` (nova, genérica)

Input:
```json
{ "table": "system_a_catalog", "id": "uuid", "target": "en"|"es" }
```
- Whitelist de tabelas e campos (definida no código da function).
- Lê linha PT, monta JSON `{field: text}`, chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com system prompt:
  > "Traduza PT→{EN|ES}. Preserve nomes próprios, marcas, unidades, números, URLs. Para jsonb arrays de `{label,value}`, traduza apenas os textos descritivos. Retorne JSON com as mesmas chaves."
- Atualiza `UPDATE <table> SET field_en=..., field_es=... WHERE id=...`.
- Idempotente: pula campos que já têm valor não nulo.
- Concurrency: lock leve via coluna `translating_until` (1 min) — opcional, dropável.

Reaproveita `aiComplete` (`_shared/ai-router.ts`) e `logAIUsage` como o `translate-content` já faz.

## Frontend

### Hook genérico
`src/hooks/useTranslatedRow.ts`
```ts
useTranslatedRow(table, row, fields)
```
- Se `language === 'pt'` → retorna PT.
- Se já tem `field_<lang>` → retorna direto.
- Caso contrário, dispara `supabase.functions.invoke('translate-card-row', { table, id, target })` em background, mostra PT enquanto carrega, e re-renderiza com os novos valores (refetch ou estado local).
- Deduplica chamadas concorrentes via `Map<id+lang, Promise>` em memória.

### Aplicação nos cards
- **`KbTabCatalogo`**: ao montar cada card, chama o hook com os fields do produto/resina; usa os valores traduzidos para `name`, `description`, CTAs e tabela técnica.
- **Demais tabs da KB** (vídeos, distribuidores, eventos, categorias): mesmo padrão.

## Migration

Bloco único `ALTER TABLE ... ADD COLUMN IF NOT EXISTS field_en TEXT, ADD COLUMN IF NOT EXISTS field_es TEXT` para cada tabela/coluna. Para `technical_specifications` (jsonb), criar `technical_specifications_en JSONB`, `technical_specifications_es JSONB`. Sem alteração de RLS (colunas seguem políticas existentes).

## Garantias
- **Custo único por linha+idioma**: depois de traduzir, não chama IA novamente.
- **Sem regressão para PT**: fonte permanece intacta; tradução só lê/escreve nas colunas `_en`/`_es`.
- **Fallback transparente**: se a tradução falhar, card aparece em PT.
- **Whitelist no edge**: client não pode mandar tabela/campo arbitrário.

## Entregáveis
1. Migration adicionando colunas `_en`/`_es` nas 7 tabelas.
2. Edge function `translate-card-row` (genérica, whitelisted).
3. Hook `useTranslatedRow`.
4. Integração em `KbTabCatalogo` e nos demais componentes de card da KB.

## Fora de escopo
- Traduzir conteúdo dentro de modais já cobertos pelo `translate-content` (artigos full).
- Tradução manual por admin (override) — pode vir depois.
- Páginas que não são cards (parameter pages, landing, etc.).

Confirma este plano para eu rodar a migration e implementar?
