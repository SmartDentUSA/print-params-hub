---
name: Synthetic email guard precision
description: looksLikeInternalEmail em _shared/commercial-intent.ts só bloqueia domínios sintéticos e local-part qa/test/teste com delimitador — nunca substring
type: constraint
---
`evaluateCommercialIntent` bloqueava qualquer e-mail contendo a substring `test|teste|example`, o que silenciosamente impedia leads Meta reais (ex.: `julesteste.1@gmail.com`) de entrarem no PipeRun.

Regra atual:
- Bloqueia domínios: smartdent.com.br, smartdent.invalid, whatsapp.lead, example.com/.org, test.com, localhost, e sufixos `.invalid`/`.local`/`.test`.
- Bloqueia local-part `^wa_\d+` e `^(qa|test|teste)([._+-]|$)`.
- NUNCA usar substring `test`/`teste` sobre o e-mail inteiro.

Também: `smart-ops-lia-assign` deve tolerar `lead.email = null` (leads Meta só com telefone) — `String(lead.email ?? "")`, senão quebra com `Cannot read properties of null (reading 'trim')`.
