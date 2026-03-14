

## Auditoria Completa da Refatoração dra-lia

### Resultado: Sem quebra. Nenhum ponto quebrado.

O monolito funciona porque **nunca removeu** código que ainda usa localmente. Mas a refatoração está **incompleta** em 2 dos 6 módulos.

### Status por Módulo

| Modulo | Criado | Importado no index.ts | Duplicado removido | Status |
|---|---|---|---|---|
| `lia-sdr.ts` | OK | OK | OK | **Completo** |
| `lia-escalation.ts` | OK | OK | OK | **Completo** |
| `lia-printer-dialog.ts` | OK | OK | OK | **Completo** |
| `lia-guards.ts` | OK | **NAO** | **NAO** | Incompleto |
| `lia-rag.ts` | OK | **NAO** | **NAO** | Incompleto |
| `lia-session.ts` | Nao criado | - | - | Pendente |

### Detalhes dos Problemas

**1. `lia-guards.ts` (203 linhas) — criado mas ignorado**
O monolito (linhas 122-203, 1673-1682, 3583-3639, 1609-1669) ainda contém cópias locais de:
- `isGreeting`, `GREETING_PATTERNS`
- `isSupportQuestion`, `SUPPORT_KEYWORDS`, `SUPPORT_FALLBACK`
- `isProtocolQuestion`, `PROTOCOL_KEYWORDS`
- `isProblemReport`, `PROBLEM_GUARD`
- `isMetaArticleQuery`, `META_ARTICLE_PATTERNS`
- `GENERAL_KNOWLEDGE_PATTERNS`, `PRICE_INTENT_PATTERNS`
- `STOPWORDS_PT`
- `upsertKnowledgeGap()`

Impacto: ~250 linhas duplicadas. Sem quebra, mas editar um guard no módulo **não surte efeito** — o monolito usa a cópia local.

**2. `lia-rag.ts` (445 linhas) — criado mas ignorado**
O monolito ainda contém cópias locais de:
- `TOPIC_WEIGHTS` + `applyTopicWeights()` (linhas 24-40)
- `searchByILIKE()` (linhas 206+)
- Demais funções de busca (catálogo, protocolos, parâmetros)

Impacto: ~400 linhas duplicadas. Sem quebra, mas mesma divergência.

**3. `lia-escalation.ts` — import de `logAIUsage` sem uso**
Importa `logAIUsage` na linha 7 mas nunca o chama. Leve, sem impacto funcional.

### Plano de Ação (Fase 3)

1. **Integrar `lia-guards.ts`**: Adicionar import no index.ts, remover ~250 linhas duplicadas (guards, stopwords, upsertKnowledgeGap)
2. **Integrar `lia-rag.ts`**: Adicionar import no index.ts, remover ~400 linhas duplicadas (TOPIC_WEIGHTS, searchByILIKE, buscas por catálogo/protocolo/parâmetros). Requer adaptar as funções do módulo para receber `SITE_BASE_URL` como parâmetro
3. **Limpar import morto** em lia-escalation.ts (logAIUsage)

Resultado esperado: **index.ts cai de 5.074 para ~4.400 linhas** (-13% adicional), totalizando ~27% de redução desde o início (6.038 → 4.400).

### Risco: Zero
Nenhum ponto está quebrado. A função está operacional com todo o código local. A integração apenas elimina duplicação.

