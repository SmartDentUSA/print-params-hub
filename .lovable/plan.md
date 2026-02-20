
# Auto-Healing Knowledge — Plano de Implementação Definitivo

## Contexto do Código Atual (verificado)

- `src/App.tsx` linha 65: usa `window.location.pathname` — bug confirmado
- `src/components/AdminDraLIAStats.tsx`: 1080 linhas, 3 abas (`overview`, `quality`, `rag`). A `TabsList` está na linha 478, o `</Tabs>` está na linha 1077
- `supabase/functions/index-embeddings/index.ts`: usa `gemini-embedding-001` via `GOOGLE_AI_KEY`, aceita `?mode=incremental`
- Secrets já configurados: `GOOGLE_AI_KEY`, `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Todos os componentes UI necessários já existem: `Input`, `Textarea`, `Collapsible`, `Select`, `Accordion`, `Badge`, `Button`

## Artefatos a Criar/Modificar

### 1. Migração SQL — Tabela `knowledge_gap_drafts`

```sql
CREATE TABLE public.knowledge_gap_drafts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_title           TEXT NOT NULL,
  draft_excerpt         TEXT NOT NULL,
  draft_faq             JSONB,
  draft_keywords        TEXT[],
  gap_ids               UUID[] NOT NULL,
  cluster_questions     TEXT[] NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft',
  published_content_id  UUID,
  created_at            TIMESTAMPTZ DEFAULT now(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           TEXT
);

ALTER TABLE public.knowledge_gap_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage gap drafts"
  ON public.knowledge_gap_drafts FOR ALL
  USING (is_admin(auth.uid()));
```

Zero impacto em tabelas existentes. Nenhuma foreign key obrigatória.

### 2. Edge Function — `supabase/functions/heal-knowledge-gaps/index.ts`

Nova função Deno com 4 ações via `?action=`:

**Ação `generate` (POST autenticado)**

Fluxo interno:
1. Busca `agent_knowledge_gaps` onde `status = 'pending'`
2. Aplica filtro de ruído semântico:
   - Strings com menos de 10 caracteres
   - Saudações: `olá, oi, hey, ok, sim, não, obrigado, bom dia, boa tarde...`
   - Exclamações sem conteúdo: `caramba, nossa, puts, poxa, tá, show, blz`
3. Para cada lacuna não-ruído, gera embedding via Google AI API (mesmo endpoint do `index-embeddings`: `gemini-embedding-001` com `outputDimensionality: 768`)
4. Clustering guloso por centróide (O(n×k), puro Deno):
   - Ordena lacunas por `frequency` decrescente
   - A mais frequente ainda não agrupada vira centróide
   - Cálculo de similaridade de cosseno puro (sem libs):
     ```typescript
     function cosineSimilarity(a: number[], b: number[]): number {
       const dot = a.reduce((s, ai, i) => s + ai * b[i], 0);
       const magA = Math.sqrt(a.reduce((s, ai) => s + ai * ai, 0));
       const magB = Math.sqrt(b.reduce((s, bi) => s + bi * bi, 0));
       return magA && magB ? dot / (magA * magB) : 0;
     }
     ```
   - Threshold: cosine >= 0.75 → mesmo cluster
5. Para cada cluster, chama Gemini via gateway Lovable (`google/gemini-2.5-flash`) com prompt estruturado para gerar FAQ em JSON
6. Parseia o JSON da resposta (usa `response_format: json_object` quando disponível)
7. Salva cada cluster como draft em `knowledge_gap_drafts` com `status = 'draft'`
8. Retorna `{ drafts_created, gaps_analyzed, noise_filtered }`

**Ação `list` (GET autenticado)**

Retorna todos os drafts ordenados por `created_at DESC` para popular o painel.

**Ação `approve` (POST autenticado)**

Body: `{ draft_id, title, excerpt, faqs, keywords, category_id }`

Fluxo:
1. Valida que o draft existe com `status = 'draft'`
2. Gera slug único: `title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-faq-auto'` com verificação anti-colisão (tenta sufixos `-2`, `-3` se necessário)
3. Insere em `knowledge_contents` com `active = true`, `icon_color = 'blue'`, `order_index = 0`
4. Atualiza draft: `status = 'approved'`, `published_content_id`, `reviewed_at = now()`
5. Atualiza todos os `gap_ids` do cluster: `status = 'resolved'` em lote
6. Chama internamente `index-embeddings?mode=incremental` com `SUPABASE_SERVICE_ROLE_KEY` como Bearer → RAG atualizado em ~30s
7. Retorna `{ success: true, content_id, slug }`

**Ação `reject` (POST autenticado)**

Body: `{ draft_id }`

Marca o draft como `status = 'rejected'`. Lacunas originais permanecem `pending`.

**Config `supabase/config.toml` (3 linhas adicionadas no final):**
```toml
[functions.heal-knowledge-gaps]
verify_jwt = true
```

### 3. Modificação — `src/components/AdminDraLIAStats.tsx`

**Novos imports adicionados às linhas 1–38:**
```typescript
import { Sparkles, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
```

