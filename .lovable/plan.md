## Objetivo

Expandir o passo 2 do wizard "Criar Campanha" para usar toda a largura da tela, removendo o container estreito que hoje espreme editor e preview em ~600px cada.

## Mudanças

**`src/components/smartops/EmailCampaignWizard.tsx`**

1. No wrapper do passo 2 (Revisar & Ajustar), remover as classes que limitam largura (`max-w-*`, `container`, etc.) e passar o card para `w-full`.
2. Ajustar o layout do card para grid de 2 colunas em telas largas (`lg:grid-cols-2 gap-6`), com editor à esquerda e preview à direita ocupando cada coluna ~50% da viewport.
3. Aumentar altura padrão do editor/preview quando não expandido: passar de `600px` para `h-[calc(100vh-320px)]` (mínimo 560px), acompanhando a expansão horizontal.
4. Manter o botão "Expandir" (modal 95vw × 90vh) intacto para uso pontual.

**`src/components/smartops/EmailHtmlEditor.tsx`**

- Ajustar o valor default de altura para bater com o novo layout (`h-[calc(100vh-320px)]`, min 560px).
- Sem mudança de props/API.

## Fora de escopo

- Passos 1 e 3 do wizard (mantêm largura atual).
- `EmailRichEditor`, `emailSections.ts`, backend.
- Lógica de envio, preview de landing page, geração de HTML.

## Validação

- Abrir `/admin?sub=criar&tab=campanhas`, avançar ao passo 2 com email HTML complexo.
- Confirmar que editor e preview agora ocupam cada um ~50% da largura da viewport (sem coluna estreita).
- Confirmar que o botão "Expandir" ainda abre o modal fullscreen.
- Build + typecheck limpos.
