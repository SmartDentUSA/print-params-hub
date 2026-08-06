---
name: Zernio Social Analytics
description: Aba Analytics do Social Publisher (3 tabs) lê métricas Zernio via edge function social-analytics + canais internos (WhatsApp/LIA) via fn_social_internal_analytics
type: feature
---
`/social/analytics` (`SocialAnalytics.tsx`) tem 3 abas: **Publicações**, **Inbox**, **Canais internos**.

Edge function `social-analytics` (proxy Zernio, `ZERNIO_API_KEY` server-only) — actions e shapes reais:
- `posts` → `{ overview:{totalPosts,publishedPosts,lastSync}, posts[], accounts[{followersCount}], hasAnalyticsAccess }`.
  Post: `_id`, `platform`, `platformPostUrl`, `thumbnailUrl`/`mediaItems[].thumbnail`, `publishedAt`, `analytics{likes,comments,shares,saves,views,impressions,reach,clicks,engagementRate}`.
  `overview` NÃO traz engagementRate → a taxa é a média dos `analytics.engagementRate` dos posts.
- `daily_metrics` → `{ dailyData[{date,postCount,metrics}], platformBreakdown[] }`
- `best_time` → `{ slots[{day_of_week,hour,avg_engagement,post_count}] }` (UTC)
- `posting_frequency` → `{ frequency[{platform,posts_per_week,avg_engagement_rate,weeks_count}] }`
- `content_decay` → `{ buckets[{bucket_order,bucket_label,avg_pct_of_final}] }`
- `follower_stats` → `{ accounts[{currentFollowers,growth,growthPercentage,dataPoints}], stats:{ accountId:[{date,followers}] } }`.
  Séries por conta começam em datas diferentes → aplicar forward+backward fill antes de somar; crescimento do período = soma de `accounts[].growth`.
- `inbox_volume`, `inbox_heatmap`, `inbox_response_time`, `inbox_source_breakdown`, `inbox_top_accounts`.

Canais internos: RPC `fn_social_internal_analytics(p_days)` agrega instâncias Evolution de `team_members`
(+ `message_logs`/`wa_send_log`/`wa_provider_session_health`) e Dra. LIA (`agent_interactions`/`agent_sessions`).
Vários team_members compartilham o mesmo `evolution_instance_name` → chave de lista deve incluir índice.
