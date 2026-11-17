# Reduzir "Sem origem marcada" no comparativo por canal (BLACK26)

## O que os dados mostram (formulário # - [BLACK26] - Campanha ativa)
- "Sem origem marcada" = acessos que chegaram sem a marcação `?o=` (e-mail, SMS, WhatsApp, grupos, Bio).
- 31 aberturas da página e 27 eventos do simulador estão sem origem; só a Bio aparece marcada (12 aberturas, 7 eventos).
- Parte vem de antes da marcação existir (primeiros acessos às 14:13 de 16/11; a marcação começou às 16:18).
- O resto vem de links sem `?o=`: link direto da landing, links já divulgados antes, compartilhamentos e o simulador aberto a partir da landing quando a origem não é repassada.

## O que vou fazer
1. **Repassar a origem da landing para o simulador**: quem entra na landing com `?o=` mantém essa origem ao clicar em qualquer botão de WhatsApp (guardada na sessão do navegador).
2. **Descobrir a origem quando não há `?o=`**: usar `utm_source`/`utm_medium` do link e o site de onde a pessoa veio (Instagram, Facebook, Google, WhatsApp, e-mail) para preencher a origem automaticamente.
3. **Separar o que sobra**: "Acesso direto" (digitou o endereço/sem referência) e "Antes da marcação" (acessos anteriores a 16/11 16:18), em vez de um único "Sem origem marcada".
4. **Links novos sempre marcados**: telas de e-mail, SMS, WhatsApp oficial, Post Grupos e Bio passam a incluir `?o=` sempre (conferir as que ainda não incluem).

Os números antigos não são reescritos; a melhora vale para os próximos acessos.

## Detalhes técnicos
- `src/lib/clickOrigin.ts`: `resolveClickOrigin()` com cascata `?o=` > sessionStorage > utm > `document.referrer`; novos rótulos `direto` e `pre_tracking`.
- `CustomLandingFrame`/`PublicLandingPage` → `buildLiaUrl` acrescenta `o=`; `AgentEmbed` grava `origin_channel`.
- `fn_attendance_origin_metrics`: classificar nulos com `created_at` < início da marcação como `pre_tracking` (só leitura, sem alterar linhas).
- Teste bun para a cascata de origem.
