## Diagnóstico do caso Michelle Ohana

| Campo | Valor atual no Supabase | Esperado |
|---|---|---|
| `piperun_id` | 35313685 | ✓ |
| `origem_primeiro_contato` | `"piperun"` (lixo do backfill) | `"Involve - [Ebook - Vitality]"` (1ª conversão real, 05/abr/2024) |
| `form_name` / `origem_campanha` | `null` | `"[LEADS] - RayShape Edge Mini - [Smart Dent]"` (nova conversão Meta) |
| Eventos Meta em `lead_activity_log` | nenhum | 1 entrada `meta_ads_lead_entry` |

**Causa raiz:**
1. O backfill inicial gravou o **canal de origem** (`piperun`/`sellflux`) no campo `origem_primeiro_contato`, em vez do **nome real da campanha de primeira conversão** (que vive como `origin.name` da Pessoa no Piperun). Hoje 22.495 leads canônicos estão nessa situação.
2. A nova conversão Meta da Michelle ainda não chegou ao webhook (`smart-ops-meta-lead-webhook`) — o payload tab-separado que você colou parece vir de uma automação externa (Sellflux/Involve), não do webhook nativo do Meta. Logs da Michelle em `lead_activity_log` não mostram nenhum evento Meta.

A lógica de origem **já está correta no código** (implementada na rodada anterior):
- `createPerson` envia `origin_id` = primeira conversão (frozen) ✓
- `updatePersonFields` **nunca** envia `origin_id` → Piperun preserva a origem original ✓
- `createNewDeal` / `updateExistingDeal` / `moveDealToVendas` usam `form_name` da conversão atual → Deal recebe origem da campanha correta ✓

Falta apenas (a) corrigir os dados históricos e (b) garantir que a nova conversão Meta dispara o pipeline.

---

## Plano

### 1. Backfill `origem_primeiro_contato` a partir do Piperun

Edge function nova `smart-ops-backfill-person-origin`:
- Busca leads canônicos onde `piperun_id IS NOT NULL` e `origem_primeiro_contato IN ('piperun','sellflux','sync','crm','manual_capture', null)`.
- Para cada um, faz `GET /persons/{piperun_id}` e lê `data.origin.name`.
- Atualiza `lia_attendances.origem_primeiro_contato = origin.name`.
- Processa em lotes de 100, com paginação por `updated_at`, idempotente.
- Pode ser disparada manualmente pela aba Smart Ops > Sync.

Trigger `protect_origem_primeiro_contato` continua bloqueando overwrite após preenchimento real (pular bloqueio quando valor anterior estiver na lista de "lixo conhecido"). Migração ajustando o trigger:

```sql
-- Permitir backfill apenas quando o valor antigo é "lixo de canal"
CREATE OR REPLACE FUNCTION protect_origem_primeiro_contato()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.origem_primeiro_contato IS NOT NULL
     AND OLD.origem_primeiro_contato NOT IN ('piperun','sellflux','sync','crm','manual_capture')
  THEN
    NEW.origem_primeiro_contato := OLD.origem_primeiro_contato;
  END IF;
  RETURN NEW;
END;
$$;
```

### 2. Reprocessar a nova conversão Meta da Michelle

Verificar onde o payload tab-separado chega:
- Se vier do Sellflux com tag `meta_lead_ads`, garantir que `smart-ops-sellflux-webhook` mapeia `campaign_name` → `form_name` antes de chamar `smart-ops-lia-assign`.
- Se Meta dispara direto, conferir se `META_VERIFY_TOKEN`/page subscription estão ativos para a página do anúncio.

Disparar manualmente o reprocesso desse lead (rerun `smart-ops-lia-assign` com `form_name="[LEADS] - RayShape Edge Mini - [Smart Dent]"`) → criará novo Deal com origem correta sem alterar a origem da Pessoa.

### 3. Validação

- Após backfill: `SELECT origem_primeiro_contato, COUNT(*) FROM lia_attendances WHERE merged_into IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 30` — deve mostrar nomes de campanhas, não canais.
- Para Michelle: `origem_primeiro_contato="Involve - [Ebook - Vitality]"` e novo Deal "[LEADS] - RayShape Edge Mini - [Smart Dent]" com `origin.name` correto no Piperun.
- Origem da Pessoa no Piperun **não muda** (continua "Involve - [Ebook - Vitality]").

---

## Fora de escopo (não tocar)

- Lógica de `createPerson`/`updatePersonFields`/`createNewDeal` — já está correta.
- Trigger de proteção continua ativo, apenas refinado para permitir o backfill.
