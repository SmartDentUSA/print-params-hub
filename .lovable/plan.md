## Plano

1. **Corrigir a sincronização pesada da `wa-sync-groups`**
   - O erro aparece como `shutdown` logo após iniciar a instância **Danilo Henrique**, que tem muitos grupos.
   - A função hoje busca grupos com participantes e faz upsert em lote grande; isso pode estourar o limite da Edge Function.

2. **Reduzir risco de timeout**
   - Adicionar limite/timeout controlado na chamada ao Evolution API.
   - Processar o upsert de `wa_groups` em lotes menores, em vez de tentar gravar centenas de grupos de uma vez.
   - Tornar a atualização dos grupos ausentes mais segura, evitando query gigante com todos os JIDs.

3. **Melhorar retorno para a UI**
   - Quando uma instância falhar, retornar no `per_instance` uma mensagem clara com o erro da instância, sem derrubar toda a sincronização.
   - Manter a sincronização das demais instâncias funcionando.

4. **Validar no Supabase**
   - Testar a Edge Function `wa-sync-groups` chamando a instância `Danilo Henrique` diretamente.
   - Conferir logs após o teste para garantir que deixou de morrer em `shutdown` sem resposta útil.

## Arquivos previstos

- `supabase/functions/wa-sync-groups/index.ts`
- Possivelmente `supabase/functions/_shared/evolution.ts` se for necessário colocar timeout/abort na chamada ao Evolution.