**Novas interfaces TypeScript (após linha 104):**
```typescript
interface GapDraft {
  id: string;
  draft_title: string;
  draft_excerpt: string;
  draft_faq: { q: string; a: string }[] | null;
  draft_keywords: string[] | null;
  gap_ids: string[];
  cluster_questions: string[];
  status: 'draft' | 'approved' | 'rejected';
  published_content_id: string | null;
  created_at: string;
}

interface KnowledgeCategory {
  id: string;
  letter: string;
  name: string;
}
```

**Novos estados React (após linha 158):**
```typescript
const [drafts, setDrafts] = useState<GapDraft[]>([]);
const [editedDrafts, setEditedDrafts] = useState<Record<string, Partial<GapDraft>>>({});
const [healLoading, setHealLoading] = useState(false);
const [healStep, setHealStep] = useState<string | null>(null);
const [approvingId, setApprovingId] = useState<string | null>(null);
const [rejectingId, setRejectingId] = useState<string | null>(null);
const [selectedCategoryIds, setSelectedCategoryIds] = useState<Record<string, string>>({});
const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
```

**Novas funções (após `handleExportJsonl`, linha 398):**

- `fetchDrafts()`: busca `knowledge_gap_drafts` via Supabase client, ordenado por `created_at DESC`
- `fetchCategories()`: busca `knowledge_categories` para popular o Select
- `handleGenerate()`: autentica → POST `heal-knowledge-gaps?action=generate` → atualiza `healStep` em sequência → chama `fetchDrafts()`
- `updateDraftField(draftId, field, value)`: helper para edição inline no `editedDrafts` state
- `handleApproveDraft(draftId)`: merge dados editados + originais → POST `?action=approve` → toast → `fetchDrafts()`
- `handleRejectDraft(draftId)`: POST `?action=reject` → toast → `fetchDrafts()`

**Modificação no `useEffect` (linha 319):** adicionar chamadas a `fetchDrafts()` e `fetchCategories()`.

**Modificação na `TabsList` (linhas 478–496):** inserir novo trigger após o trigger "rag":
```tsx
<TabsTrigger value="autoheal" className="flex-1 sm:flex-none gap-1">
  <Sparkles className="w-4 h-4" />
  Auto-Heal
  {drafts.filter(d => d.status === 'draft').length > 0 && (
    <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0 h-4 ml-1">
      {drafts.filter(d => d.status === 'draft').length}
    </Badge>
  )}
</TabsTrigger>
```

**Nova aba `TabsContent value="autoheal"` (inserida antes do `</Tabs>` na linha 1077):**

Seção 1 — Painel de Ação:
- Card mostrando `stats.pendingGapsCount` lacunas pendentes
- Botão "Analisar Lacunas e Gerar Rascunhos" (desabilitado durante `healLoading`)
- Indicador de etapa: texto `healStep` com ícone de spin (`RefreshCw animate-spin`)

Seção 2 — Cards de Rascunhos Pendentes (para cada draft com `status = 'draft'`):
- `Input` editável para `draft_title` com badge "Rascunho IA"
- `Collapsible` das perguntas originais `cluster_questions` (2 visíveis, expandir para ver todas)
- `Textarea` editável para `draft_excerpt`
- `Accordion` com pares Q&A — `Input` para pergunta + `Textarea` para resposta por item
- `Select` de categoria preenchido com `categories` do banco
- Botões: "Aprovar e Publicar" (verde, `variant="default"`) e "Descartar" (`variant="ghost"`)

Estado vazio (nenhum draft):
- Ícone `Sparkles` centralizado + texto explicativo

Seção 3 — Histórico (tabela compacta):
- Drafts com `status = 'approved'` ou `'rejected'`
- Colunas: Título | Data | Status | Link ao artigo publicado

### 4. Correção — `src/App.tsx`

Apenas 3 mudanças:

**Linha 1:** adicionar `useLocation` ao import:
```typescript
import { Routes, Route, useLocation } from "react-router-dom";
```

**Linhas 64–68:** substituir o corpo de `DraLIAGlobal`:
```typescript
function DraLIAGlobal() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/embed')) return null;
  return <DraLIA />;
}
```

## Sequência de Implementação

1. Criar arquivo SQL de migração → `knowledge_gap_drafts`
2. Criar `supabase/functions/heal-knowledge-gaps/index.ts`
3. Atualizar `supabase/config.toml` com `[functions.heal-knowledge-gaps]`
4. Modificar `src/App.tsx` (2 linhas)
5. Modificar `src/components/AdminDraLIAStats.tsx` (imports, interfaces, estados, funções, TabsList, nova TabsContent)

## Resumo dos Artefatos

| Artefato | Ação | Impacto |
|---|---|---|
| `supabase/migrations/TIMESTAMP_knowledge_gap_drafts.sql` | CRIAR | Nova tabela + RLS |
| `supabase/functions/heal-knowledge-gaps/index.ts` | CRIAR | ~250 linhas |
| `supabase/config.toml` | EDITAR | +3 linhas no final |
| `src/App.tsx` | EDITAR | 2 linhas alteradas |
| `src/components/AdminDraLIAStats.tsx` | EDITAR | ~+280 linhas |

Zero quebras. Zero alterações em `dra-lia`, `evaluate-interaction`, `index-embeddings`, ou tabelas existentes.
