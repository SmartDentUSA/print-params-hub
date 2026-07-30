# Project Memory

- **Instância Institucional**: Danilo Henrique aposentada. Todo envio institucional (briefing, novos leads, broadcasts, Sentinela) sai por `smartdent_marketing` com a apikey dela.
- **Provedores WhatsApp**: Evolution API = mensagens individuais; EvolutionGO = grupos. Ativação por `*_enabled` + `*_status='connected'`. Nunca fallback automático entre provedores.

## Memories
- [WhatsApp Conversation Capture](mem://integration/wa-conversation-capture) — Cron captura conversas de todas as instâncias Evolution (vendedor/cs/suporte) para whatsapp_inbox
- [WA LID Phone-Only Match](mem://architecture/wa-lid-phone-only-match) — Vínculo de conversas @lid a leads só por telefone real; match por pushName é opt-in
- [Institutional Sender Instance](mem://integration/institutional-sender-instance) — Todo envio institucional via smartdent_marketing; CS e Suporte mantêm instâncias próprias
- [WA Dual Provider Router](mem://architecture/wa-provider-dual-router) — resolveProvider por operação, modo dual, blocked_provider na fila, proibição do fallback por credencial
