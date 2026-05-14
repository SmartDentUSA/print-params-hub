## Diagnóstico

O estilo está salvo no banco para o formulário `forms_bite_splint_flex` (`bg_color`, `theme_mode`, `layout_variant`, fontes, botão etc.). O problema principal está no botão **Copiar HTML embed**: ele gera sempre o mesmo HTML fixo, com CSS estático (`body`, `iframe`) e sem usar as configurações do formulário. Por isso o HTML copiado continua igual mesmo após salvar a aparência.

## Plano de correção

1. **Atualizar o modelo de dados no builder**
   - Incluir no tipo `SmartOpsForm` os campos de aparência já existentes no banco: `bg_type`, `bg_color`, `bg_color_to`, `bg_gradient_angle`, `bg_image_url`, `bg_overlay_opacity`, `theme_mode`, `layout_variant`, `font_heading`, `font_body`, `button_radius`, `button_shadow`, `extra_sections`, `custom_css`, `updated_at`.

2. **Trocar `copyEmbed(slug, formName)` para receber o formulário completo**
   - Alterar a chamada do botão para `copyEmbed(form)`.
   - Assim o gerador terá acesso às configurações salvas daquele formulário específico.

3. **Gerar HTML embed com estilos persistidos**
   - Inserir no HTML copiado:
     - background sólido/gradiente/imagem conforme o formulário;
     - modo claro/escuro;
     - fontes escolhidas via Google Fonts;
     - layout variant como classe/data-attribute;
     - raio/sombra do botão como CSS variables/documentação de estilo;
     - cache-buster no iframe usando `updated_at` para evitar embed antigo/cacheado.
   - Manter SEO/GEO e Schema existentes.

4. **Ajustar URL do iframe para forçar atualização quando estilo muda**
   - Gerar `src=".../f/slug?v=timestamp"`.
   - Isso resolve o caso comum em que o iframe externo continua mostrando cache antigo.

5. **Verificação**
   - Comparar o HTML gerado antes/depois no código para confirmar que deixou de ser estático.
   - Conferir que a página pública já lê os campos do banco e aplica os estilos no runtime.

## Arquivos previstos

- `src/components/SmartOpsFormBuilder.tsx`

Não pretendo mexer no banco nem alterar regras de ingestão de leads.