

## Problema

O lead `afonsomsjunior@hotmail.com` está sendo encontrado no Omie (a busca por email/CPF funciona), mas as buscas de pedidos e contas a receber dão **timeout na página 11** porque o código itera TODAS as páginas do Omie filtrando in-code pelo `codigo_cliente`, ao invés de usar os filtros nativos da API.

Evidência dos logs:
- 3 execuções consecutivas: `sync-lead: timeout pedidos na página 11` → `0 pedidos, 0 CR`
- O `omie_codigo_cliente` permanece null apesar do `omie_last_sync` atualizar

## Causa Raiz

1. `runSyncLead` linha 980: comenta "Omie ListarPedidos não suporta filtrar_por_cliente" — **incorreto**. A API Omie aceita `filtrar_por_cliente` no endpoint de pedidos e `nCodCliente` no endpoint de contas a receber.

2. O `patchLeadFromCliente` pode não estar salvando `omie_codigo_cliente` se `parsed.codigoCliente` vier null da API. É preciso adicionar log para rastrear.

## Correções

### Arquivo: `supabase/functions/omie-lead-enricher/index.ts`

**1. Adicionar log na busca por email/CPF no sync-lead** (linhas 939-970)
- Logar se o cliente foi encontrado ou não, e qual `codigoCliente` retornou
- Logar o resultado do `patchLeadFromCliente`

**2. Usar filtro nativo da API Omie em `runSyncLead`** (linhas 980-1037)
- Pedidos: passar `filtrar_por_cliente: omieCodigoCliente` nos params de `ListarPedidos`
- Remover o filtro in-code por `codigo_cliente`
- Resultado: apenas pedidos daquele cliente retornam, reduzindo de 11+ páginas para 1-2

**3. Usar filtro nativo em contas a receber** (linhas 1040-1096)
- Passar `nCodCliente: omieCodigoCliente` nos params de `ListarContasReceber`
- Remover filtro in-code

**4. Usar filtro por cliente no `runSync` Fase B** (linhas 777-920)
- Manter iteração completa mas com performance melhor usando `filtrar_por_cliente` quando disponível

**5. Garantir que `omie_codigo_cliente` é salvo mesmo sem pedidos**
- Na lógica do sync-lead, após encontrar o cliente por email/CPF, confirmar que o update no banco executou com sucesso

## Resultado Esperado
- sync-lead do Afonso completa em <5s (apenas pedidos dele)
- `omie_codigo_cliente` preenchido
- `deal_items` e `omie_parcelas` populados (se existirem pedidos/CR no Omie)
- Abas ERP e Financeiro funcionando no card

