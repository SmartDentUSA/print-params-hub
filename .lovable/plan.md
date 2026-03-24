

# Plano: Adicionar icones de redes sociais no footer do PublicFormPage

## Problema

O footer do `PublicFormPage.tsx` esta hardcoded — nao usa `useCompanyData()` e portanto nao exibe os icones de redes sociais que vem do Sistema A.

## Solucao

Adicionar `useCompanyData()` no `PublicFormPage.tsx` e renderizar icones de redes sociais no footer, usando o mesmo pattern do `Footer.tsx` principal.

## Mudanca

**Arquivo:** `src/pages/PublicFormPage.tsx`

1. Importar `useCompanyData` e icones do Lucide (`Instagram`, `Youtube`, `Facebook`, `Linkedin`, `Twitter`)
2. Chamar `const { data: company } = useCompanyData()` no componente
3. Substituir o footer hardcoded por um que use `company` para dados textuais (nome, CNPJ, endereco, telefone, site) e renderize icones de redes sociais filtrados (mesmo array pattern do `Footer.tsx`)
4. Icones exibidos como circulos compactos linkados, centralizados abaixo dos dados da empresa

## Detalhes tecnicos

- Reutiliza `useCompanyData()` que ja faz cache via React Query
- Fallback: se `company` nao carregar, mantem os dados hardcoded atuais
- Icones: circulos de 32px com hover, mesmo estilo do Footer principal mas menor escala

