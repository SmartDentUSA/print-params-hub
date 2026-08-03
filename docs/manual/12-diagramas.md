# 12 — Diagramas

## 12.1 Arquitetura geral

```mermaid
flowchart TB
  subgraph Clientes
    V[Visitante / Bot]:::x
    O[Operador Admin]:::x
  end
  subgraph Vercel
    SPA[SPA React 18 + Vite]
    RW[Rewrites: /api/v1 · /ai-search · seo-proxy]
    RT[api/render-template - Chromium]
  end
  subgraph Supabase
    EF[238 Edge Functions Deno]
    PG[(Postgres 265 tabelas · RLS · pgvector)]
    CR[pg_cron 83 jobs]
    ST[(Storage)]
  end
  subgraph Externos
    PR[PipeRun CRM]
    OM[Omie ERP]
    MT[Meta Lead Ads]
    ZN[Zernio]
    EV[Evolution / EvolutionGO]
    SP[Stripe]
    GG[Google / Gmail / Drive / GSC]
    AI[LLMs: DeepSeek · Gemini · Anthropic · OpenRouter]
  end
  V --> RW --> EF
  V --> SPA
  O --> SPA --> EF
  SPA --> PG
  EF --> PG
  EF --> ST
  CR --> EF
  EF <--> PR
  EF <--> OM
  MT --> EF
  ZN --> EF
  EF <--> EV
  SP --> EF
  EF <--> GG
  EF --> AI
  RT --> ST
  classDef x fill:#eef,stroke:#88a
```

## 12.2 DER simplificado (núcleo)

```mermaid
erDiagram
  LIA_ATTENDANCES ||--o{ DEALS : "lead_id"
  LIA_ATTENDANCES ||--o{ LEAD_OPPORTUNITIES : ""
  LIA_ATTENDANCES ||--o{ LEAD_STATE_EVENTS : ""
  LIA_ATTENDANCES ||--o{ CS_NPS_RESPONSES : ""
  LIA_ATTENDANCES ||--o{ SMARTOPS_COURSE_ENROLLMENTS : "via deal"
  LIA_ATTENDANCES ||--o| LIA_ATTENDANCES : "merged_into"
  DEALS ||--o{ DEAL_ITEMS : ""
  DEALS ||--o{ DEAL_STAGE_HISTORY : ""
  DEAL_ITEMS }o--|| SYSTEM_A_CATALOG : "sku via produto_aliases"
  SYSTEM_A_CATALOG ||--o{ CATALOG_PRODUCT_VARIATIONS : ""
  SYSTEM_A_CATALOG ||--o{ CATALOG_KIT_COMPONENTS : ""
  OMIE_NOTAS_FISCAIS }o--|| LIA_ATTENDANCES : "cnpj/cpf"
  LOJA_INTEGRADA_ORDERS }o--|| LIA_ATTENDANCES : "email/phone"
  TEAM_MEMBERS ||--o{ DEALS : "owner"
  SMARTOPS_FORMS ||--o{ SMARTOPS_FORM_FIELDS : ""
  SMARTOPS_FORMS ||--o{ SMARTOPS_FORM_FIELD_RESPONSES : ""
  META_FORM_MAPPINGS ||--o{ LIA_ATTENDANCES : "form_id -> produto"
  SMARTOPS_COURSES ||--o{ SMARTOPS_COURSE_TURMAS : ""
  SMARTOPS_COURSE_TURMAS ||--o{ SMARTOPS_COURSE_ENROLLMENTS : ""
```

## 12.3 Sequência — lead Meta até briefing

```mermaid
sequenceDiagram
  participant M as Meta
  participant Z as Zernio Webhook
  participant I as smart-ops-ingest-lead
  participant A as smart-ops-lia-assign
  participant P as PipeRun
  participant W as WhatsApp Router
  M->>Z: leadgen (POST)
  Z->>Z: claim atômico (dedup)
  Z-->>M: 200 OK (imediato)
  Z->>I: EdgeRuntime.waitUntil(processa)
  I->>I: normaliza taxonomia + resolve form→produto
  I->>A: lead canônico
  A->>A: commercial-intent + golden-rule-guard
  A->>P: cria Person/Company/Deal (Funil de Vendas)
  A->>W: briefing 7x3 ao vendedor (Evolution)
  A->>W: boas-vindas ao lead (checa connectionState)
```

## 12.4 Estados do lead

```mermaid
stateDiagram-v2
  [*] --> Captado
  Captado --> Qualificado: taxonomia + produto resolvido
  Captado --> SemIntencao: sem sinal comercial
  Qualificado --> EmVendas: deal criado (Funil de Vendas)
  EmVendas --> Ganho
  EmVendas --> Perdido
  EmVendas --> Estagnado
  Estagnado --> EmVendas: novo interesse (deal NOVO)
  Perdido --> EmVendas: novo interesse (deal NOVO)
  Ganho --> Cliente
  Cliente --> CS: onboarding/treinamento (funil isolado)
  Cliente --> Recompra: régua LTV
  SemIntencao --> Nutricao
  Nutricao --> Qualificado
```

## 12.5 Regra de Ouro (decisão)

```mermaid
flowchart TD
  S[Novo interesse do lead] --> CS{Deal em CS?}
  CS -- sim --> N1[NÃO tocar CS] --> NEW[Abrir deal NOVO em Vendas]
  CS -- não --> COM{Deal em Comercial?}
  COM -- sim --> N2[NÃO tocar Comercial] --> NEW
  COM -- não --> EST{Deals estagnados?}
  EST -- sim --> L[Marcar como PERDIDA] --> NEW
  EST -- não --> H{Tem histórico ou CS?}
  H -- não --> SK[Skip + log em system_health_logs]
  H -- sim --> NEW
```

## 12.6 Roteamento WhatsApp

```mermaid
flowchart LR
  MSG[Mensagem] --> T{Destino}
  T -- individual --> E[Evolution API<br/>chave da instância em team_members]
  T -- grupo --> G[EvolutionGO]
  E --> C{connectionState = open?}
  C -- não --> LOG[Não envia + log]
  C -- sim --> SEND[Envia]
  G --> SEND
```