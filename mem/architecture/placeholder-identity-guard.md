---
name: Placeholder Identity Guard
description: Notas de vendedor nunca exibem e-mail import_*@placeholder.local nem "Nome não informado"; identidade real é recuperada pelo telefone canônico
type: feature
---
Leads criados por importação CSV recebem e-mail sintético `import_<ts>_<n>@placeholder.local` e nome `Nome não informado`.

Regra: em `_shared/seller-summary.ts` a seção Identidade sanitiza esses valores e busca nome/e-mail reais em outro lead canônico (`merged_into IS NULL`) com o mesmo `telefone_normalized` (match pelos últimos 11 dígitos). Se não achar, mostra `—` — nunca o placeholder.

Pendência conhecida: ~2.5k leads canônicos com e-mail placeholder e ~196 pares duplicados por telefone (placeholder + lead real não mesclados). O dedup por telefone não trata esses casos na ingestão.

## Merge de placeholders — restrição absoluta
Qualquer merge/dedup de leads com e-mail placeholder é operação SOMENTE de identidade em `lia_attendances` (marcar `merged_into`, consolidar nome/e-mail/telefone). É PROIBIDO alterar, fechar, mover, reatribuir ou criar deals no Funil de Vendas e no funil CS durante o merge. Deals dos dois lados permanecem exatamente como estão.
Fluxo obrigatório: dry-run em CSV → validação do usuário → execução.
