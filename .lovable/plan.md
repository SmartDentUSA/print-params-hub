## Problema
Insert em `campaign_sessions` pelo frontend falha com RLS. Hoje só existem:
- SELECT para admins
- ALL para service_role

Sem policy de INSERT/UPDATE, o disparo SMS quebra ao criar a sessão da campanha.

## Correção
Migration adicionando policies de INSERT e UPDATE para admins na tabela `campaign_sessions`:

```sql
CREATE POLICY "Admins insert campaign_sessions"
ON public.campaign_sessions FOR INSERT TO authenticated
WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "Admins update campaign_sessions"
ON public.campaign_sessions FOR UPDATE TO authenticated
USING (public.is_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())));
```

Nenhuma mudança de código frontend/backend. Depois disso o fluxo SMS (exocad) segue direto para `smart-ops-sms-disparopro`.
