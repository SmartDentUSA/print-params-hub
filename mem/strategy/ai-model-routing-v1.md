---
name: AI Model Routing v1
description: Matriz fixa de qual modelo cada função usa, otimizada para custo/qualidade
type: preference
---
**Regra**: cada tarefa usa o modelo mais barato que atende a qualidade necessária.

| Função | Modelo | Por quê |
|---|---|---|
| Copilot default | DeepSeek-chat (pro) | raciocínio + tools, melhor custo |
| Copilot rápido (`gemini-flash`/`deepseek-flash`) | Gemini 3 Flash via Lovable Gateway | lookups baratos |
| Copilot Claude | **bloqueado** salvo `COPILOT_ALLOW_CLAUDE=true` | US$ 15/M output, ~20× DeepSeek |
| `waleads-messaging` briefings (alto volume) | Gemini 2.5 Flash-Lite via Gateway | 1000+/dia, prompt simples |
| Dra. LIA chat | Gemini 2.5 Flash via Gateway | latência baixa |
| cognitive-lead-analysis, workflow-diagnosis | DeepSeek-chat | baixo volume, precisa raciocínio |
| Conteúdo/SEO/PDF/OG | Gemini 2.5 Flash | já otimizado |
| Embeddings | embedding-001 | barato |
| Watchdog | DeepSeek-chat | custo desprezível |

**Como aplicar**: ao criar nova função IA, escolha pela matriz. Trocar de modelo requer atualizar esta memória.

**Anti-padrão**: nunca usar Claude/GPT-5 por default — só sob flag explícita.