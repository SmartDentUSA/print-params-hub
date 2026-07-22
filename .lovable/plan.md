# Correção Catálogo/Artigos/Renderização — reaproveitando infra existente

## Princípio

Não criar taxonomia nova (`/catalogo/resinas-3d/...`, `/artigos/impressao-3d/...`). A infra de prerender já existe e funciona: `seo-proxy`, `ssr-prerender`, `knowledge_categories` (7 categorias A–G), `knowledge_contents` (605+ itens). O problema são 3 bugs pontuais + 1 gap (hub agregador de artigos).

---

## Fase 1 — Bugs críticos no `seo-proxy` (bloqueiam tudo)

### 1.1 Fallback vazio para User-Agent não-bot
Hoje `if (!isBot(ua)) return new Response('', {status:200})` devolve corpo vazio para qualquer UA fora da allowlist fechada. É a causa raiz mais provável de "toda IA responde a mesma coisa" e do "título genérico" (o que sobra é o `<title>` do `index.html` estático do Vite).

**Ação:** ampliar heurística (`bot|crawler|spider|python|curl|scrapy|headless|node|axios|http`) OU, quando UA for ambíguo, servir o HTML pré-renderizado por padrão em vez de vazio. Nunca devolver body `''`.

### 1.2 `seo-proxy` não lê `?tab=`
Só lê `originalPath`, então `?tab=catalogo` e `?tab=artigos` caem no mesmo hub genérico.

**Ação:** ler `url.searchParams.get('tab')`. Quando `segments[0]==='base-conhecimento'` e `segments.length===1`:
- `tab=catalogo` (ou ausente) → `generateKnowledgeCategoryHTML('g', ...)` (categoria G já existe, 18 itens).
- `tab=artigos` → `generateArticlesHubHTML()` (Fase 2).

### 1.3 Case da URL (sempre minúsculo)
Banco confirma 7 categorias únicas maiúsculas (A–G). A duplicação `/g` vs `/G` é geração no front/proxy sem `.toLowerCase()` consistente.

**Ação:** toda geração interna de URL (links, canonical, sitemap) sempre minúsculo. Roteador/proxy aceita ambos mas redireciona 301 para minúsculo canônico.

---

## Fase 2 — Hub de Artigos (view agregadora, sem migrar conteúdo)

View SQL agregando categorias textuais:
```sql
SELECT kc.*, cat.letter, cat.name AS category_name
FROM knowledge_contents kc
JOIN knowledge_categories cat ON cat.id = kc.category_id
WHERE cat.letter IN ('B','C','D','F')  -- Falhas, Ciência, Casos Clínicos, Parâmetros
  AND kc.active = true
ORDER BY kc.created_at DESC;
```

Nova função `generateArticlesHubHTML()` no `seo-proxy` (mesmo padrão de `generateKnowledgeHubHTML`/`generateKnowledgeCategoryHTML`): H1 "Artigos sobre Odontologia Digital e Impressão 3D", lista os itens das 4 categorias, paginação, filtro por categoria.

Rota principal: `/base-conhecimento?tab=artigos` (via fix 1.2). Opcional: alias `/base-conhecimento/artigos` como URL citável mais limpa. **Nenhuma URL existente `/base-conhecimento/{letra}/{slug}` muda.**

---

## Fase 3 — Categoria E ("Depoimentos e Cursos") — separar por tipo na renderização

259 itens misturam depoimento de cliente + curso comercial. Não dividir em categorias novas (mexeria em URLs). Usar campos existentes (`client_name`, `client_specialty` — só preenchidos em depoimentos) para renderizar blocos diferentes na listagem/hub:
- Depoimento → bloco "cliente real".
- Curso → bloco "matrícula/CTA comercial".

Separação de URL fica para fase futura, se justificar após medir.

---

## Fase 4 — Metadados por página

`ssr-prerender` e `seo-proxy` já geram `<title>${article.title} | Smart Dent}` por artigo. Sintoma de título genérico é provavelmente o próprio bug 1.1. **Ação:** corrigir 1.1 e re-auditar; só investigar página a página se persistir.

---

## Fase 5 — E-E-A-T e conteúdo (workstream editorial, não infra)

Sinalizado para priorização separada (não entra nesta implementação):
- Trocar "FDA approved" por "FDA 510(k) cleared" em conteúdo Bio Vitality e demais 510(k).
- Autoria nomeada com credencial (CRO, título) em conteúdo técnico/científico — não "Equipe Smart Dent" nem "Dra. L.I.A." genérico.
- Reescrever "Lista oficial de produtos" em tom informativo (hoje soa como instrução para IA).
- Alegações superlativas ("único da América Latina") → anexar metodologia/data/fonte ou remover.

---

## Detalhes técnicos

**Arquivos afetados (Fase 1–2):**
- `supabase/functions/seo-proxy/index.ts` — fixes 1.1, 1.2, 1.3 + nova `generateArticlesHubHTML()`.
- `supabase/functions/ssr-prerender/index.ts` — auditar mesma lógica de UA/tab se aplicável.
- Frontend: garantir `.toLowerCase()` em toda montagem de link para `/base-conhecimento/{letra}/...` (canonical, sitemap generator, componentes de listagem).
- Migração: criar view `v_knowledge_articles` (ou query direta na função — decidir na implementação).

**Ordem de execução:**
1. Fase 1.1 (fallback vazio) — deploy isolado, valida "auditoria de IA" imediatamente.
2. Fase 1.2 + 1.3 (tab + case) — deploy junto.
3. Fase 2 (hub artigos) — depende de 1.2.
4. Fase 3 (render categoria E) — independente, pode paralelizar.
5. Fase 4 — só após 1.1 estar em produção e re-auditado.

**Fora de escopo:**
- Nenhuma alteração em URLs de artigos existentes.
- Nenhuma re-taxonomização dos 605 conteúdos.
- Nenhuma nova categoria em `knowledge_categories`.
- Conteúdo editorial (Fase 5) fica para workstream separado.
