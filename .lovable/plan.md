
## Problema: Link de Produto (Resina Vitality) Não Clicável na LIA

### Diagnóstico

A resposta da LIA para "quero comprar a resina vitality" gerou:

```
👉 [Ver produto](https://loja.smartdent.com.br/resina-smart-print-bio-vitality)
```

O link parece correto, mas há dois cenários que causam a quebra:

**Cenário A (mais provável):** O modelo gera o link com negrito ao redor, seguindo a regra 11 do system prompt que diz *"Destaque produtos SmartDent com **negrito**"*:

```
👉 **[Ver produto](https://loja.smartdent.com.br/resina-smart-print-bio-vitality)**
```

Quando há um emoji `👉` antes do negrito+link, o `boldLinkMatch` (`/\*\*\[(.+?)\]\(([^)]+)\)\*\*/`) encontra o padrão corretamente — MAS o `boldMatch` (`/\*\*(.+?)\*\*/`) também encontra e pode ser avaliado primeiro dependendo do índice. No caso atual, a lógica de prioridade está correta (`boldLinkIdx <= boldIdx`), então o `boldlink` deveria vencer.

**Cenário B (confirmado pelo usuário):** O modelo gerou o link como texto sem colchetes markdown — ou seja, o modelo imprimiu a URL diretamente como texto bruto em vez de como link markdown. Isso acontece porque a instrução da regra 9 é ambígua:

```
9. Ao encontrar RESINA com link de compra: inclua um link [Ver produto](URL).
```

O modelo às vezes interpreta isso como: "escreva o texto `[Ver produto](URL)`" em vez de "gere um link markdown clicável". E como a URL é longa (`https://loja.smartdent.com.br/resina-smart-print-bio-vitality`), o modelo pode ter gerado a URL como texto puro sem os colchetes.

**Cenário C (identificado na regra 11):** A regra 11 diz `"Destaque produtos SmartDent com **negrito**"`. Isso instrui o modelo a envolver TUDO em negrito — incluindo o link `[Ver produto](URL)`, gerando `**[Ver produto](URL)**`. O `boldLinkMatch` deveria capturar isso, mas há um edge case: se o modelo gerar `[**Ver produto**](URL)` (negrito dentro do texto do link, não fora), nenhum regex atual captura esse padrão.

---

### Correção em 2 Arquivos

**Arquivo 1: `supabase/functions/dra-lia/index.ts`**

Três mudanças no system prompt:

1. **Regra 9 — Instrução explícita de formato do link de produto:**
   Mudar de:
   ```
   9. Ao encontrar RESINA com link de compra: inclua um link [Ver produto](URL).
   ```
   Para:
   ```
   9. Ao encontrar RESINA com link de compra (campo COMPRA no contexto): gere EXATAMENTE este formato markdown clicável: [Ver produto](URL_DO_CAMPO_COMPRA). NÃO envolva em negrito. NÃO use **[Ver produto](URL)**. Apenas [Ver produto](URL) sozinho.
   ```

2. **Regra 11 — Remover instrução de negrito que conflita com links:**
   A instrução `"Destaque produtos SmartDent com **negrito**"` causa o modelo a envolver links em `**...**`. Remover ou restringir essa instrução apenas para nomes de produtos em texto corrido, não para links.
   
   Mudar de:
   ```
   ...Use bullet points. Destaque produtos SmartDent com **negrito**. Nunca omita etapas.
   ```
   Para:
   ```
   ...Use bullet points. Ao mencionar nomes de produtos SmartDent em texto (não em links), use **negrito**. NUNCA envolva links [texto](url) em **negrito**. Nunca omita etapas.
   ```

3. **Nova regra explícita anti-negrito-em-links:**
   Após a regra 19, adicionar:
   ```
   20. LINKS NUNCA EM NEGRITO: PROIBIDO gerar **[texto](url)** ou [**texto**](url). Links de produto e WhatsApp devem ser sempre no formato simples [texto](url). O negrito em volta de links quebra a renderização do chat.
   ```

**Arquivo 2: `src/components/DraLIA.tsx`**

Adicionar suporte a mais dois padrões de link problemáticos no `renderMarkdown`:

- `[**texto**](url)` — negrito dentro do texto do link (modelo às vezes gera assim)
- Detecção de URLs brutas sem markdown: padrão `https://...` sozinho na linha

Adicionar no `parseInline`:
```typescript
// Link com negrito no texto: [**text**](url)
const boldInLinkMatch = remaining.match(/\[\*\*(.+?)\*\*\]\(([^)]+)\)/);
// URL bruta: https://... (sem colchetes)
const rawUrlMatch = remaining.match(/https?:\/\/[^\s)]+/);
```

E processar ambos antes do fallback de texto puro.

---

### Impacto Esperado

| Padrão gerado pelo modelo | Antes | Depois |
|---|---|---|
| `[Ver produto](url)` | Clicável ✅ | Clicável ✅ |
| `**[Ver produto](url)**` | Depende da posição ⚠️ | Sempre clicável ✅ |
| `[**Ver produto**](url)` | Texto quebrado ❌ | Clicável ✅ |
| URL bruta `https://...` | Texto puro ❌ | Link clicável ✅ |

---

### Resumo das Alterações

| Arquivo | Local | Mudança |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | Regra 9 | Instrução explícita de formato `[Ver produto](URL)` sem negrito |
| `supabase/functions/dra-lia/index.ts` | Regra 11 | Restringir negrito a nomes em texto corrido, não em links |
| `supabase/functions/dra-lia/index.ts` | Nova regra 20 | Proibição explícita de links em negrito |
| `src/components/DraLIA.tsx` | `parseInline` | Suporte a `[**texto**](url)` e URLs brutas `https://...` |

Deploy automático após as mudanças.
