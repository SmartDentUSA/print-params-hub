## Objetivo

1. **Rodar em lote** a ferramenta "Reformatar HTML de Artigos com IA" em todos os conteúdos da base de conhecimento.
2. **Auditar** quais artigos não têm tradução em EN/ES e quais estão sem FAQs em PT/EN/ES.

## Onde vive hoje

- Componente: `src/components/AdminArticleReformatter.tsx` — hoje só reformata 1 artigo por vez (Preview / Reformatar e Salvar por linha).
- Edge function: `supabase/functions/reformat-article-html/index.ts` — já é idempotente (pula se `content_html_reformatted_at` estiver preenchido, a não ser que `force=true`) e já reformata os 3 idiomas (`content_html`, `content_html_en`, `content_html_es`) numa única chamada.
- Tabela: `knowledge_contents` com colunas `title / content_html / faqs`, `title_en / content_html_en / faqs_en`, `title_es / content_html_es / faqs_es`, `content_html_reformatted_at`.

## Mudanças propostas

### 1. Painel "Reformatar HTML" — adicionar modo lote

Em `AdminArticleReformatter.tsx`:

- Novo botão **"Reformatar todos em lote"** no topo da tela.
  - Confirmação com contagem: "Vai reformatar N artigos. Continua?"
  - Toggle "Forçar re-reformatação" (default desligado → aproveita a idempotência do `content_html_reformatted_at`; ligado → passa `force=true`).
  - Toggle "Somente artigos marcados como 'Precisam'" (default ligado) — respeita o filtro atual.
- Loop sequencial (1 por vez, para não estourar rate limit da IA):
  - Chama `supabase.functions.invoke('reformat-article-html', { body: { contentId, previewOnly: false, force } })`.
  - Barra de progresso `X / N`, contador de sucesso / skipped / erro, log inline dos últimos 5 itens.
  - Botão "Pausar" e "Cancelar" (aborta antes do próximo item).
  - Ao terminar, re-fetch da lista para refletir o estado atualizado.

### 2. Novo card "Auditoria de Traduções e FAQs"

Novo componente `src/components/AdminTranslationsAudit.tsx`, exibido em `AdminViewSupabase.tsx` logo acima do reformatador.

- Query em `knowledge_contents` (active=true) trazendo:
  `id, title, slug, title_en, title_es, content_html, content_html_en, content_html_es, faqs, faqs_en, faqs_es`.
- Cálculo por linha:
  - `missing_en` = falta `title_en` OU `content_html_en`.
  - `missing_es` = falta `title_es` OU `content_html_es`.
  - `missing_faqs_pt / _en / _es` = `faqs` (jsonb) ausente/vazio ou array `[]`.
- Cabeçalho com 6 contadores (Sem EN, Sem ES, Sem FAQ PT, Sem FAQ EN, Sem FAQ ES, Total).
- Filtros: "Sem EN", "Sem ES", "Sem FAQ (qualquer)", "Sem FAQ (as 3)".
- Tabela com título/slug + badges verde/vermelho por dimensão (EN, ES, FAQ PT/EN/ES) + link "Ver artigo".
- Botão **"Exportar CSV"** para tirar a lista de pendências.
- (Opcional, marcado como fase 2) botão inline "Traduzir agora" chamando a edge function `translate-content` existente — só sinalizado, não implementado nesta primeira leva para manter o escopo curto.

### 3. Sem alteração de banco

Nenhuma migration nova. A coluna `content_html_reformatted_at` já existe e é usada como marcador de idempotência.

## Ordem de execução

1. Criar `AdminTranslationsAudit.tsx` (leitura + tabela + CSV).
2. Encaixá-lo em `AdminViewSupabase.tsx` acima do card "Reformatar HTML".
3. Estender `AdminArticleReformatter.tsx` com o modo lote (botão, toggles, progresso, cancelamento).

## O que NÃO vou alterar

- Edge function `reformat-article-html` (já suporta `force` e é idempotente).
- Edge function `translate-content` (só será chamada em fase 2 opcional).
- Nenhuma tabela, RLS ou schema.
