Objetivo: garantir que as 25 FAQs enviadas façam parte da landing page como padrão, fiquem editáveis no builder e sejam respeitadas pela IA em novas gerações.

O que já existe: `DEFAULT_LP_CONTENT` em `PremiumLandingTemplate.tsx` já contém as 25 perguntas e respostas enviadas. O que falta é (1) garantir que a IA não as substitua por outras e (2) dar ao editor um botão para restaurar a lista canônica.

Alterações previstas

1. `src/components/lp/PremiumLandingTemplate.tsx`
   - Manter `DEFAULT_LP_CONTENT.faq.title` como "Perguntas frequentes".
   - Confirmar que os 25 itens de FAQ estão exatamente como enviados (já estão corretos).

2. `supabase/functions/landing-page-generator/index.ts`
   - Adicionar uma `LISTA CANÔNICA DE 25 FAQS` ao prompt de sistema, com as perguntas e respostas exatas enviadas.
   - Instruir a IA a, para landing pages exocad/Ultimate Lab Bundle/RMS, usar obrigatoriamente essas 25 FAQs na seção `faq.items`, sem omitir, sem inventar e sem alterar as respostas.

3. `src/components/smartops/LandingPageBuilderModal.tsx`
   - Na seção "FAQ" do editor, adicionar um botão "Restaurar 25 FAQs padrão" que reseta `content.faq.items` para a lista canônica de `DEFAULT_LP_CONTENT`.
   - Exibir o contador de FAQs ao lado do botão (ex: "FAQs (25)").

4. Validação
   - Executar `bunx tsgo --noEmit` para garantir que não haja erros de TypeScript.

Nota: LPs já publicadas/salvas no banco continuam com o conteúdo antigo até que sejam regeneradas ou editadas. Para aplicar a lista nova em uma LP existente, basta abrir o builder e clicar em "Restaurar 25 FAQs padrão" (ou regenerar com a IA após a atualização do prompt).