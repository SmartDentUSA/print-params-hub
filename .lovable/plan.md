

## Corrigir Polling da Loja Integrada — Cursor e Captura em Tempo Real

### Problema Raiz

O polling atual tem 3 falhas críticas:

1. **Cursor lido da tabela errada**: busca `MAX(lojaintegrada_updated_at)` de `lia_attendances`. Se o webhook falha ao processar um pedido (e 440 de 500 falharam na última execução), o campo nunca é atualizado → cursor não avança → reprocessa os mesmos pedidos antigos infinitamente.

2. **Sem persistência independente do cursor**: ao contrário do sync Omie (que usa `omie_sync_cursors`), o polling LI não tem cursor próprio. Se nenhum pedido é processado com sucesso, ele reinicia do zero.

3. **Sem timeout guard**: a edge function tem limite de ~50s. Processar 500 pedidos com resolução de cliente (300ms cada) + chamada webhook = timeout garantido nas páginas finais, perdendo pedidos.

### Solução

#### 1. Cursor dedicado na tabela `omie_sync_cursors`

Reutilizar a tabela existente `omie_sync_cursors` (colunas `key`, `value`) com a chave `li_poll_since` para armazenar o timestamp do último pedido processado com sucesso.

**Leitura do cursor (antes do loop):**
```typescript
const { data: cursor } = await supabase
  .from('omie_sync_cursors')
  .select('value')
  .eq('key', 'li_poll_since')
  .maybeSingle();
since = cursor?.value || undefined;
```

**Atualização do cursor (após cada pedido processado):**
Rastrear o `data_modificada` mais recente dos pedidos processados com sucesso e salvar no final (upsert).

#### 2. Timeout guard (50s)

Adicionar verificação de tempo decorrido antes de processar cada pedido. Se ultrapassar 45s, salvar o cursor no ponto atual e retornar o resultado parcial.

```typescript
const startTime = Date.now();
const TIMEOUT_MS = 45_000;

// Dentro do loop:
if (Date.now() - startTime > TIMEOUT_MS) {
  console.warn('[poll-li] Timeout guard — saving cursor and returning');
  break;
}
```

#### 3. Ordenação reversa (recentes primeiro)

A API LI suporta `order_by`. Alterar para buscar pedidos mais recentes primeiro:
```
/pedido/?limit=20&offset=0&order_by=-data_modificada
```

Isso garante que pedidos recentes (como o do Thiago) são processados mesmo que o timeout interrompa antes de completar todas as páginas.

#### 4. Batch size menor

Reduzir de 50 para 20 pedidos por página. Com resolução de cliente (300ms) + webhook (~500ms) por pedido, 20 pedidos = ~16s por página. Em 45s cabem ~2-3 páginas com segurança.

#### 5. Avanço incremental do cursor

O cursor avança baseado no `data_modificada` mais recente dos pedidos **processados com sucesso** (não dos buscados). Isso garante que pedidos falhados serão re-tentados na próxima execução.

```typescript
let maxTimestamp = since || '';

for (const pedido of pedidos) {
  // ... processar ...
  if (success) {
    const ts = pedido.data_modificada || pedido.data_criacao;
    if (ts && ts > maxTimestamp) maxTimestamp = ts;
  }
}

// Após o loop de páginas, salvar cursor
if (maxTimestamp && maxTimestamp !== (since || '')) {
  await supabase.from('omie_sync_cursors').upsert(
    { key: 'li_poll_since', value: maxTimestamp },
    { onConflict: 'key' }
  );
}
```

### Arquivos alterados

1. **`supabase/functions/poll-loja-integrada-orders/index.ts`** — cursor dedicado, timeout guard, ordenação reversa, batch menor

### Sem mudanças de banco

A tabela `omie_sync_cursors` já existe com a estrutura necessária (`key` text PK, `value` text).

### Resultado esperado

- Polling processa pedidos recentes primeiro (últimas horas/dias)
- Cursor avança independentemente do sucesso do webhook
- Timeout guard salva progresso parcial — próxima execução continua de onde parou
- Pedidos como o do Thiago são capturados na próxima execução do cron (5 min)

