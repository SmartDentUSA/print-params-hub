## Objetivo
Adicionar verificação de deduplicação (dedup) no início do bloco `try{}` da função `triggerOutboundMessages` no edge function `smart-ops-lia-assign`, garantindo que o briefing só seja enviado 1x por lead por dia.

## Local
`supabase/functions/smart-ops-lia-assign/index.ts`, linha ~1565 (início do bloco try dentro de `triggerOutboundMessages`)

## Alteração
Inserir como **primeira linha dentro do `try{}`**, antes de qualquer outra operação:

```typescript
    // DEDUP: garantir que briefing seja enviado apenas 1x por lead por dia
    const leadId = lead.id as string;
    const { data: lockAcquired } = await supabase
      .rpc('try_acquire_briefing_lock', { p_lead_id: leadId });
    if (!lockAcquired) {
      console.log(`[lia-assign] Briefing já enviado hoje para ${leadId}, bloqueado`);
      return;
    }
```

## Contexto
- A função PostgreSQL `try_acquire_briefing_lock(p_lead_id uuid)` já existe no banco e executa `INSERT INTO briefing_locks (lead_id, lock_date) VALUES (p_lead_id, CURRENT_DATE) ON CONFLICT (lead_id, lock_date) DO NOTHING;` retornando `FOUND` (boolean).
- A função `triggerOutboundMessages` está nas linhas 1549-1603.
- O bloco `try{}` inicia na linha 1565. O lock deve ser a **primeira** operação dentro do try, antes do fetch em `team_members` (linha 1567).

## Deploy
Após a alteração, deploy automático do edge function `smart-ops-lia-assign`.