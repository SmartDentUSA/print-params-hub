# 09 — QA e Jornadas do Usuário

## 9.1 Jornadas ponta a ponta

### J1 — Lead de Meta Ads até vendedor com briefing
```text
Anúncio Meta → formulário instantâneo
  ├─(A) meta-lead-ads-pull (cron 1 min, lookback adaptativo ≥30 min)
  └─(B) webhook Zernio (redundância, ack 200 + background)
        → dedupe (zernio_leadgen_dedup / meta_lead_ingestion_log)
        → smart-ops-ingest-lead: normaliza taxonomia + resolve form→produto (meta_form_mappings)
        → identidade: encontra lead canônico ou cria (merged_into IS NULL)
        → smart-ops-lia-assign: commercial-intent + golden-rule-guard
              → cria Person/Company/Deal no PipeRun (Funil de Vendas)
        → distribuição round-robin entre team_members ativos
        → briefing 7×3 ao vendedor via WhatsApp (smartdent_marketing)
        → smart-ops-lead-welcome ao lead (checa connectionState)
```
**Pontos de falha monitorados**: lookback curto, form sem mapeamento, `owner_id` inválido, instância WhatsApp desconectada, deal bloqueado por regra de 30 dias.

### J2 — Proposta e faturamento
`Deal no PipeRun → itens (deal_items) → resolução de SKU (catalog-sku-resolver) → proposta → ganho → NF no Omie → omie-sync-nf → receita Max(CRM, Omie) → Painel Comercial (cache 15 min)`

### J3 — Treinamento e NPS
`Busca de deal (fn_search_deals_for_training) → matrícula → grupo WA da turma → treinamento → certificado → +24 h NPS por WhatsApp → /nps/:token → nota espelhada no PipeRun e na ficha`

### J4 — Conteúdo e SEO/GEO
`Lacuna detectada (agent_knowledge_gaps) → artigo (IA + revisão humana) → SEO/FAQ/mídia → publicar → ping Google → indexação → visitante/bot (seo-proxy) → Dra. LIA usa no RAG → lead`

### J5 — Campanha de e-mail
`Segmentação → wizard (3 passos) → agenda → fila → smartops-email-tick (1 min, 07:30–19:00, ~499/dia) → short link existente → clique → lead/deal → histórico com enfileirados × enviados`

## 9.2 Casos de teste críticos (regressão obrigatória)

| ID | Cenário | Passos | Resultado esperado |
|---|---|---|---|
| T01 | Lead Meta duplicado nos dois canais (pull + Zernio) | enviar mesmo `leadgen_id` por ambos | 1 lead, 1 deal; segundo evento marcado como duplicado |
| T02 | Regra de Ouro — deal CS existente | lead com deal em CS faz nova solicitação | deal CS intacto; novo deal em Vendas criado |
| T03 | Regra de Ouro — estagnado perdido | lead com todos os estagnados em "perdida" | novo deal em Vendas é criado (não abortar) |
| T04 | Lead sem histórico | lead novo sem CS e sem estagnados | não abre deal; skip logado em `system_health_logs` |
| T05 | WhatsApp individual em instância offline | `connectionState != open` | não envia; log explícito; sem falso positivo de sucesso |
| T06 | Roteamento de grupo | disparo para grupo | usa EvolutionGO; nunca Evolution |
| T07 | Merge de identidade | dois leads, CNPJs diferentes, mesmo telefone | **não** fundir; entrar na fila de revisão |
| T08 | Formulário Meta sem mapeamento | `form_id` inexistente em `meta_form_mappings` | lead entra, produto = não identificado, aparece em `list_unmapped_meta_forms` |
| T09 | Produto "Outras" | texto com marca de impressora conhecida | classifica pela marca, não "Outras" |
| T10 | Taxonomia | payload com cargo em campo de área | `area_atuacao` não contaminado |
| T11 | Short link | gerar e-mail com LP existente | reusa URL curta; não cria nova |
| T12 | NPS token expirado | abrir `/nps/:token` vencido | HTTP 410 com mensagem clara |
| T13 | Painel de TV | RPCs sem sessão | retorna agregados; nenhum dado pessoal |
| T14 | Export completo | clicar "Exportar Tudo" sem sessão | erro "Sessão expirada"; nada é baixado |
| T15 | Reconciliação de funil | deal arquivado no PipeRun | espelho local marcado `is_deleted`; contagem de abertos confere com CRM |
| T16 | SKU fora de catálogo | item de proposta com nome livre | aparece na inbox; após vínculo, resolve nas próximas |
| T17 | Receita do mês | deal ganho + NF Omie do mesmo cliente | usa Max, não soma duplicada |
| T18 | Fila de e-mail fora da janela | agendar 22:00 | fica enfileirado; dispara na janela seguinte |
| T19 | Role `distribuidor` | login | vê somente Smart Ops → Distribuição |
| T20 | Role inexistente | login sem `user_roles` | tela "Acesso Negado" |

## 9.3 Critérios de aceite por módulo

| Módulo | Aceite |
|---|---|
| Ingestão | 100% dos leads do período aparecem em `lia_attendances`; divergência ≤0 contra export da plataforma de origem |
| CRM | contagem de deals abertos no Funil de Vendas = contagem via API PipeRun (tolerância 0) |
| Receita | KPI do painel = relatório comercial = `Max(CRM, Omie)` do mês |
| WhatsApp | 0 envio tentado em instância `connectionState != open` |
| Identidade | 0 merge automático com documentos válidos divergentes |
| NPS | toda resposta gera nota no PipeRun em ≤5 min |
| SEO | artigo publicado gera ping de indexação e aparece no sitemap |

## 9.4 Cobertura atual de testes

| Tipo | Situação |
|---|---|
| Testes unitários (frontend) | ausentes no repositório |
| Testes de Edge Function (Deno) | ausentes (nenhum `*_test.ts` nas funções) |
| Testes E2E | ausentes |
| Validação em produção | manual, via botões de self-test (`wa-provider-selftest`, `smart-ops-integration-check`) e watchdogs em cron |

**Recomendação mínima viável**: testes Deno para `_shared/golden-rule-guard.ts`, `commercial-intent.ts`, `dental-taxonomy.ts`, `meta-form-resolver.ts`, `catalog-sku-resolver.ts` e `wa-provider-router.ts` — são funções puras e concentram as regras de maior impacto financeiro.