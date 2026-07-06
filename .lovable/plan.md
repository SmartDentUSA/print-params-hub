## Diagnóstico

O erro `supabase.rpc(...).catch is not a function` vem de `supabase/functions/wa-dispatcher/index.ts` linha ~235-240:

```ts
await supabase.rpc('fn_record_group_send', { ... })
  .catch((e) => console.error('[v66eg] fn_record_group_send failed', e))
```

`supabase.rpc()` retorna um `PostgrestFilterBuilder` que é *thenable* (implementa `.then`) mas **não** tem `.catch`. Ao encadear `.catch(...)` antes do `await`, o runtime chama `.catch` num objeto que não é um Promise → `TypeError: .catch is not a function`.

**Consequência real:** esse trecho roda **logo depois** do envio bem-sucedido via Evolution (fingerprint de dedupe). O erro é lançado, capturado pelo `catch (err)` externo do dispatcher, que:
1. Marca a mensagem como `failed` com esse texto no `error_message`.
2. Insere `success: false` em `wa_send_log`.
3. Depois de 3 tentativas, marca a **campanha inteira como `status='error'`** (ver linha ~260).

A mensagem foi enviada de verdade no WhatsApp, mas a UI mostra `failed` / “Erro” / “sessão quebrada” (via lógica de `consecutive_send_errors` que não é acionada aqui, mas o resultado final é o mesmo pra visualização). Isso explica exatamente o quadro que você vê em `[Smart Dent] - Export - MKT` (Erro) e por que os pending nunca avançam.

Por que aparece só em `smartdent_marketing`? Porque essa instância está no caminho **Baileys** (sem `evo_go_instance_token`) e alcança essa linha após um envio OK. Instâncias EvoGo (Paula/cs_principal via 8081) também deveriam cair aqui, mas os pending atuais delas ainda estão travando antes por outras razões — a bug afeta qualquer envio Baileys de sucesso.

## Correção

Substituir o `.catch` inválido por tratamento correto:

```ts
try {
  const { error: recErr } = await supabase.rpc('fn_record_group_send', {
    p_group_jid: item.group_jid,
    p_content_hash: cHash,
    p_node_type: item.node_type,
    p_campaign_id: item.campaign_id,
  })
  if (recErr) console.error('[v66eg] fn_record_group_send failed', recErr)
} catch (e) {
  console.error('[v66eg] fn_record_group_send threw', e)
}
```

Isso garante que uma falha ao gravar o fingerprint **não** propague e não derrube o envio já efetuado.

## Limpeza pós-fix (dados)

Após deploy do wa-dispatcher corrigido, rodar SQL de reconciliação para as mensagens marcadas como falha por esse bug específico:

```sql
-- Reabrir apenas mensagens com esse erro exato, sem estar bloqueadas por sessão
UPDATE wa_message_queue
SET status = 'sent',
    error_message = NULL,
    delivery_status = COALESCE(delivery_status, 'sent_to_server')
WHERE error_message ILIKE '%rpc(...).catch is not a function%'
  AND status = 'failed'
  AND evo_message_id IS NOT NULL;

-- Reativar campanhas que caíram em 'error' só por esse bug
UPDATE wa_campaigns
SET status = 'active'
WHERE status = 'error'
  AND id IN (
    SELECT DISTINCT campaign_id FROM wa_message_queue
    WHERE error_message ILIKE '%rpc(...).catch is not a function%'
  );
```

Confirmo o SQL antes de executar; se preferir não tocar o histórico só corrijo o código e deixo os registros como estão.

## Escopo

- **Alterar:** apenas `supabase/functions/wa-dispatcher/index.ts` (~5 linhas).
- **Não tocar:** `_shared/evolution.ts`, credenciais, `team_members`, `wa_groups`, RPCs SQL, EvoGo, UI.
