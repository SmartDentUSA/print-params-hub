# Analytics Social completo (Publicações + Inbox + Canais internos)

Hoje a aba `/social/analytics` mostra apenas o que está espelhado em `social_posts` (likes, comentários, shares, saves, alcance, impressões, views). Não existe cliques, seguidores, decay, frequência nem nada de inbox nessa tabela — esses números só existem na API do Zernio. A proposta é ler tudo ao vivo do Zernio (como já fazemos na aba Conversas) e acrescentar uma terceira aba com os canais internos: instâncias WhatsApp dos Team Members e a Dra. LIA.

## O que a aba passa a ter

### Aba "Publicações"
- Filtros no topo: período (7/30/90/180 dias), plataforma, perfil/conta conectada e origem (publicado via Zernio / externo).
- KPIs: taxa de engajamento, alcance, impressões, views, cliques, seguidores totais e crescimento no período.
- Engajamento ao longo do tempo com métrica selecionável (Likes, Comentários, Shares, Saves, Views, Impressões, Alcance, Cliques).
- Barras de posts por plataforma e likes por plataforma.
- Heatmap "melhor horário para postar" (dia da semana × hora).
- Evolução de seguidores por conta.
- Tabela "Top posts" com miniatura, legenda, plataforma, data e todas as colunas de métricas, ordenável.
- Frequência de postagem × engajamento (scatter) e acumulação de engajamento (content decay).
- Exportação CSV do período.

### Aba "Inbox"
- KPIs: recebidas, enviadas, conversas únicas, lidas, falhas e taxa de resposta.
- Mensagens ao longo do tempo (recebidas vs enviadas) e por plataforma.
- Tempo de resposta: mediana, média, p90 e p99 + histograma por faixa (0-1m, 1-5m, ... 1d+).
- Top contas por volume (recebidas / enviadas / conversas).
- Origem das mensagens enviadas (humano, workflow, sequência, broadcast, automação de comentário, api).
- Heatmap dia × hora de quando as mensagens chegam.

### Aba "Canais internos" (WhatsApp Team Members + Dra. LIA)
- Um card por instância Evolution cadastrada em Team Members: vendedor, instância, telefone, status da sessão (aberta/erro, último sucesso e último erro), mensagens individuais enviadas no período (ok/falha) e envios em grupo.
- Série diária de envios WhatsApp.
- Bloco Dra. LIA: interações, sessões, sessões com atendimento humano/handoff, perguntas sem resposta, similaridade média do RAG e nota média do juiz, com série diária de interações e de sem-resposta.

## Detalhes técnicos

1. **Nova edge function `social-analytics`**, no mesmo padrão do `social-inbox` (chave `ZERNIO_API_KEY` apenas no servidor), com um `action` por endpoint:
   - Publicações: `GET /v1/analytics` (lista + overview + contas), `/v1/analytics/daily-metrics`, `/v1/analytics/best-time`, `/v1/analytics/posting-frequency`, `/v1/analytics/content-decay`, `/v1/accounts/follower-stats`.
   - Inbox: `/v1/analytics/inbox/volume`, `/inbox/heatmap`, `/inbox/response-time`, `/inbox/source-breakdown`, `/inbox/top-accounts`.
   - Repassa `platform`, `profileId`, `accountId`, `source`, `fromDate`, `toDate`, `limit`, `page`, `sortBy`, `order` e devolve status + corpo do Zernio em caso de erro (inclui o 402/403 "Analytics add-on required", que a UI mostra como aviso em vez de tela vazia).
2. **Migração (apenas uma função SQL)**: `fn_social_internal_analytics(p_days int)`, `security definer`, com `grant execute` para `authenticated` e `service_role`. Agrega no período: instâncias de `team_members` com `evolution_instance_name`, status de `wa_provider_session_health`, contagens de `message_logs` e `wa_send_log` por instância, série diária de envios e métricas de `agent_interactions` / `agent_sessions` (Dra. LIA). Nenhuma tabela nova.
3. **Hooks**: `src/hooks/social/useZernioAnalytics.ts` (uma query por endpoint, `staleTime` de 5 min) e `src/hooks/social/useInternalChannelAnalytics.ts` (chama a RPC).
4. **UI**: `SocialAnalytics.tsx` reescrito com `Tabs` (Publicações / Inbox / Canais internos) e subcomponentes em `src/components/social/analytics/` (`PostingTab.tsx`, `InboxTab.tsx`, `InternalChannelsTab.tsx`, `KpiStrip.tsx`, `MetricHeatmap.tsx`) para manter arquivos pequenos. Gráficos com recharts (linha, barra, scatter) e apenas tokens semânticos do design system. Rota e item da sidebar continuam os mesmos.
5. `social_posts` e o `zernio-metrics-sync` ficam intocados; a aba passa a ler do Zernio ao vivo e usa o espelho local apenas como fallback quando a API não responde.