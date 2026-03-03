

## Plano: PROBLEM_GUARD + Menu Loop Detection + Threshold de Transbordo

### Problema
O `detectPrinterDialogState` captura mensagens de troubleshooting ("descascando", "pós-processamento") e as joga no fluxo guiado marca→modelo→resina, criando um loop de menu frustrante.

### Mudanças em `supabase/functions/dra-lia/index.ts`

**1. Adicionar PROBLEM_GUARD (constante global, ~linha 290, após `isProtocolQuestion`)**

```typescript
const PROBLEM_GUARD = /(descascando|delamina|warping|empenad|danificad|quebrad|rachad|não.{0,10}(funciona|liga|sai|gruda|adere|cura)|falhando|defeito|erro de|problema com|qualidade ruim|saindo mal|trocar|substituir|FEP|LCD|tela danificad|motor|eixo.?z|calibra[çc][ãa]o falh|layer.?shift|não.{0,10}ader|pós.?processamento|pós.?cura|limpeza.?(ipa|álcool|alcool)|falha.?(de|na|no)|suporte.?(técnico|tecnico)|manuten[çc][ãa]o)/i;

const isProblemReport = (msg: string) => PROBLEM_GUARD.test(msg);
```

**2. Modificar condição do dialogState (~linha 3844)**

De:
```typescript
const dialogState = topic_context === "commercial"
  ? { state: "not_in_dialog" as const }
  : await detectPrinterDialogState(supabase, message, history, session_id, topic_context);
```

Para:
```typescript
const skipDialog = isProblemReport(message) || isProtocolQuestion(message);
const dialogState = (topic_context === "commercial" || skipDialog)
  ? { state: "not_in_dialog" as const }
  : await detectPrinterDialogState(supabase, message, history, session_id, topic_context);
```

**3. Menu Loop Detection + Threshold 2 (~linha 4008, no bloco de fallback)**

Antes do fallback existente (`!hasResults`), adicionar detecção de loop consultando as últimas 2 respostas do bot na sessão. Se ambas contiverem "Marcas disponíveis" / "Available brands", forçar handoff imediato ao invés de repetir o menu.

Também ajustar: quando `unanswered: true` por 2 interações consecutivas (não 3), disparar `notifySellerHandoff`.

### Resultado esperado

| Entrada | Antes | Depois |
|---|---|---|
| "impressão descascando" | Lista de marcas | RAG busca troubleshooting |
| "pós-processamento" | Lista de marcas | RAG busca protocolos |
| "capital do Brasil" | Lista de marcas | RAG → fallback → handoff (2x) |
| "quero parâmetros da Elegoo" | Fluxo guiado ✅ | Fluxo guiado ✅ (sem mudança) |

