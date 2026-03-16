

## Diagnóstico Final

**O frontend do sistema está 100% intacto.** Todas as rotas, componentes e funcionalidades continuam no código:

- `/` → Catálogo de parâmetros (brands → models → resins) via `UserViewSupabase`
- `/admin` → Painel admin completo com todas as tabs
- `/base-conhecimento` → Knowledge Base em 3 idiomas
- `/embed/dra-lia` → Widget Dra. LIA
- `/produtos/:slug`, `/depoimentos/:slug`, etc.

**O problema é um único bug em `useSupabaseData.ts` linha 349-351**: quando o Supabase retorna 504 (como está acontecendo agora — PostgREST "Unhealthy"), o `catch` retorna `[]`. O `Index.tsx` interpreta `[]` como "banco vazio" e mostra a tela de importação ao invés do catálogo.

As migrações recentes (customer_graph, opportunity_engine, workflow_timeline, etc.) são **apenas schema/banco** — não alteram o frontend.

---

## Plano de Correção

### 1. `src/hooks/useSupabaseData.ts` — Propagar erro de rede
Linha 349-351: mudar o `catch` em `getUniqueBrands` para **re-lançar o erro** ao invés de retornar `[]`.

### 2. `src/pages/Index.tsx` — Distinguir erro de conexão vs banco vazio
- Adicionar estado `connectionError`
- Retry automático (3 tentativas, 2s de delay)
- Se todas falharem → mostrar componente de erro com botão "Tentar novamente"
- Só mostrar tela de importação quando a query **suceder** e retornar 0 brands

### 3. `src/components/ConnectionError.tsx` — Novo componente
Card com mensagem "Problema de conexão com o servidor" + botão "Tentar novamente" — substitui o loading infinito e a tela de importação falsa.

### 4. `src/pages/AdminViewSecure.tsx` — Timeout no boot
Envolver `getSession()` e checagem de role com timeout de 8s para não travar o admin em loading infinito.

---

### Resultado

| Cenário | Antes (bug atual) | Depois |
|---|---|---|
| Supabase OK | Catálogo normal ✓ | Catálogo normal ✓ |
| Supabase 504/lento | Tela de importação ✗ | "Problema de conexão" + retry |
| Admin + Supabase lento | Loading infinito ✗ | Timeout 8s → erro + retry |

