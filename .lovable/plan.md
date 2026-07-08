## Problema

Hoje o `landing-page-generator` só recebe uma string livre (`input`) via aba "IA" ou "Briefing". O `LandingPageBuilderModal` não conhece produto nem playbook — por isso o JSON `produto-rayshape-edge-mini-...-ia-playbook.json` que você anexou não foi usado pela IA. Não há qualquer referência a `playbook` no código.

## Objetivo

Permitir que o gerador de landing page use, com fidelidade total, o **AI Playbook** do produto (o mesmo JSON que você anexou: `basic_info`, `marketing_data.sales_pitch`, `technical_specs`, `product_variations`, etc.).

## Mudanças

### 1. `src/components/smartops/LandingPageBuilderModal.tsx`
- Adicionar uma nova aba **"Playbook do Produto"** (ao lado de "IA" e "Briefing").
- Dois modos de entrada:
  - Colar JSON do playbook em um `Textarea` grande.
  - Botão "Carregar arquivo .json" (upload local via `<input type="file" accept=".json">`).
- Ao gerar, validar que é JSON válido e enviar para a edge function com `mode: "playbook"` e `input: <JSON stringificado>`.
- Persistir em `smartops_form_landing_pages.input_prompt` normalmente (mesma coluna, texto).

### 2. `supabase/functions/landing-page-generator/index.ts`
- Aceitar `mode: "ai" | "briefing" | "playbook"`.
- Novo `buildUserPrompt` para `playbook`:
  - Faz `JSON.parse` do input; se falhar, retorna `invalid_playbook_json`.
  - Extrai campos-chave: `basic_info.name`, `description`, `price`, `promo_price`, `marketing_data.sales_pitch`, `benefits`, `features`, `unique_selling_points`, `target_audience`, `technical_specs`, `product_variations`, `seo_data`.
  - Monta um prompt "MODO: PLAYBOOK (fidelidade máxima)" instruindo o LLM a:
    - Usar **exatamente** o `sales_pitch` como base editorial do hero/positioning.
    - Popular `benefits` a partir de `marketing_data.benefits`/`unique_selling_points`.
    - Popular `modules` a partir de `technical_specs` (nome = `label`, application = `value`) quando o produto **não** for exocad.
    - Usar `price` e `promo_price` reais em `hero.pricePill` e `price.priceLabel` quando presentes (sem inventar).
    - Não aplicar as canônicas de exocad se o produto for outra coisa (o `isExocadContext` já ignora fora desse domínio — manter como está).
- Manter cascade de modelos e `response_format: json_object`.

### 3. Sem migrations, sem mudança no template `PremiumLandingTemplate` e sem alteração nos schemas do DB. Só UI e edge function.

## Fora de escopo
- Ligar `smartops_forms` diretamente a um `product_id` (poderia ser feito depois; agora fica manual via upload/paste do JSON).
- Alterações no e-mail, no LP template visual, ou no fluxo de publicação.

## Como validar
1. Abrir a LP do form "Impressora 3D Rayshape Edge Mini".
2. Aba "Playbook do Produto" → colar/upar o JSON anexado → Gerar.
3. Conferir no preview: hero com nome/descrição do playbook, pricePill com R$ 28.500 / R$ 35.000, benefícios extraídos do `sales_pitch`, seção "modules" com specs técnicas reais (MSLA, precisão 34,4 µm, plataformas, etc.).
