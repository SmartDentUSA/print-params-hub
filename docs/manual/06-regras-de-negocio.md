# 06 — Regras de Negócio

Regras extraídas de código (`_shared/*`, triggers, funções SQL) e de decisões registradas em `mem/`.

## 6.1 Regra de Ouro — isolamento de funis

Fonte: `_shared/golden-rule-guard.ts`, `smart-ops-lia-assign/index.ts`.

```text
Novo interesse comercial de um lead:
  ├── Existe deal em FUNIL CS?        → NÃO TOCAR. Abrir deal NOVO em Vendas.
  ├── Existe deal em FUNIL COMERCIAL? → NÃO TOCAR (nunca editar/mover).
  ├── Existe deal ESTAGNADO/PERDIDO?  → marcar como PERDIDA + abrir deal NOVO em Vendas.
  └── Lead sem histórico:
        if (!temHistoricoEstagnados && !temCS) → não abrir (evita ruído)
```

- É proibido mover ou alterar deals dos funis CS e Comercial por qualquer automação.
- Lista vazia de estagnados **não** aborta a criação do novo deal (correção autorizada explicitamente).
- Todo *skip* é logado em `system_health_logs` com try/catch.
- `smart-ops-kanban-move` foi **desligado**: mudança de etapa em Vendas é ato humano no PipeRun (`mem/architecture/kanban-move-desligado.md`).
- Janela anti-duplicidade: `golden-rule-guard` evita novo deal se houver deal recente (30 dias) para o mesmo lead + intenção.

## 6.2 Intenção comercial

`_shared/commercial-intent.ts` define o que autoriza abrir oportunidade: preenchimento de formulário com produto, clique de campanha com produto, pedido de orçamento, evento de e-commerce, mensagem com sinal explícito. Curiosidade de conteúdo (leitura de artigo, download de e-book) **não** é intenção comercial.

## 6.3 Identidade e deduplicação (bug conhecido em correção)

Fonte de verdade: `lia_attendances` com `merged_into`.

Estado atual medido:

| Métrica | Valor |
|---|---|
| Merges totais | 1.025 |
| Self-merges (linha aponta para si) | 158 |
| Cadeias de merge (A→B→C) | 16 |
| Merges com CNPJ divergente (**errados**) | 122 |
| Merges cruzando B2B×B2C (alto risco) | 184 |
| Maior mega-bucket ("Junior") | 87 origens |
| Deals em leads fundidos | 537 |
| NFes casadas por CNPJ | 304 |
| Matrículas de treinamento afetadas | 5 |

Causas raiz identificadas:
1. Trigger `auto_dedup_by_phone` funde por telefone e por *primeiro token* de nome.
2. Colisão de e-mails sintéticos/placeholder (`import_...@`) usados por funções de sync.

Regra correta (proposta e aprovada na Fase A, em implementação):

```text
Merge automático SOMENTE com documento válido idêntico:
  B2B: mesmo CNPJ (14 dígitos válidos)
  B2C: mesmo CPF (11 dígitos válidos)
Nunca fundir B2B com B2C.
Telefone/nome/e-mail placeholder → fila de revisão manual, jamais merge automático.
Vínculos de treinamento e NF preservados na migração.
```

## 6.4 Taxonomia canônica

`_shared/dental-taxonomy.ts` + `smart-ops-field-normalize` (32 campos canônicos).

- **Área de atuação** e **Especialidade** têm listas canônicas fechadas; valores livres são mapeados por similaridade.
- **Proibido** contaminar `area_atuacao` com cargo ou objeto social do QSA (bug corrigido).
- **Produto de interesse**: marca específica sempre vence o genérico. Ex.: se o texto contém uma marca de impressora conhecida, não classificar como "Outras".
- `meta_form_mappings` (21 linhas) é a **fonte única** de `form_id → produto → célula 7×3`; nada de mapa hardcoded (substituído por `meta-form-resolver.ts`).

## 6.5 Workflow 7×3

