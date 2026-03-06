

# Diagnostico: Links PipeRun Quebrados + Telefones Ausentes

## 1. Links PipeRun Quebrados

**Causa raiz**: 22.654 dos 24.757 links usam o formato antigo (`/pipeline/gerenciador/visualizar/{id}`) que o PipeRun descontinuou. Apenas 2.103 links usam o formato correto (`/#/deals/{id}`).

O codigo em `mapDealToAttendance` ja gera o formato correto (linha 365), mas os links antigos nunca foram atualizados no banco.

**Fix**: Um SQL UPDATE para converter todos os links antigos:

```sql
UPDATE lia_attendances 
SET piperun_link = 'https://app.pipe.run/#/deals/' || piperun_id
WHERE piperun_link LIKE '%/pipeline/gerenciador/visualizar/%'
  AND piperun_id IS NOT NULL;
```

Impacto: 22.654 links corrigidos instantaneamente.

## 2. Telefones Ausentes

**Dados reais**: No funil de Vendas, apenas 63% tem telefone normalizado. Em `sem_contato`, apenas 21%.

**Causa raiz**: A API do PipeRun no endpoint `GET /deals?with[]=person` retorna dados basicos da pessoa mas nao inclui o array `phones` consistentemente. O telefone so chega quando:
- O `with[]=person` traz `person.phones` (inconsistente)
- O custom field WhatsApp (549150) esta preenchido (fallback)

**Fix**: Duas mudancas no `piperun-field-map.ts`:

1. Adicionar `"person.phones"` e `"person.emails"` ao array `with[]` nas chamadas de sync (PipeRun suporta nested includes)
2. Priorizar o custom field WhatsApp junto com `person.phones` (nao apenas como fallback)

**Arquivo alterado**: 
- `supabase/functions/_shared/piperun-field-map.ts` (phone extraction)
- `supabase/functions/smart-ops-sync-piperun/index.ts` (with[] params)
- `supabase/functions/piperun-full-sync/index.ts` (with[] params)
- SQL data update para links

Depois de deployar, rodar `smart-ops-sync-piperun?orchestrate=true&full=true` para re-sincronizar telefones.

