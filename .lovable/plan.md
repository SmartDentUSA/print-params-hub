## Problema
No passo "Revisar & Ajustar" do EmailCampaignWizard, a área útil do editor é pequena:
- O `EmailHtmlEditor` tem altura fixa de `500px`.
- O preview lateral usa `h-96` (384px) ou `h-[640px]` em casos específicos.
- Tudo fica dentro do `Card` padrão da página, limitado pela largura do container.

Resultado: o usuário não consegue "expandir" a tela para ver/editar o email confortavelmente, especialmente emails longos com tabelas.

## Solução
Adicionar um **modo expandido** ao passo 2, abrindo o editor + preview em um **Dialog quase tela cheia** (`95vw` × `90vh`), com altura dinâmica do editor aproveitando o espaço vertical disponível.

### 1. Ajustar `EmailHtmlEditor.tsx`
- Aceitar prop opcional `expanded?: boolean` (ou `heightClass?: string`).
- Quando `expanded=true`, usar altura dinâmica baseada na viewport, ex.: `h-[calc(100vh-220px)]` (min `500px`).
- Quando `expanded=false`, manter `h-[500px]` como hoje ou levemente maior (`h-[600px]`).
- Preservar comportamento de debounce e sync externo.

### 2. Ajustar o preview lateral em `EmailCampaignWizard.tsx`
- O container do preview (`iframe`) deve acompanhar a altura do editor.
- Usar a mesma classe de altura dinâmica quando estiver expandido.

### 3. Adicionar botão "Expandir editor" no passo 2
- No cabeçalho do card "2. Revisar & Ajustar", ao lado do botão "Ocultar preview", adicionar:
  - Ícone `Maximize2` (ou similar do lucide-react) com label "Expandir".
- Ao clicar, abrir um `Dialog` (`src/components/ui/dialog.tsx`) com:
  - `className="max-w-[95vw] w-[95vw] h-[90vh] p-0"` (conteúdo sem padding para aproveitar espaço).
  - Header interno com título, botão "Ocultar preview" e botão "Fechar".
  - Corpo renderizando o mesmo conteúdo do passo 2 (assunto, preheader, abas Visual/HTML/Seções, preview lateral).
- Fechar o modal mantém o estado editado (o `html`, `subject`, `sections` etc. são os mesmos estados do componente pai).

### 4. Comportamento no modal expandido
- As abas Visual/HTML/Seções continuam funcionando normalmente.
- O `EmailHtmlEditor` dentro do modal usa altura expandida.
- O preview lateral também ocupa altura expandida.
- O botão "Fechar" (X) no header fecha o modal e volta ao card normal.

### 5. Ajuste de altura padrão (fora do modal)
- Aumentar levemente a altura padrão do editor de `500px` para `600px` e do preview para `h-[600px]` para melhorar a experiência mesmo sem expandir.

## Fora do escopo
- Não alterar a lógica de parsing/serialização de seções (`emailSections.ts`).
- Não alterar o backend de envio de email.
- Não alterar o `EmailRichEditor` (continua usado para HTML simples).

## Validação
1. Abrir passo 2 de uma campanha com email gerado pela IA.
2. Clicar em "Expandir editor" → modal ocupa quase toda a tela.
3. Confirmar que o textarea e o preview têm altura aumentada (praticamente até o fim do modal).
4. Editar o HTML no textarea → preview atualiza em ~300ms.
5. Alternar abas Visual/HTML/Seções dentro do modal → funciona normalmente.
6. Fechar o modal → estado preservado no card normal.
7. Enviar teste → email continua com estilo intacto.