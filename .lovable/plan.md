## Bug

O e-mail está usando `https://smartdent.com.br/f/<slug>` e `.../lp/<slug>` como CTA. O correto é usar os shorts oficiais registrados em `smartops_short_links` (`https://s.smartdent.com.br/<short_code>`), que já existem para o formulário e a landing page do produto (mesmos shorts mostrados no card do formulário).

Exemplo (produto `exocad_dentalcad_rms`):
- LP → `hxssbk`
- Form → `fwr5e6`

## Fix

**`src/components/smartops/EmailCampaignWizard.tsx`** (efeito que carrega CTAs do produto):

1. Depois de carregar `smartops_forms` e `smartops_form_landing_pages`, buscar em paralelo `smartops_short_links` filtrado por `form_slug IN (slugs dos formulários do produto)`.
2. Montar mapa `{ form_slug → { form: short_code, landing_page: short_code } }`.
3. Trocar as URLs:
   - Landing: se houver short `landing_page` para o `form_slug` correspondente, usar `https://s.smartdent.com.br/<short_code>`; senão, manter fallback `.../lp/<slug>`.
   - Form: se houver short `form`, usar `https://s.smartdent.com.br/<short_code>`; senão, manter fallback `.../f/<slug>`.
4. Nenhuma outra mudança — o allow-list de URLs do gerador de e-mail já usa apenas `cta_principal.url` + `ctas_secundarios[].url`, então isso propaga automaticamente ao prompt.

Sem migração, sem alterações de edge function.
