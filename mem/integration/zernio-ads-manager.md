---
name: Zernio Ads Manager
description: Aba Anúncios da Central de Campanhas lê campanhas/anúncios Meta via social-analytics (actions ads_list, ads_campaigns, ads_insights)
type: feature
---
Central de Campanhas (`SmartOpsCampaigns.tsx`) tem aba **Anúncios** (`src/components/campaigns/ZernioAdsTab.tsx`
+ `ZernioAdDetailDialog.tsx`, hook `src/hooks/social/useZernioAds.ts`).

Edge function `social-analytics` (ZERNIO_API_KEY server-only) ganhou 3 actions:
- `ads_campaigns` → `/v1/ads/campaigns` — `campaignName`, `platformCampaignId`, `adCount`, `budget{amount,type}`,
  `platformAdAccountName`, `metrics{spend,impressions,reach,clicks,ctr,cpc,cpm,conversions,costPerConversion,actions{},actionValues{}}`.
  Leads reais = `metrics.actions.lead` (não `conversions`).
- `ads_list` → `/v1/ads` — filtros `platform`/`status`/`days`; `_id` interno, `platformAdId` (Meta), `creative{thumbnailUrl,imageUrl,videoUrl,instagramPermalinkUrl,body}`.
- `ads_insights` → `/v1/ads/insights` — passthrough Meta; exige `accountId` (Zernio) + `objectId` **ID Meta**
  (`platformAdId`/campaignId; ID interno dá 400 `invalid_field_value`). Aceita `level`, `days`,
  `fields=spend,impressions,clicks,ctr,cpc,cpm,reach` e `timeIncrement=1` para série diária.

Hierarquia da UI é montada no cliente: anúncios de `ads_list` agrupados por `platformCampaignId`.