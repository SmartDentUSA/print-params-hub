
## Escopo

Aplicar as duas mudanças pedidas, sem tocar em nada mais.

**Não mexer**: `LeadDetailPanel.tsx`, schema de `lead_activity_log`, contratos PipeRun/SellFlux, `claim_next_meta_pull_form`, thresholds BUC (`BUC_WARN`/`BUC_BACKOFF`), paginação, backoff, cursor round-robin, gap detector, `TIMEOUT_MS`/`MAX_PAGES`.

---

## Mudança 1 — Similaridade fuzzy em `_shared/zernio-field-normalizer.ts`

Objetivo: parar de retornar `null`/`needs_manual_review` para variantes triviais (typos, plural, "consultorio" vs "CLÍNICA OU CONSULTÓRIO") e evitar que slug cru vaze pra frente.

Alterações no arquivo (append de helpers + uso nas 4 funções de normalização):

1. Adicionar helpers privados no topo do módulo:
   - `levenshtein(a, b): number` — DP clássico, O(n·m), strings já em lowercase slug.
   - `SIMILARITY_THRESHOLD = 0.82` (ratio = 1 - dist/maxLen).
   - `fuzzyMatchCanonical(slug, lookup: Map<string,string>): string | null` — itera as chaves do lookup, calcula ratio, devolve o canônico do melhor match se ratio ≥ threshold; empate resolve pelo primeiro.

2. `normalizeAreaAtuacao`: após `AREA_ATUACAO_LOOKUP.get(slug)` falhar, tentar `fuzzyMatchCanonical(slug, AREA_ATUACAO_LOOKUP)`. Só retorna `null` se fuzzy também falhar.

3. `normalizeEspecialidade`: idem contra `ESPECIALIDADE_LOOKUP`.

4. `normalizeScanner`: após `SCANNER_MODEL_LOOKUP.get(slug)` falhar e antes do brand-keyword loop, tentar fuzzy contra `SCANNER_MODEL_LOOKUP`. Se acertar, retornar `{status:"modelo_exato", label}`. Brand fallback continua igual.

5. `normalizeImpressora`: após `IMPRESSORA_BRAND_LOOKUP.get(slug)` falhar, tentar fuzzy contra `IMPRESSORA_BRAND_LOOKUP` → `{status:"marca_exata", label}`. Loop de `includes(brandSlug)` fica como último recurso.

Não alterar: assinaturas exportadas, `FORM_ID_TO_PRODUCT`, `normalizeZernioLead`, `mapFormToProduct`, flag `needsManualReview` (continua ligada só quando fuzzy também falha).

---

## Mudança 2 — `meta-lead-ads-pull` usa o normalizador padrão

Hoje esse poller monta `payload` com slug cru (`area_de_atuacao: "clínica_ou_consultório"`), rota alternativa de ingestão que não passa pela normalização Zernio. Precisa espelhar o webhook.

Alterações em `supabase/functions/meta-lead-ads-pull/index.ts`:

1. Import (topo do arquivo):
   ```ts
   import {
     normalizeZernioLead,
     mapFormToProduct,
   } from "../_shared/zernio-field-normalizer.ts";
   ```

2. Dentro do loop `for (const lead of leads)`, depois de montar `fieldMap`/`formData` e antes de montar `payload`:
   - Construir `rawFields` no formato que `normalizeZernioLead` espera (nomes originais do Meta, não normalizados) a partir de `fieldData`:
     ```ts
     const rawFields: Record<string,string> = {};
     for (const f of fieldData) rawFields[String(f.name || "")] = (f.values || [])[0] || "";
     const normalized = normalizeZernioLead(rawFields);
     const productMapping = mapFormToProduct(String(lead.form_id || formId));
     ```

3. Substituir a cascata atual de `directProduct/inferredProduct/campaignProduct` por:
   ```ts
   const produtoInteresse =
     productMapping?.productName
     || directProduct
     || inferredProduct
     || campaignProduct
     || null;
   ```
   (mantém a cascata antiga como fallback quando `productMapping` for `null`, ou seja, form não catalogado.)

4. Enriquecer `payload` com os campos canônicos (sobrescrevendo o slug cru que veio do spread `...formData`):
   ```ts
   area_atuacao: normalized.areaAtuacao,
   especialidade: normalized.especialidade,
   como_digitaliza: normalized.scanner?.label ?? null,
   scanner_marca: normalized.scanner?.label ?? null,
   tem_scanner: normalized.scanner?.status === "nao_digitaliza" ? "não"
                : (normalized.scanner?.label ? "sim" : null),
   tem_impressora: normalized.impressora?.status === "nao_tem" ? "não"
                   : (normalized.impressora?.label ? "sim" : null),
   impressora_modelo: normalized.impressora?.label ?? null,
   produto_interesse: produtoInteresse,
   produto_interesse_auto: productMapping?.productName ?? inferredProduct ?? campaignProduct ?? null,
   needs_manual_review: normalized.needsManualReview,
   ```
   Se `productMapping` existir, também sobrescrever `form_name` e `origem_campanha` com `productMapping.originSystemB` — igual ao caminho Zernio — mantendo `originLabel` como fallback quando `productMapping` for `null`.

5. Log adicional (não substituir os existentes): dentro do bloco `meta_pull_fields_flattened` já existente, adicionar campos `area_normalized`, `especialidade_normalized`, `scanner_status`, `impressora_status`, `product_mapping_hit: !!productMapping`, `needs_manual_review: normalized.needsManualReview`. Nada é removido.

Nada mais no arquivo é tocado: BUC, backoff, cursor RPC, gap detector, `TIMEOUT_MS`, `MAX_PAGES`, paginação `body.paging.next`, tratamento de 429, rate-limit runtime — tudo intacto.

---

## Verificação (após redeploy automático)

Aguardar o próximo tick do cron (≤1min) ou disparar `meta-lead-ads-pull` manualmente uma vez e rodar:

```sql
SELECT area_atuacao, especialidade, source, platform_form_id, created_at
FROM lia_attendances
WHERE source = 'meta_lead_ads' AND platform_form_id IS NOT NULL
ORDER BY created_at DESC LIMIT 5;
```

Critério de sucesso: `area_atuacao` e `especialidade` só aparecem como valores canônicos das listas (ou `NULL` com `needs_manual_review=true`) — nunca mais `clínica_ou_consultório`, `cirurgiã_dentista` etc.

---

## Arquivos tocados

- `supabase/functions/_shared/zernio-field-normalizer.ts` — adiciona `levenshtein`, `fuzzyMatchCanonical`, ativa fuzzy nas 4 normalizações.
- `supabase/functions/meta-lead-ads-pull/index.ts` — import do normalizador, enriquecimento do `payload`, prioridade de `FORM_ID_TO_PRODUCT` na resolução de produto, log adicional.

Nenhum outro arquivo, nenhuma migração, nenhum secret novo.
