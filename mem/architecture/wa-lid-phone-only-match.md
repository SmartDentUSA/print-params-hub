---
name: WA LID resolution — phone only
description: Resolução de LID do WhatsApp vincula lead SOMENTE por telefone real; match por pushName é opt-in explícito
type: constraint
---
`smart-ops-wa-resolve-lid` deve vincular conversas a leads **apenas por telefone real** (key.senderPn / remoteJidAlt / customer.number, match por últimos 8 dígitos).

O fallback por `pushName` (`enable_name_match`) agora é **false por padrão** e só roda se enviado explicitamente `enable_name_match: true`. A UI (Caixa WhatsApp → "Resolver identidades") envia sempre `false`.

**Why:** match por nome gerou vínculos errados (leads distintos com nome parecido).
