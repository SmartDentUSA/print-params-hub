## Objetivo

Na Central de Campanhas (wizard de e-mail), garantir que todos os links do e-mail gerado apontem para o **produto selecionado** (landing page do produto + formulário do produto) e remover completamente o CTA de WhatsApp / "Falar no WhatsApp".

## Problemas observados no e-mail atual

1. Links secundários ("Vantagens do modelo RMS", "Saiba mais sobre licenciamento", "Ecossistema exocad") apontam para artigos da base de conhecimento e URLs genéricas.
2. Existe o CTA "Falar agora pelo WhatsApp" que **não pode aparecer** em nenhum e-mail.
3. Os únicos destinos válidos para qualquer link do e-mail são:
   - **Landing page do produto** (`/lp/<slug-lp-do-produto>`)
   - **Formulário do produto** (`/f/<slug-form-do-produto>`)

## Alterações

### 1. `src/components/smartops/EmailCampaignWizard.tsx`
- Remover o tipo `seller_wa` de `CtaType`, do `ctaOptions`, do `allCtas`, do bloco de opções renderizadas e das labels.
- Trocar o carregamento de `landing`, `form` e `knowledge`:
  - **Landings**: `smartops_form_landing_pages` join com `smartops_forms` filtrando `product_catalog_id = produtoId` e `status = 'published'`.
  - **Forms**: `smartops_forms` filtrando `product_catalog_id = produtoId`.
  - **Knowledge**: remover a lista inteira (não é fonte permitida de CTA).
  - **Social/Store**: manter apenas se explicitamente pedido — remover das opções para simplificar (apenas Landing + Form do produto).
- Ao selecionar um produto, pré-selecionar automaticamente:
  - `ctaPrincipal` = landing do produto (fallback: form do produto).
  - `ctasSecundarios` = [form do produto] (ou [landing] se principal já for o form).
- Bloquear avanço para o passo 2 se não houver landing nem form associados ao produto (mostrar toast: "Cadastre a landing page ou o formulário do produto antes de gerar o e-mail").

### 2. `supabase/functions/smart-ops-generate-email-ai/index.ts`
- Remover `seller_wa` do tipo `CtaRef` e do dicionário de labels padrão.
- Remover do `systemPrompt` as instruções sobre `{{link_wa_vendedor}}`, "Falar no WhatsApp" e o link WhatsApp obrigatório no rodapé.
- Adicionar regras absolutas no `systemPrompt`:
  - Todos os links (`<a href>`) do HTML DEVEM ser **exatamente** uma das URLs listadas em `cta_principal.url` / `ctas_secundarios[].url`. Nenhuma outra URL pode aparecer.
  - Proibido gerar links para WhatsApp, `wa.me`, `mailto:`, redes sociais, base de conhecimento, ou qualquer domínio fora dos CTAs recebidos.
  - Rodapé sem "Falar no WhatsApp" e sem `{{link_wa_vendedor}}`.
- Remover o bloco "Aprofunde-se" obrigatório com cards de `knowledge_contents` (era a origem dos links genéricos). Substituir por: bloco final opcional que repete o CTA principal (landing do produto) e link "Preencher formulário" (form do produto).
- Remover do userPrompt as seções "CONTEÚDO RELACIONADO" e "BIBLIOTECA System A" (fonte dos links inválidos).
- Após gerar `html_body`, aplicar um sanitizador server-side: percorrer todas as tags `<a>` e, se `href` não estiver na lista `[cta_principal.url, ...ctas_secundarios.map(c=>c.url)]`, substituir por `cta_principal.url` (defesa em profundidade caso o LLM desobedeça).

### 3. `supabase/functions/smart-ops-send-gmail/index.ts`
- Manter a substituição de `{{link_wa_vendedor}}` como no-op de segurança (caso existam templates antigos), mas isso é apenas defensivo — nenhum novo e-mail deve conter o placeholder.

## Fora de escopo
- Central de Campanhas > outros nós (WhatsApp/SMS) permanecem inalterados.
- Régua/sequência (`EmailSequenceBuilder`) — o placeholder do WhatsApp permanece só como texto de ajuda; se você quiser removê-lo também, me diga.

## Detalhes técnicos

Tabelas envolvidas: `smartops_forms(product_catalog_id, slug, name)`, `smartops_form_landing_pages(form_id, slug, title, status)`, `system_a_catalog(id, name)`.

Sanitizador de href (pseudo):
```ts
const allowed = new Set([cta_principal.url, ...ctas_secundarios.map(c=>c.url)]);
html_body = html_body.replace(/href="([^"]+)"/g, (_, u) => `href="${allowed.has(u) ? u : cta_principal.url}"`);
```
