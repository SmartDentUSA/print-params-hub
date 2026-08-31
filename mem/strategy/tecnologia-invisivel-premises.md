---
name: Premissas Tecnologia Invisível
description: _shared/smartdent-strategy.ts guarda a tese oficial "Tecnologia Invisível" e é injetado em prompts de copy/imagem (capas e descrições de live no YouTube) junto ao dossiê RAG dos produtos selecionados.
type: feature
---

Fonte: Documento Estratégico Corporativo Smart Dent — "Tecnologia Invisível" (2026).

Premissas obrigatórias em toda copy gerada por IA:
- Tese: identificar gargalos do fluxo digital e transferir complexidade do usuário para o sistema.
- Lógica: GARGALO → SOLUÇÃO → COMPLEXIDADE RETIRADA → CLIENTE AVANÇA → NOVO GARGALO.
- Princípio: a complexidade deve estar no sistema, não no operador.
- 7 etapas do fluxo: Captura Digital, CAD, Impressão 3D, Pós-Impressão, Finalização, Cursos/Educação, Fresagem.
- Clínica: "Menos operação. Mais odontologia." · Laboratório: "Menos variabilidade. Mais produção previsível."
- Proibido: preços, margens, fornecedores internos, promessas fora do dossiê do produto.

Onde é aplicado:
- `_shared/smartdent-strategy.ts` — `renderStrategyForPrompt(short?)`.
- `youtube-live-thumbnail` — headline/highlight (Gemini 3.6 Flash) + prompt de imagem (versão curta) com dossiê RAG local + Sistema A live dos `related_product_names`.
- `youtube-live-create` — descrição AEO/GEO com dossiê local + live.
