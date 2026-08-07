# Project Memory

- **Instância Institucional**: Danilo Henrique aposentada. Todo envio institucional (briefing, novos leads, broadcasts, Sentinela) sai por `smartdent_marketing` com a apikey dela.
- **Provedores WhatsApp**: Evolution API = mensagens individuais; EvolutionGO = grupos. Ativação por `*_enabled` + `*_status='connected'`. Nunca fallback automático entre provedores.

## Memories
- [WhatsApp Conversation Capture](mem://integration/wa-conversation-capture) — Cron captura conversas de todas as instâncias Evolution (vendedor/cs/suporte) para whatsapp_inbox
- [WA LID Phone-Only Match](mem://architecture/wa-lid-phone-only-match) — Vínculo de conversas @lid a leads só por telefone real; match por pushName é opt-in
- [Institutional Sender Instance](mem://integration/institutional-sender-instance) — Todo envio institucional via smartdent_marketing; CS e Suporte mantêm instâncias próprias
- [WA Dual Provider Router](mem://architecture/wa-provider-dual-router) — resolveProvider por operação, modo dual, blocked_provider na fila, proibição do fallback por credencial
- [Placeholder Identity Guard](mem://architecture/placeholder-identity-guard) — Nota do vendedor nunca mostra import_*@placeholder.local / "Nome não informado"; recupera identidade real pelo telefone
- [Meta Form Origin Governance](mem://integration/meta-form-origin-governance) — Origem no CRM = origin_system_b de meta_form_mappings; nome cru do form Meta é só fallback
- [kanban-move Desligado](mem://architecture/kanban-move-desligado) — smart-ops-kanban-move sem chamadores; move de etapa em Vendas é manual
- [Lead Opportunities Taxonomy Auto-Register](mem://architecture/lead-opportunities-taxonomy-autoregister) — Trigger cadastra product_key ausente em product_taxonomy; impede erro 23503 em massa no compute-opportunity-engine
- [Painel Comercial (TV)](mem://features/painel-comercial-tv) — /painel-comercial lê só painel_comercial_cache (refresh por cron 15 min); nunca consulta deals/transições direto
- [Email Integrity Guard](mem://architecture/email-integrity-guard) — Trigger fn_sanitize_lead_email + _shared/email-sanitize.ts: email canônico único, secundários em email_secundarios, bruto inválido em email_invalido_raw
- [CRM Timeline Parity](mem://architecture/crm-timeline-parity) — crm_proposal/crm_deal_snapshot emitidos por webhook + reconciliador API; pendências em crm_timeline_unresolved
- [Zernio Social Analytics](mem://integration/zernio-social-analytics) — Aba Analytics (Publicações/Inbox/Canais internos) via social-analytics + fn_social_internal_analytics
- [Zernio Unified Inbox](mem://integration/zernio-unified-inbox) — Aba Conversas do Social Publisher lê/responde DMs via edge function social-inbox (proxy Zernio)
- [Zernio Ads Manager](mem://integration/zernio-ads-manager) — Aba Anúncios (Central de Campanhas) lê campanhas/anúncios/insights Meta via social-analytics
- [Campaign Revenue Attribution](mem://marketing/campaign-revenue-attribution) — Receita/vendas/lead time por campanha só com closed_at real e após a conversão do lead; detalhe com cross-sell
