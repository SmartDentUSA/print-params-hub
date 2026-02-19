
## Causa do Link Quebrado: Negrito Envolve o Link no System Prompt

### O Problema Identificado

Na linha 1232 do `dra-lia/index.ts`, o link WhatsApp está envolvido em negrito:

```
**[Chamar no WhatsApp](https://wa.me/551634194735?text=Ol%C3%A1%2C+preciso+de+ajuda+t%C3%A9cnica!)**
```

O `renderMarkdown` do `DraLIA.tsx` (linha 49) processa bold e links **separadamente**, mas não de forma aninhada. Quando o regex de negrito (`\*\*...\*\*`) captura primeiro, ele engloba o link inteiro como texto puro dentro do `<strong>` — o link nunca é convertido em `<a href>`. O resultado visual é o texto `[Chamar no WhatsApp](https://wa.me/...)` aparecendo como texto simples, sem ser clicável.

A mesma coisa ocorre na linha 1251 (regra 8/PASSO 3) — o link também está sendo gerado pelo modelo como texto puro dentro de negrito às vezes.

### Duas Correções Necessárias (escolha a mais simples)

Há duas formas de resolver, e ambas são complementares:

---

### Correção 1 — `supabase/functions/dra-lia/index.ts` (mais rápida, resolve na raiz)

Remover o `**` em torno dos links no system prompt nas linhas 1232 e 1251, deixando o link sozinho sem negrito envolvente:

**Linha 1232 — Antes:**
```
- Link: **[Chamar no WhatsApp](https://wa.me/551634194735?text=Ol%C3%A1%2C+preciso+de+ajuda+t%C3%A9cnica!)**.
```

**Linha 1232 — Depois:**
```
- Link: [Chamar no WhatsApp](https://wa.me/551634194735?text=Ol%C3%A1%2C+preciso+de+ajuda+t%C3%A9cnica!)
```

**Linha 1251 — Antes:**
```
"Não tenho um vídeo específico sobre [sub-tema exato] cadastrado no momento. Mas nossa equipe pode ajudar: [Chamar no WhatsApp](https://wa.me/551634194735?text=Ol%C3%A1%2C+preciso+de+ajuda+t%C3%A9cnica!)"
```
(já está correto, sem negrito — manter como está)

---

### Correção 2 — `src/components/DraLIA.tsx` (mais robusta, resolve para sempre)

Atualizar o `renderMarkdown` para suportar links **dentro de negrito** — processar links antes de negrito ou usar um regex único que trate os dois casos juntos. Substituir o regex de link para capturar URLs com qualquer caractere (exceto `)` não escapado):

**Linha 49 — Antes:**
```js
const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);
```

**Linha 49 — Depois:**
```js
const linkMatch = remaining.match(/\[(.+?)\]\(([^)]+)\)/);
```

E adicionar suporte para detectar e processar links dentro de bold (`**[texto](url)**`), extraindo o link antes de passar pelo parser de negrito.

---

### Resumo das Alterações

| Arquivo | Linha | Mudança |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | 1232 | Remover `**` em torno do link WhatsApp no system prompt |
| `src/components/DraLIA.tsx` | 49 | Melhorar regex de link para ser mais robusto + suportar links dentro de negrito |

As duas correções juntas garantem: (1) o modelo não gera mais links dentro de negrito e (2) mesmo que gere, o renderizador consegue processar corretamente.

Deploy automático após as mudanças. Nenhuma re-indexação necessária.
