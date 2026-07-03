Objetivo: deixar a seção de módulos da landing page exatamente como solicitado — eyebrow "O que está incluído", título "Um pacote para o laboratório inteiro" e os 15 módulos listados, editáveis no builder e respeitados pela IA.

O que já existe: `DEFAULT_LP_CONTENT` em `PremiumLandingTemplate.tsx` já contém os 15 módulos corretos. O que falta é (1) ajustar o título da seção, (2) garantir que a IA não substitua essa lista e (3) dar ao editor um botão para restaurar a lista canônica.

Alterações previstas

1. `src/components/lp/PremiumLandingTemplate.tsx`
   - Atualizar `DEFAULT_LP_CONTENT.modules.title` para `"Um pacote para o laboratório inteiro"`.
   - Manter `eyebrow: "O que está incluído"` (o CSS já o renderiza em uppercase/tracking).
   - Manter os 15 itens e as descrições exatamente como enviados (já estão corretos).
   - Ajustar, se necessário, o `subtitle` para reforçar que são 15 módulos do Ultimate Lab Bundle.

2. `supabase/functions/landing-page-generator/index.ts`
   - Incluir na instrução de sistema a lista canônica dos 15 módulos exocad (DentalCAD Core Version, Virtual Articulator, Provisional Module, TruSmile™ Module, ZRS Tooth Library, Implant Module, Bar Module, DICOM Viewer Module, Model Creator Module, Smile Creator Module, Full Denture Module, Inspira™ Denture Tooth Library, PartialCAD Module, Bite Splint Module, Jaw Motion Import Module).
   - Determinar que, quando o assunto for exocad/Ultimate Lab Bundle, a IA deve usar obrigatoriamente esses 15 módulos com as descrições fornecidas, e não inventar módulos extras.

3. `src/components/smartops/LandingPageBuilderModal.tsx`
   - Na seção "Módulos" do editor, adicionar um botão "Restaurar 15 módulos padrão" que reseta `content.modules.items` para a lista canônica de `DEFAULT_LP_CONTENT`.
   - Isso permite corrigir rapidamente uma LP já salva que ainda tenha módulos antigos ou gerados incorretamente pela IA.

4. Validação
   - Executar `bunx tsgo --noEmit` para garantir que não haja erros de TypeScript.

Nota: LPs já publicadas/salvas no banco continuam com o conteúdo antigo até que sejam regeneradas ou editadas. Para aplicar a lista nova em uma LP existente, basta abrir o builder e clicar em "Restaurar 15 módulos padrão" (ou regenerar com a IA após a atualização do prompt).