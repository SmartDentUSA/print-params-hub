## Problema

No topbar do Knowledge Base v2 o seletor de idioma mostra o valor duplicado:

`BR PortuguêsBR Português ▾`

## Causa

`src/components/LanguageSelector.tsx` renderiza dentro do `SelectTrigger`:

1. Um bloco manual `<span>flag</span><span>name</span>` (linhas 57–60).
2. Um `<SelectValue className="sr-only" />` (linha 61).

`SelectValue` é `SelectPrimitive.Value` do Radix e **não aceita `className`**: a prop é ignorada, então o texto do item selecionado (que também é `flag + name`, definido em cada `SelectItem`) aparece renderizado ao lado do bloco manual, gerando o "BR PortuguêsBR Português".

## Correção

Arquivo único: `src/components/LanguageSelector.tsx`

- Remover a linha `<SelectValue className="sr-only" />` do `SelectTrigger`. O bloco manual `flag + name` já é a única representação visível necessária; o Radix Select funciona sem `SelectValue` quando o trigger já exibe o valor selecionado por conta própria.

Nada mais muda: comportamento do dropdown, troca de idioma, roteamento de Knowledge Base, i18n e demais componentes ficam idênticos.

## Fora de escopo

- Não tocar em `KbShellLayout`, `Header`, estilos do topbar, nem em qualquer outra parte do shell v2.
- Não alterar `LanguageContext`, rotas ou traduções.

## Validação

Abrir `/base-conhecimento?tab=parametros` e conferir que o botão do seletor mostra apenas `🇧🇷 Português ▾` (sem duplicação), e que trocar para EN/ES continua funcionando.
