# Diagrama — Sistema Auto‑Generativo (estado atual)

> Auditoria do ciclo "detectar erro → avaliar → corrigir → memorizar".
> ✅ = elo automático e ativo · 🟡 = existe mas depende de humano · 🔴 = elo ausente/dormente

## 1. Visão de loops

```mermaid
flowchart TD
    subgraph RUNTIME["⚙️ RUNTIME (produção)"]
        USER([Usuário / Lead]) -->|pergunta| LIA[dra-lia]
        LIA -->|resposta + context_raw| AI[(agent_interactions)]
        LIA -.->|não sabe responder| GAP[(agent_knowledge_gaps<br/>+frequência)]
        INGEST[smart-ops-ingest-lead] --> LEADS[(lia_attendances)]
    end

    subgraph JUDGE["🧪 LOOP 1 — Qualidade (Juiz)"]
        AI ==>|trigger DB AUTO ✅| EVAL[evaluate-interaction<br/>Gemini + DeepSeek]
        EVAL ==>|score 0-5 / veredito| AI
        EVAL -. 🔴 sem ação automática .-> DASH[AdminDraLIAStats<br/>dashboard]
    end

    subgraph HEAL["📚 LOOP 2 — Cura de conhecimento"]
        GAP -->|🟡 admin clica generate| HK[heal-knowledge-gaps<br/>cluster embeddings + FAQ dual]
        HK -->|rascunho| DRAFT[(knowledge_gap_drafts)]
        DRAFT -->|🟡 aprovação humana| RAG[(agent_embeddings / RAG)]
        RAG -->|conhecimento novo| LIA
    end

    subgraph WATCH["🛡️ LOOP 3 — Watchdog cognitivo"]
        WD[system-watchdog-deepseek<br/>detecta anomalias + DeepSeek]
        LEADS --> WD
        HEALTH[(system_health_logs)] --> WD
        WD ==>|auto-remedia ✅| INGEST
        WD -->|registra| HEALTH
        CRON{{cron}} -. 🔴 NÃO agendado no repo .-> WD
    end

    subgraph SAFETY["🔁 LOOP 4 — Redes de segurança (ATIVAS)"]
        C1{{cron 1min}} ==>|✅| SN[enrichment-safety-net-cron]
        C2{{cron 15min}} ==>|✅| RT[piperun-retry-failed-leads]
        C3{{cron 5min}} ==>|✅| BR[copilot-brain refresh]
        SN --> LEADS
        RT --> LEADS
    end

    MEM[/"mem/ — 32 .md<br/>memória institucional"/]
    MEM -. 🔴 não lida em runtime .-> LIA
```

## 2. Onde o ciclo quebra

```
   DETECTAR  ──►  AVALIAR  ──►  CORRIGIR  ──►  MEMORIZAR  ──►  (volta)
   ✅ forte      ✅ forte      🟡 humano      🟡 só RAG       🔴 não relê
   (judge,       (dual-model   (heal/watchdog  (mem/ é doc,    o passado
    health_logs)  consenso)     gated)          não runtime)   sozinho
```

Os 3 elos vermelhos a fechar:
1. 🔴 Watchdog sem `cron.schedule` versionado → auto‑detecção dormente.
2. 🔴 Veredito do Juiz não gera ação (só dashboard).
3. 🔴 `mem/` não é consumida em runtime (memória passiva).
