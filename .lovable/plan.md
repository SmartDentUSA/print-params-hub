## Objetivo

Adicionar um botão **"Exportar Tudo"** ao lado de "Sync Incremental" / "Full Sync" no header do Smart Ops (página `/admin`), que gera um arquivo **XLSX consolidado** com todos os dados estruturados de cada lead canônico (`merged_into IS NULL`): campos do CDP, deals, propostas/itens, timeline, eventos de estágio, page views, conversões, oportunidades, e-commerce, financeiro, academy, análise cognitiva, SDR, Astron e tags.

## UX

No header de Smart Ops em `src/pages/AdminViewSecure.tsx`, adicionar um terceiro botão à direita de "Full Sync":

```text
[ Sync Incremental ] [ Full Sync ] [ ⬇ Exportar Tudo ] [ Atualizar ]
```

- Ícone `Download` do lucide-react.
- Estado `exporting` com spinner.
- Ao clicar: chama `supabase.functions.invoke('export-leads-full')` esperando blob; dispara download do arquivo `smartdent-leads-export-YYYY-MM-DD.xlsx`.
- Toast de sucesso com contagem de leads e abas geradas; toast de erro em vermelho.

## Edge Function: `export-leads-full`

Nova função em `supabase/functions/export-leads-full/index.ts`.

**Stack**: `xlsx` (`https://esm.sh/xlsx@0.18.5`) para gerar workbook multi-sheet em memória e devolver como `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

**Auth**: valida JWT do chamador e exige `is_admin(auth.uid())`. Usa Service Role internamente.

**Filtro global**: todas as queries respeitam a Core Rule — apenas leads canônicos (`merged_into IS NULL`).

**Abas geradas (cada lead = 1 linha por aba, exceto as de detalhe que expandem):**

| Aba | Fonte | Conteúdo |
|---|---|---|
| `Leads` | `lia_attendances` | Todas as colunas escalares + flatten de `cognitive_analysis`, `astron_plans_data`, `piperun_custom_fields`, `sellflux_custom_fields` em colunas auxiliares principais. JSONBs grandes serializados como string JSON. |
| `Deals` | `piperun_deals_history` (jsonb_array_elements) | 1 linha por deal: lead_id, email, deal_id, pipeline, stage, status, value, created_at, closed_at, owner_name, origem. |
| `Proposals` | deals.proposals | 1 linha por proposta: deal_id, proposal_id, vendedor, valor totals, parcelas, frete. |
| `Proposal_Items` | proposals.items | 1 linha por item: deal_id, proposal_id, sku, nome, qtd, unit, total, categoria. |
| `Timeline` | `v_lead_timeline` | Eventos cronológicos por lead. |
| `State_Events` | `lead_state_events` | Mudanças de estágio/status. |
| `Page_Views` | `lead_page_views` | Tracking omnichannel. |
| `Conversions` | `lead_conversion_history` | Conversões/eventos. |
| `Opportunities` | `lead_opportunities` | Oportunidades cognitivas. |
| `Form_Submissions` | `lead_form_submissions` | Submissões com `form_data` JSON serializado. |
| `Cart_History` | `lead_cart_history` | Carrinhos e-commerce. |
| `Product_History` | `lead_product_history` | Pedidos/itens e-commerce. |
| `Course_Progress` | `lead_course_progress` | Academy. |
| `SDR_Interactions` | `lead_sdr_interactions` | Interações SDR. |
| `Activity_Log` | `lead_activity_log` | Log bruto. |
| `Enrichment_Audit` | `lead_enrichment_audit` | Histórico de enrichment. |
| `Cognitive_View` | `v_lead_cognitive` | Snapshot cognitivo agregado. |
| `Commercial_View` | `v_lead_commercial` | Snapshot comercial. |
| `Ecommerce_View` | `v_lead_ecommerce` | LTV ecommerce. |
| `Financeiro_View` | `v_lead_financeiro` | Financeiro consolidado. |
| `Academy_View` | `v_lead_academy` | Academy consolidado. |

**Regras de qualidade:**
- Cada aba começa com colunas `lead_id` e `email` para joins externos.
- Datas em ISO 8601.
- JSONBs aninhados que não couberam em colunas próprias serializados com `JSON.stringify`.
- Paginação por `range(0, 999)` em loop até esgotar (Supabase 1000 default).
- Limite duro: ignora apenas leads com `merged_into NOT NULL` para honrar CDP Integrity.
- Headers gerados dinamicamente a partir das chaves do primeiro registro mais a união das chaves vistas (garante completude).

**Resposta**: binário XLSX (`Uint8Array` de `XLSX.write({type:'array'})`) com `Content-Disposition: attachment; filename="smartdent-leads-export-<date>.xlsx"`.

## Frontend wiring

Em `src/pages/AdminViewSecure.tsx`:
- Importar `Download` do lucide-react.
- Adicionar estado `exporting` e handler `handleExportAll` que faz `fetch` direto à URL da função (não `invoke`, para receber binário) com `Authorization: Bearer ${session.access_token}`, lê `await res.blob()`, cria URL e dispara `<a download>`.
- Botão `disabled` durante syncs e export.

## Arquivos

- **Novo**: `supabase/functions/export-leads-full/index.ts`
- **Novo**: `supabase/config.toml` — adicionar registro da função (verify_jwt false; auth feita em código).
- **Editado**: `src/pages/AdminViewSecure.tsx` — botão + handler.

## Notas

- A função pode demorar; usar streaming não é necessário para volumes atuais (alguns milhares de leads). Se ultrapassar o limite de memória, paginar e gerar abas grandes (Deals/Page_Views) com escrita incremental via `XLSX.utils.sheet_add_aoa`.
- Os JSONBs grandes (`raw_payload`, `historico_resumos`, `interest_timeline`) ficam serializados — isso preserva *tudo* sem explodir colunas.
