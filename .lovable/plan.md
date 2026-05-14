## Objetivo
No mobile, aumentar a altura/tipografia dos campos do formulário público para melhorar usabilidade no toque. Desktop permanece igual.

## Alteração
Arquivo: `src/pages/PublicFormPage.tsx`

Adicionar classes responsivas nos campos (linhas 519–579):

- `Input` (text, email, number): adicionar `className="h-12 text-base md:h-10 md:text-sm"`
- `PhoneInputWithDDI`: passar mesma classe (se aceita) ou envolver com wrapper; vou aplicar via prop `className` se suportada — caso não, deixo o componente como está e padronizo apenas os Inputs nativos.
- `textarea`: trocar `p-2 text-sm min-h-[100px]` por `p-3 text-base min-h-[140px] md:p-2 md:text-sm md:min-h-[100px]`
- `select`: trocar `p-2 text-sm` por `h-12 px-3 text-base md:h-10 md:px-2 md:text-sm`
- `radio`/`checkbox` labels: aumentar área clicável no mobile — `text-base py-2 md:text-sm md:py-0`, e os `<input>` ganham `w-5 h-5 md:w-4 md:h-4`.
- `Label`: `text-base md:text-sm` (opcional, leve).

## Não muda
- Lógica, validação, layout geral, desktop.
