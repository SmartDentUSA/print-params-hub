---
name: Trigger Instagram nas copies do Social Publisher
description: Palavra-gatilho do formulário (ig_trigger_*) entra obrigatoriamente na copy quando o produto vinculado é selecionado
type: feature
---
- `smartops_forms.ig_trigger_enabled/_keyword/_cta/_dm_message` definem a palavra de comentário por formulário.
- `social-caption-generator` resolve o produto (`system_a_catalog` por slug/nome) → busca formulário ativo com `product_catalog_id` igual e trigger habilitado (`fetchIgTrigger`) e injeta regra obrigatória no prompt: CTA no fim da caption com a palavra em MAIÚSCULAS entre aspas + repetição no primeiro comentário. Retorna `_meta.ig_trigger_keyword/_cta`.
- `StepContent.tsx` mostra aviso do trigger ao selecionar o produto (só para refs `product:<catalog_id>`; resinas não têm vínculo de formulário).
