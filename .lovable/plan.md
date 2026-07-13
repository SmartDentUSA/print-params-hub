## Ajustes de exibição de produto no Stripe / Pagamentos

### 1. Mapa de produto (slug → label amigável)
Criar um dicionário no `SmartOpsStripePayments.tsx` para exibir nomes legíveis em vez dos slugs vindos do Stripe:

```
ativacao_dentalcad_ultimate_lab_bundle_rms  → "Ativação DentalCAD Ultimate Lab Bundle - RMS"
ativacao_exocad_dentalcad_ia                → "Ativação DentalCAD Ultimate Lab Bundle - RMS" (alias legado)
exocad_ultimate_bundle_rms                  → "Exocad Ultimate Bundle (RMS)"
```

Aplicar o mapa ao renderizar a coluna **Produto** (fallback: slug original quando não mapeado).

### 2. Correção de dado — CARMEN LUCIA DE ARAUJO HADDAD
Atualizar o registro específico via `supabase--insert`:
- Em `lead_activity_log` (evento `stripe_checkout_completed` do cliente CARMEN): trocar `event_data.product` de `ativacao_exocad_dentalcad_ia` para `ativacao_dentalcad_ultimate_lab_bundle_rms`.
- Em `stripe_subscriptions` (mesmo `stripe_customer_id`): idem no campo `product`.

### 3. Mensalidade
O usuário deixou o item em aberto ("Mensalidade ->"). **Pergunta pendente antes de implementar:** qual o slug/label da mensalidade a exibir? (ex.: `mensalidade_dentalcad_ultimate_lab_bundle_rms` → "Mensalidade DentalCAD Ultimate Lab Bundle - RMS"?). Caso confirme, adiciono ao mapa da etapa 1.

### Escopo
Somente exibição + correção pontual do registro da CARMEN. Sem mudanças de schema, webhook ou lógica de billing.
