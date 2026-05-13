## Regra: Forçar novo Deal no Funil de Vendas para reentradas comerciais

### Observação importante
O snippet enviado fala em `smart-ops-lia-assign/index.ts`, mas todas as variáveis usadas (`existingLead`, `formName`, `produtoInteresse`, `source`, log com prefixo `[ingest-lead]`) só existem em **`smart-ops-ingest-lead/index.ts`**. Vou implementar lá — é o ponto correto do fluxo, antes do `lia-assign` ser invocado, e garante que o `piperun_id` seja zerado a tempo do próximo passo criar um deal novo.

### Arquivo
`supabase/functions/smart-ops-ingest-lead/index.ts`

### Mudanças

1. **Adicionar constante** no topo do arquivo (junto às outras constantes do módulo):
   ```ts
   const NEW_DEAL_SOURCES = new Set(["meta_lead_ads", "meta_lead_ad", "formulario", "form", "vendedor_direto"]);
   ```
   (Inclui aliases já usados no projeto — `meta_lead_ad`, `form` — para não furar a regra por divergência de string.)

2. **Inserir o bloco `shouldForceNewDeal`** dentro do branch `if (existingLead)` (linha ~411), **antes** do `mergeSmartLead` (linha 412). Precisa rodar antes do merge porque o merge persiste o estado, e antes do bloco da `deal-form-note` (linha 496) que depende de `existingLead.piperun_id`.

   ```ts
   // Regra: novo deal SEMPRE que vier de fonte comercial e lead não está no Funil de Vendas
   const isInFunilDeVendas = (existingLead?.piperun_pipeline_name || '')
     .toLowerCase()
     .includes('funil de vendas');

   const shouldForceNewDeal =
     NEW_DEAL_SOURCES.has(source) &&
     formName &&
     existingLead?.piperun_id &&
     !isInFunilDeVendas;

   let forcedNewDeal = false;
   if (shouldForceNewDeal) {
     await supabase.from('lia_attendances').update({
       piperun_id: null,
       piperun_link: null,
       proprietario_lead_crm: null,
       form_name: formName,
       produto_interesse: produtoInteresse || existingLead.produto_interesse,
       source,
     }).eq('id', existingLead.id);

     // Reflete localmente para que o resto do fluxo (merge + deal-form-note) enxergue o estado já zerado
     existingLead.piperun_id = null;
     existingLead.piperun_link = null;
     existingLead.proprietario_lead_crm = null;

     forcedNewDeal = true;
     console.log(`[ingest-lead] NOVO DEAL: ${existingLead.nome} estava em "${existingLead.piperun_pipeline_name}" → criando deal no Funil de Vendas`);
   }
   ```

3. **Adicionar `forced_new_deal: forcedNewDeal`** no payload final de resposta JSON (próximo a `is_existing`) para auditoria/observabilidade. Default `false` quando o branch não roda.

### Por que essa ordem
- Zerar `piperun_id` antes do `mergeSmartLead` faz com que o merge não preserve o ID antigo.
- Zerar antes do bloco de `deal-form-note` (linha 496, condicional em `existingLead.piperun_id`) impede que uma nota seja anexada ao deal antigo de outro funil.
- O `lia-assign` chamado depois (via `triggerNextStep` / fluxo normal) verá `piperun_id = null` e criará um novo Deal no Funil de Vendas via `piperun-hierarchy.createNewDeal`.

### Não vou mexer
- `smart-ops-lia-assign/index.ts` — a lógica de criar Deal já existe lá quando `piperun_id` está vazio.
- `_shared/commercial-intent.ts` — a guard atual já valida `form_name`/source comercial.
- Nenhuma migração de banco — `piperun_pipeline_name` já existe em `lia_attendances`.

### Validação
- `rg -n "shouldForceNewDeal|NEW_DEAL_SOURCES|forcedNewDeal" supabase/functions/smart-ops-ingest-lead/index.ts` → 4+ ocorrências.
- Build TS passa.
- Smoke test mental: lead em "Funil Estagnados" recebendo novo formulário Meta → `piperun_id` zerado → `lia-assign` cria deal novo no Funil de Vendas, mantendo Person/Company.

Pode aprovar que aplico.