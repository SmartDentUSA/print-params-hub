

# Fix: Dra. LIA deve listar chamados existentes ao invés de abrir um novo

## Problema identificado
Quando o usuário diz **"quero saber meus chamados"**, a LIA entra no fluxo de **criação** de chamado técnico ao invés de **listar** os chamados existentes. Duas causas:

1. **`isSupportQuestion()` retorna `false` corretamente** (a regex `SUPPORT_INFO_QUERY` detecta "meus chamados" como consulta informacional), mas o `topic_context === "support"` na linha 2971 **bypassa o guard** e força o fluxo de criação.

2. **Não existe nenhum fluxo de consulta de chamados** — a LIA simplesmente não sabe listar tickets do banco `technical_tickets`.

## Plano de implementação

### 1. Adicionar guard de consulta de chamados no `dra-lia/index.ts`
Antes do bloco de suporte (linha ~2955), inserir um interceptor que detecta intenções de **consultar** chamados (não criar):

```text
Regex: /\b(quantos?|quais?|ver|listar|consultar|hist[oó]rico|status|meus?|[uú]ltimo|n[uú]mero)\b.{0,25}\b(chamado|ticket|ocorr[eê]ncia)/i
```

Quando detectado:
- Buscar `technical_tickets` WHERE `lead_id` = ID do lead (resolvido via email como no fluxo de suporte existente)
- Retornar lista formatada com: ticket_full_id, status, equipamento, data, resumo IA
- Se não houver chamados: "Você ainda não tem chamados técnicos registrados."

### 2. Exportar a regex de `lia-guards.ts`
Exportar `SUPPORT_INFO_QUERY` (atualmente const interna) como `isSupportInfoQuery()` para uso direto no orquestrador.

### 3. Ajustar a condição de entrada do fluxo de suporte
Na linha 2971, adicionar a verificação de `isSupportInfoQuery`:
```
if (!ticketBlocksSupport && !isSupportInfoQuery(message) && (isSupportMsg || (topic_context === "support" && !supportFlowStage)))
```

Isso garante que mesmo com `topic_context === "support"`, uma consulta informacional não entra no fluxo de criação.

## Arquivos alterados
| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/_shared/lia-guards.ts` | Exportar `isSupportInfoQuery()` |
| `supabase/functions/dra-lia/index.ts` | Adicionar interceptor de consulta de chamados + ajustar guard na entrada do fluxo de suporte |

## Exemplo de resposta esperada
```
📋 Seus chamados técnicos:

1. Chamado #0000000012-A (Aberto)
   📅 15/03/2026
   🔧 Medit i600
   📝 Problema de conectividade Bluetooth

Deseja abrir um novo chamado ou saber mais sobre algum desses?
```