Sete estágios do fluxo digital odontológico × três dimensões (tem / não tem / interesse), materializados nos campos `hits_*`, `equip_*`, `sdr_*_interesse` e em `workflow_cell_mappings`. Serve para: briefing do vendedor, priorização de leads, escolha de campanha e recomendação de próximo produto (`next_upsell_*`).

Estágios: Scanner → CAD → Impressão 3D → Pós-impressão (cura/lavagem) → Finalização → Fresagem → Insumos & Cursos.

## 6.6 Receita, LTV e metas

- **Receita do mês** = `Max(ganho no CRM, faturamento Omie)` por deal/cliente, para não duplicar nem subestimar.
- **LTV** = soma de NF Omie + pedidos de e-commerce atribuídos ao lead canônico. LTV de leads fundidos erroneamente está contaminado (item de correção na Fase C).
- **Metas**: globais e por vendedor em tabelas de diretrizes; painel de TV compara realizado × meta.
- **Funil ativo** = apenas pipeline "Funil de Vendas" com deals abertos (autoridade = PipeRun; espelho local reconciliado por hora).

## 6.7 Distribuição de leads

- Somente membros de `team_members` **ativos** e com ID numérico válido de PipeRun entram no sorteio (`smart-ops-lia-assign`).
- `proprietario_lead_crm` inválido é limpo para evitar erro `owner_id` no PipeRun.
- Round-robin com correção de distribuição por vendedor.

## 6.8 Comunicação

| Regra | Detalhe |
|---|---|
| Roteamento WhatsApp | individual → Evolution API; grupo → EvolutionGO; **nunca** fallback cruzado |
| Guarda de conexão | não enviar se `connectionState != "open"`; logar em `system_health_logs` |
| Remetente institucional | `smartdent_marketing` (Waleads descontinuado) — `mem/integration/institutional-sender-instance.md` |
| E-mail | janela 07:30–19:00, ~499/dia, fila com claim atômico; sempre reutilizar short link existente |
| Links | nunca gerar nova URL para formulário/LP já publicado |
| Preços | agente público não dá preço: redireciona para WhatsApp humano |
| Conteúdo IA | nunca inclui preço |

## 6.9 NPS pós-treinamento

```text
Treinamento concluído → +24 h (cron 08:00) → WhatsApp com link /nps/:token
  token com validade (30 dias no teste) em tabela de tokens
  resposta (estrelas) → cs-nps-responder
      ├── grava cs_nps_responses
      ├── espelha como NOTA no PipeRun
      └── atualiza badge de NPS na ficha do lead
  token expirado/reutilizado → 410
```

## 6.10 Catálogo, SKU e propostas

- SKU oficial vem de `system_a_catalog`/`catalog_product_variations`; `produto_aliases` resolve nomes livres do CRM.
- Variações são exibidas com peso/tamanho no rótulo (evita opções homônimas).
- Checkbox **Dist.** controla, por variação, a presença no catálogo de distribuição.
- Itens de proposta sem SKU aparecem em "Fora de Catálogo" para vínculo ou criação de nome canônico.
- Kits: `catalog_kit_components` explode o kit em componentes para cálculo e proposta.

## 6.11 Datas

Toda informação sincronizada usa a **data real do acontecimento** no sistema de origem (`created_at`, `closed_at`, data da atividade, data da NF) — nunca a data de importação. Isso vale para timeline, relatórios e metas.

## 6.12 Concorrência

| Recurso | Mecanismo |
|---|---|
| Nota do vendedor | `try_claim_seller_note_slot` + `smartops_deal_note_locks` |
| Fila de WhatsApp | `claim_pending_wa_messages` (claim atômico) |
| E-mail | `claim_email_sequence_dispatch` |
| Lead cognitivo | `cognitive_lead_locks` |
| Boas-vindas / briefing | `boas_vindas_locks`, `briefing_locks` |
| CRM | `crm_lock_until` na própria linha do lead |
| Webhook Zernio | claim atômico em `zernio_leadgen_dedup` antes do 200 |