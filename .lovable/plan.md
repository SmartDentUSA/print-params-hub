## Reavaliação da autoavaliação do Copilot

A nota que o Copilot deu a si mesmo está **factualmente errada**. Verifiquei o banco e o código:

| O que ele disse | Verdade no sistema |
|---|---|
| 🔴 "Casos de sucesso 0/10 — zero indexados" | **405 `success_stories` publicadas** + tool `search_success_stories` implementada (`smart-ops-copilot/index.ts:1538`) e descrita no system prompt (linha 2529, 2536, 2543) |
| 🔴 "FAQs comerciais 0/10" | **784 `commercial_faqs` ativos** + tool `search_faqs` (`:1503`) descrita no prompt (linha 2528, 2542) |
| 🔴 "Cursos 0/10" | Tool `search_courses` registrada e ativa |
| 🔴 "Vídeos 2/10 — só RAG genérico" | Tool dedicada `search_videos` existe |
| 🟡 "Comparativos técnicos 7/10" | `get_product_anti_hallucination` cobre compatibilidade/concorrentes do Sistema A |
| 🔴 "Dados financeiros Omie 0/10" | **Correto** — bloqueio intencional ([mem://smart-ops/copilot-omie-data-blocked]) |
| 🔴 "Forecast 2/10" | **Correto** — não há modelo de projeção implementado |

### Diagnóstico
O Copilot **alucinou a autoavaliação**. Ele conhece as descrições das tools, mas não tem visibilidade dos *volumes* indexados, então quando alguém pergunta "o que você sabe", ele inventa "0 itens". Não é um problema de infra de RAG — é falta de auto-conhecimento estruturado.

### Plano de correção (escopo enxuto, 1 arquivo)

**1. Capability snapshot live no system prompt**
Em `supabase/functions/smart-ops-copilot/index.ts`, adicionar `fetchCapabilitiesSnapshot()` que roda em paralelo aos counts ao montar o turn:

```
## MINHAS FONTES DE CONHECIMENTO (snapshot ao vivo)
- commercial_faqs ativos: 784
- success_stories publicadas: 405
- knowledge_contents: <count>
- knowledge_videos: <count>
- courses ativos: <count>
- products_catalog: <count>
- system_a (anti-hallucination): <count>
🚫 Omie/financeiro: bloqueado por política.
🚫 Forecast/projeção: não implementado.
```

Buscado via `select(..., { count: "exact", head: true })` em paralelo, com cache in-memory de 5 min por instância da edge.

**2. Regra anti-auto-depreciação**
Nova proibição na seção `## PROIBIÇÕES ABSOLUTAS`:

> 8. NUNCA dê notas/percentuais ou diga "não tenho" sobre fontes listadas no snapshot acima sem antes chamar a tool correspondente. Quando o usuário pedir autoavaliação, cite os contadores reais do snapshot — não invente.

**3. Validação pós-deploy**
- Perguntar "avalie seu conhecimento" → resposta deve citar 784 FAQs, 405 cases, etc.
- Perguntar "tem caso de cliente sobre Vitality?" → Copilot chama `search_success_stories` em vez de dizer 0/10.

### Arquivos afetados
- `supabase/functions/smart-ops-copilot/index.ts` (1 função nova + injeção no prompt + 1 regra)
- Memória: criar `mem://smart-ops/copilot-capability-snapshot`

### O que NÃO mexer
- Tabelas `commercial_faqs`, `success_stories`, `knowledge_*` (já populadas e corretas)
- Implementação das tools de busca (funcionais)
- `copilot_brain` schema (fora de escopo)
- Bloqueio Omie (mantido por política)