## Problema

Na seção "Réguas compartilhadas" do painel WhatsApp → Campanhas, cada card mostra Visualizar / Editar fluxo / Editar grupos / Renomear — mas **não tem botão de excluir**. Hoje só dá pra apagar régua de grupo único.

## Verificação de FKs (já feita)

`wa_campaigns` tem 3 dependências:
- `wa_message_queue.campaign_id` → `CASCADE` ✅
- `wa_campaign_groups.campaign_id` → `CASCADE` ✅
- `wa_groups.active_campaign_id` → `SET NULL` ✅

Ou seja, um simples `DELETE FROM wa_campaigns WHERE id=?` limpa fila pendente, vínculos de grupos e zera o `active_campaign_id` dos grupos automaticamente. Sem migration nem RPC nova.

## Plano

Arquivo único: `src/components/smartops/wa-groups/SmartOpsWaGroupCampaigns.tsx`

1. **Import**: adicionar `Trash2` ao import de `lucide-react`.
2. **Handler novo** `handleDeleteShared(c)`:
   - `confirm(\`Excluir a régua "${c.name}"? Os ${c.group_ids.length} grupos voltam para "sem régua" e mensagens pendentes serão canceladas.\`)`
   - `await supabase.from('wa_campaigns').delete().eq('id', c.id)`
   - `toast.success("Régua excluída")` / `toast.error(...)` no catch
   - `await fetchShared(); await fetchRows();`
3. **UI**: dentro do loop `sharedCampaigns.map(c => ...)` (linhas 449-498), adicionar após o botão "Editar grupos" (linha 488) um botão destrutivo:
   ```tsx
   <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10"
     onClick={() => handleDeleteShared(c)} title="Excluir régua">
     <Trash2 className="w-3 h-3" />
   </Button>
   ```

## Risco / fora de escopo

- Não toco em régua de grupo único (já tem fluxo próprio).
- Não toco no `sharedOpen` default, tamanho dos cards, nem no toggle ativo/desativado — esses ficam para outra rodada se você quiser.
- Sem mudança de schema, sem edge function.
