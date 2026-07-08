# Fix: e-mail não está usando o layout da Landing Page

O screenshot mostra o e-mail com **logo image Smart Dent + botão azul retangular + "Olá, Teste"** — nada do skeleton roxo/gradiente/card que criamos. O ramo LP não foi tomado, e o código caiu no prompt legado.

## Causa provável
1. `loadLpDossier` retornou `null` (LP não encontrada por `id`), ou
2. A chamada ao LLM dentro do ramo LP retornou `!ok` e caiu **silenciosamente** para o prompt legado (comment `Fall through to the legacy dossier path below`).

Nos dois casos, hoje o e-mail volta para o layout genérico do prompt antigo — que é justamente o que o screenshot mostra.

## Correções

### 1. `smart-ops-generate-email-ai/index.ts` — nunca cair no legado quando existe LP
- Se o produto tem LP publicada (via `cta_principal.id` **ou** fallback por `produto_id`), o ramo LP **é obrigatório**.
- Se `loadLpDossier` retornar `null`, logar o motivo (`no_lp_row`, `not_published`, `no_form_ids`) e prosseguir para o legado.
- Se o LLM falhar (gateway ≠ 200 ou JSON inválido), **não** cair para o legado. Em vez disso, renderizar o skeleton com os textos **originais da LP** (sem tom aplicado): `hero.headline`, `hero.sub`, `hero.bullets`, `positioning`, `how_it_works`. Assim o e-mail sempre sai com a estética da LP; a IA só refina o texto quando responde.
- Adicionar logs claros:
  - `[generate-email-ai] LP branch selected id=<lp_id> hero_image=<url>`
  - `[generate-email-ai] LLM copy ok / fallback_to_lp_verbatim reason=<...>`
  - `source: "landing_page_ai" | "landing_page_verbatim" | "catalog_dossier"` no JSON de resposta.

### 2. Ajustes de robustez no skeleton
- Garantir `!doctype html` limpo (o `sanitizeEmailHtml` do `smart-ops-send-gmail` já preserva; ok).
- Escapar corretamente `headline_html` — permitir só `<span class="hl">…</span>` e converter server-side; qualquer outra tag é removida.
- Se `heroImageUrl` estiver ausente, esconder o bloco sem quebrar layout.
- Verificar que o botão CTA usa `background:linear-gradient(...)` inline (alguns clientes ignoram — manter cor de fundo sólida `#7C3AED` como fallback via `bgcolor` no `<td>`).

### 3. Wizard — sinalizar a fonte no preview
- Exibir badge no passo 2 baseado em `data.source`:
  - `landing_page_ai` → "Copy espelhada da LP (IA + tom aplicado)"
  - `landing_page_verbatim` → "Layout da LP com copy original (IA indisponível)"
  - `catalog_dossier` → "Sem LP — copy pelo dossiê do catálogo"
- Se o usuário selecionou LP mas o retorno veio `catalog_dossier`, mostrar toast de aviso.

### 4. Validação
- Testar com `exocad_dentalcad_rms`:
  - Verificar em `Edge Function logs` a linha `LP branch selected id=…`.
  - Confirmar preview com: eyebrow roxo, headline com trecho em gradiente, imagem hero, bullets com bolinha roxa, faixa de posicionamento `#F4EEFB`, passos numerados 01/02/03, botão gradiente roxo→laranja.
  - Trocar o tom: só os textos mudam, layout permanece idêntico.
- Testar produto sem LP → cai em `catalog_dossier`.

## Arquivos afetados
- `supabase/functions/smart-ops-generate-email-ai/index.ts` — remover fallthrough silencioso, adicionar caminho `landing_page_verbatim`, logs, escape do headline_html.
- `src/components/smartops/EmailCampaignWizard.tsx` — badge dinâmico por `source`, toast de aviso.

## Fora de escopo
- Não alteramos `smart-ops-send-gmail` (o pipeline de envio já não altera estilos).
- Não mudamos schema.
