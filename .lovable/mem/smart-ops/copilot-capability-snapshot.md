---
name: Copilot Capability Snapshot
description: Live snapshot de volumes de FAQs/cases/conteúdos injetado no system prompt para impedir autoavaliação alucinada
type: feature
---
`smart-ops-copilot` injeta a cada turno um bloco `CAPABILITY SNAPSHOT` com contagens reais de `commercial_faqs`, `success_stories`, `knowledge_contents`, `knowledge_videos`, `smartops_courses`, `astron_courses`, `products_catalog`, `system_a_catalog` (cache in-memory 5 min via `fetchCapabilitiesSnapshot`). A regra 8 das PROIBIÇÕES ABSOLUTAS proíbe responder "0/10" / "não indexado" / "não sei" sem antes chamar a tool correspondente quando o snapshot mostra contagem > 0. Quando o usuário pedir autoavaliação, o Copilot DEVE citar os contadores do snapshot — proibido inventar notas. Omie/forecast continuam declarados como bloqueio/ausência de feature.
