# Plano — Ativação & Validação End-to-End das Fases 3-5

## Etapa 1 — Secret HMAC
- `add_secret(['ZERNIO_WEBHOOK_SECRET'])` → você cola o valor que configurou na Zernio.
- Após salvo, `zernio-webhook` passa a rejeitar requests sem `X-Zernio-Signature` válido (SHA-256 HMAC do raw body).

## Etapa 2 — Crons (SQL insert direto, sem migration)
Ativar 4 jobs no `pg_cron` apontando para edge functions já deployadas:

```text
flow-executor          */1 * * * *   (avança sessões IG DM)
sequence-runner        */1 * * * *   (drips WhatsApp)
wa-broadcast-dispatch  */1 * * * *   (escala broadcasts agendados)
zernio-metrics-sync    */30 * * * *  (puxa likes/reach/views)
```

Headers: `apikey` + `Authorization` com anon key (padrão Supabase).

## Etapa 3 — Validar Flows IG DM (`/social/flows`)
1. Criar flow exemplo via UI:
   - Trigger: `comment_keyword` no post IG escolhido, keywords `["quero","info","preço"]`.
   - Nodes: `send_dm` ("Oi {{ig_username}}, te chamo aqui!") → `wait 30s` → `collect_input` ("Qual seu e-mail?") → `set_tag tag=lead-ig` → `create_lead form_name=ig_dm_flow` → `end`.
2. Disparar comentário real no post de teste.
3. Verificar: `social_sessions` cria linha `active`, `flow-executor` avança, DM chega, `social_contacts.tags` recebe `lead-ig`, `lia_attendances` ganha registro (`source=social_flow`).
4. Conferir `/social/flows/:id/sessions` mostra replay.

## Etapa 4 — Validar WhatsApp Broadcasts & Sequences
1. **Broadcast teste** em `/social/broadcasts`:
   - Segmento: `tags contém 'lead-ig'` (1-2 contatos de teste).
   - Mensagem curta, agendar para `now()+1min`.
   - Confirmar `wa_message_queue` populado, `wa-broadcast-dispatch` consome, Evolution API envia, `status=sent`.
2. **Sequence teste** em `/social/sequencias`:
   - 2 passos: msg imediata + msg após 2min.
   - Inscrever contato manualmente, observar `social_sequence_enrollments` avançar via `sequence-runner`.
3. Validar anti-ban: `send_after` espalhado, respeito a `evolution_instance_name` por team_member.

## Etapa 5 — Validar Analytics Zernio (`/social/analytics`)
1. Invocar `zernio-metrics-sync` manualmente (botão "Sync agora" ou `supabase.functions.invoke`).
2. Conferir `social_posts.likes/comments/reach/views/analytics_synced_at` atualizados.
3. Abrir `/social/analytics` e validar:
   - Cards de topo (alcance 7d/30d, engajamento médio).
   - Gráfico de linha (engajamento ao longo do tempo).
   - Heatmap dia×hora.
   - Tabela "Top posts" com thumbnails.
4. Testar export CSV.

## Etapa 6 — Relatório Final
Resumo consolidado com:
- Status de cada etapa (✅/⚠️/❌).
- Logs relevantes de cada edge function (últimos 20 eventos).
- Métricas iniciais (sessões criadas, mensagens enviadas, posts sincronizados).
- Próximos ajustes recomendados (rate-limit tuning, novos triggers, segmentos a refinar).

## Notas técnicas
- Crons usam `net.http_post` com anon key (não pode ir em migration porque contém URL/chave específicos do projeto — segue padrão Lovable).
- `zernio-webhook` é público (`verify_jwt=false`) e protegido por HMAC.
- Todas edge functions já estão deployadas; etapas 3-5 são apenas validação e disparo real.
- Se Zernio não tiver endpoint `/dm` (a confirmar no painel), fallback para Instagram Graph API (já mapeado, requer token IG).

## Ordem de execução em build mode
```text
1. add_secret ZERNIO_WEBHOOK_SECRET
2. supabase insert: 4 cron.schedule
3. criar flow teste (UI + SQL seed se preferir)
4. invocar zernio-metrics-sync manualmente
5. coletar logs + montar relatório
```

Aprovação para entrar em build mode e executar.