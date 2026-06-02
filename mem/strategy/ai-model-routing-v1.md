---
name: AI Model Routing v2
description: Tabela ai_model_routing é a fonte da verdade; Poe.com é provider adicional para fallback e premium
type: preference
---
**Regra**: roteamento de modelos IA é controlado pela tabela `public.ai_model_routing` (não mais por memória estática).

**Providers ativos**:
- `lovable` — Lovable AI Gateway (Gemini default)
- `deepseek` — DeepSeek-chat (raciocínio + tools)
- `poe` — Poe.com OpenAI-compat API (acesso a Claude Opus 4.8, GPT-5.5, Codex etc.)

**Como chamar (edge functions novas)**:
```ts
import { aiComplete } from "../_shared/ai-router.ts";
const r = await aiComplete({ task: "copilot_default", messages, functionName: "minha-fn" });
```

**Como mudar provider de uma tarefa**: Admin → SmartOps → AI Routing (CRUD da tabela). Cache de rota tem TTL 60s.

**Smart-ops-copilot**: integração preservada — `poe-claude` e `poe-gpt5` foram adicionados como ModelId no fallback chain existente (não usa aiComplete).

**Anti-padrões**:
- Hardcodear modelo em nova função (use `aiComplete` + task em `ai_model_routing`)
- Trocar `auto_premium` para Opus 4.8 sem aprovação (custa US$5/US$25 por 1M)
