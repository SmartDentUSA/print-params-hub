# Central de Campanhas — UI Evolution + refinamento da segmentação

Escopo apenas frontend em `src/components/SmartOpsCampaigns.tsx` (wizard `CreateCampaign`). Backend Evolution já está pronto — a UI lê das colunas `team_members.evolution_instance_name` / `evolution_phone` (`ativo=true`) para listar os telefones conectados.

## 1. Step 1 — Canal de envio

Adicionar **Evolution** ao select existente, ao lado de WhatsApp (WaLeads), SellFlux, Apenas registrar:

```text
Canal de envio: [ Evolution ▾ ]
Instância:      [ 🟢 Vilmar — +55 45 99902-1444 ▾ ]   ← só aparece quando canal = evolution
```

Detalhes:
- Novo `SelectItem value="evolution"` → label `WhatsApp (Evolution)`.
- Quando `sendChannel === "evolution"`:
  - Renderizar um segundo `Select` "Instância" abaixo (full-width na grid sm:col-span-2).
  - Carregar via `useEffect` consultando `team_members` (`select id, nome_completo, evolution_instance_name, evolution_phone where ativo=true and evolution_instance_name not null`).
  - Cada item mostra `{nome_completo} — +{evolution_phone}` com bullet verde (assumimos conectado pois backend está estável; sem chamada extra de status).
  - Estado novo `evolutionInstance: string` (guarda `evolution_instance_name`).
  - Validação: botão "Próximo" desabilita quando `sendChannel === "evolution" && !evolutionInstance`.

Persistência (sem migração): no `handleCreate`, quando canal = evolution, gravar:
```ts
channel: "evolution",
lead_filters: { ...filters, evolution_instance: evolutionInstance }
```

Step 3 (Revisar) ganha linha extra "Instância" exibindo o telefone escolhido quando aplicável.

## 2. Step 2 — Segmentação (próximas etapas do seletor)

Hoje só temos: Produto âncora, Temperatura, Etapa CRM. Adicionar filtros úteis e já presentes em `lia_attendances`:

| Filtro | Campo | UI |
|---|---|---|
| **Especialidade** | `especialidade` | Select com distinct |
| **Área de atuação** | `area_atuacao` | Select com distinct |
| **UF** | `uf` | Select com distinct |
| **Proprietário (vendedor)** | `proprietario_lead_crm` | Select com distinct |
| **Status real** | `real_status` | Select com distinct |
| **Tem scanner / impressora** | `tem_scanner`, `equip_printer_brand` | dois selects "Sim/Não/Todos" |
| **Última interação** | `updated_at` | Select: 7d / 30d / 90d / qualquer |
| **Já comprou?** | `total_deals_all > 0` | Toggle "Apenas clientes" / "Apenas leads" / "Todos" |

Implementação:
- Novos `useState` por filtro (default `"all"` ou `"any"`).
- Carregar `distinct` como já fazem `anchorOptions` e `stageOptions` (um `useEffect` agrupando todas as queries, parallel).
- Estender o `useEffect` de contagem com os novos filtros (`ilike`/`eq`/`gte`/`gt`).
- Persistir no `lead_filters` JSON com chaves nomeadas — sem migração.

Layout: aumentar a grid para `sm:grid-cols-2 lg:grid-cols-3` mantendo o card de "leads impactados" full-width abaixo.

## 3. Step 3 — Revisar

Renderizar dinamicamente todos os filtros aplicados como `Badge`s, e adicionar a linha "Instância" quando canal = evolution.

## Arquivos
- **Editar:** `src/components/SmartOpsCampaigns.tsx` (única alteração — só UI/estado).

## Fora do escopo
- Disparo real Evolution (já pronto no backend conforme você confirmou — só consumirá `channel=evolution` + `lead_filters.evolution_instance`).
- Migração no `campaign_sessions` — tudo cabe em `lead_filters` JSON.
- Indicador "ao vivo" de status de cada instância (não pediu; podemos adicionar depois).

## Pergunta única
Está ok armazenar a instância em `campaign_sessions.lead_filters.evolution_instance` (sem migração), ou prefere uma coluna dedicada `evolution_instance text`?
