---
name: Meta unslug email guard
description: extractField no smart-ops-ingest-lead nunca desfaz slug (_ → espaço) em e-mails/telefones
type: feature
---
Meta Lead Ads entrega valores slugados (`clínica_ou_consultório`), então `extractField` fazia `_`→espaço em TODO valor — corrompendo e-mails legítimos com underscore (`vini_valiatti@hotmail.com` → `vini valiatti@hotmail.com`) e bloqueando o lead com `missing_identity: email`.
Regra: se o valor contém `@` ou parece telefone, retornar cru (só colapsar espaços). Nunca unslugar identificadores.
