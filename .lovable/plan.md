# IA + Conteúdo — mensagem estilo WA + link automático

## Problema
O nó "IA + Conteúdo" (Artigos | Produtos | Vídeos) já gera mensagem via IA (DeepSeek/Gemini), mas:
1. Não inclui o **link público** do conteúdo no sistema.
2. O tom não está calibrado como "mensagem de grupo de WhatsApp" (hoje é "marketing profissional", curto demais e sem chamada para clicar).

## Escopo
Backend apenas. Dois arquivos:
- `supabase/functions/wa-dispatcher/index.ts` (envio real)
- `supabase/functions/wa-ai-preview/index.ts` (preview no builder)

Nenhuma mudança de schema, nenhuma mudança de frontend, nenhuma mudança no `wa-campaign-builder`.

## Mudanças

### 1. Resolver URL pública por tipo

Estender as queries em ambas funções para também buscar slug/categoria e montar a URL canônica:

- **article** (`knowledge_contents`): `select title, excerpt, content_html, slug, knowledge_categories!inner(letter)` → URL = `https://parametros.smartdent.com.br/base-conhecimento/{letter}/{slug}`
- **product** (`system_a_catalog`): `select name, description, category, slug` → URL = `https://parametros.smartdent.com.br/produtos/{slug}` (omite se sem slug)
- **video** (`knowledge_videos`): `select title, description, url, embed_url, content_id` → preferir `url` direta do vídeo (YouTube/Panda); se não houver, omitir link

Constante `PUBLIC_SITE_URL` no topo do arquivo, default `https://parametros.smartdent.com.br`, override via `Deno.env.get('PUBLIC_SITE_URL')`.

### 2. System prompt — tom de grupo de WA

Substituir o atual por algo como:

```
Você escreve mensagens curtas para grupo de WhatsApp da Smart Dent
(dentistas e laboratórios de prótese).
Estilo: conversa de grupo — caloroso, direto, 1ª pessoa do plural ("a gente",
"olha isso"), 1–3 linhas curtas, máximo 2 emojis no texto, sem hashtags,
sem títulos formais, sem assinatura. Termine com chamada curta para o link
(ex.: "Dá uma olhada aqui 👇", "Confere aí 👇"). Sem preços (política).
O link será adicionado automaticamente na linha seguinte — NÃO insira URL no corpo.
```

### 3. Anexar link após a geração

Depois da resposta da IA (DeepSeek/Gemini ou fallback):
- Se houver `url` resolvida: `text = `${text.trim()}\n${url}``
- Se não houver: retorna só o texto (comportamento atual).

Fallback final quando IA falha:
- Com link: `${title} — confere aí 👇\n${url}`
- Sem link: mantém `${title} — confira o conteúdo completo em nosso portal! 📲`

### 4. Manter compatibilidade

- `ai_prompt_override` continua respeitado; quando usado, o link ainda é anexado ao final (a menos que o override já contenha `http`).
- `max_tokens` aumenta de 150 → 220 no dispatcher (alinhar com preview) para acomodar mensagem 1–3 linhas + variação.
- Preview e dispatcher devem usar **a mesma função** de resolução. Como hoje duplicam a lógica, vou extrair `resolveAIContent()` para `supabase/functions/_shared/wa-ai-content.ts` e importar nos dois — fonte única de verdade do prompt, da URL e do fallback.

## Out of scope
- Mudança no UI do builder.
- Templates por categoria/idioma.
- Encurtador de URL (deixa link cru; WhatsApp gera preview).
- Mudança no schema do `flow_json`.
