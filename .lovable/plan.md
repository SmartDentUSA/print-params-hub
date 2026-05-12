## Diagnóstico — Pessoas Piperun sem e-mail/telefone

### O que está acontecendo

Os leads do dia 11–12/05 (Heitor Rabeti, Viviane Costa, Gustavo Egami, Vitor Maldonado, etc.) **chegam com e-mail + telefone corretos no nosso CDP** (`lia_attendances`), mas a Pessoa correspondente no Piperun aparece **sem e-mail e sem telefone**.

### Causa raiz

Existem dois caminhos pelos quais a Pessoa Piperun é tocada por nós em `smart-ops-lia-assign`:

1. **`createPerson`** (Pessoa nova, criada por nós) → envia `emails: [{email}]` e `phones: [{phone}]`. **OK.**
2. **`updatePersonFields`** (Pessoa já existia no Piperun — encontrada por `findPersonByEmail`) → **só envia `name`, `phones`, `job_title` e, em algumas chamadas, `origin_id`. NUNCA envia `emails`.**

O caso problemático é o caminho 2:
- Source `piperun_webhook` (Heitor Rabeti, Viviane Costa) e leads que o Meta Lead Ads nativo do Piperun cria do lado de lá criam a Pessoa com e-mail/telefone gravados em campos customizados / payload bruto, **não nos campos canônicos `emails[]`/`phones[]`** do Piperun.
- Quando nosso `lia-assign` roda em seguida, `findPersonByEmail` casa a Pessoa pelo e-mail (que está no payload, mas talvez não no array `emails`) ou por outro mecanismo, e cai no `updatePersonFields`. Esse PUT **nunca empurra de volta o e-mail nem o telefone canônicos que temos no CDP**, então a Pessoa no Piperun fica eternamente sem esses campos visíveis no card.
- Em `piperun-hierarchy.ts → updatePersonFields`: o `if (phone) updatePayload.phones = [...]` existe, mas falta `emails`. Resultado: e-mail nunca é re-publicado.

Confirmação adicional: o log `system_health_logs` mostra `error_type=person_name_is_company` repetido para Heitor Rabeti (lead `f65fd9a6…`), comprovando que o `lia-assign` rodou várias vezes nesses leads sem corrigir os campos de contato.

### O que vou alterar

Edição cirúrgica em **`supabase/functions/_shared/piperun-hierarchy.ts → updatePersonFields`** (e equivalente em `smart-ops-lia-assign/index.ts` se houver cópia local) para enriquecer a Pessoa existente com **e-mail e telefone canônicos do CDP**, sempre que tivermos esses dados:

```ts
if (email) updatePayload.emails = [{ email }];
if (phone) updatePayload.phones = [{ phone }];
```

Regras:
- Só envia `emails` se `lead.email` for válido (passa por `isFakeEmail`).
- Só envia `phones` se `telefone_normalized` ou `telefone_raw` válido (passa por `isFakePhone`).
- Mantém o nome existente; **não** sobrescreve `origin_id` (origem da Pessoa é congelada — memória já existente).
- Loga em `system_health_logs` quando enriquece (`error_type='piperun_person_contact_backfilled'`).

### Backfill pontual

Após o fix, rodar uma vez `smart-ops-lia-assign` (ou um pequeno script `piperun-person-contact-backfill`) para os ~15 leads dos últimos 2 dias com `piperun_id IS NOT NULL` e `pessoa_piperun_id IS NOT NULL`, forçando o PUT de `emails`/`phones`. Isso corrige os cards já criados (Heitor, Viviane, Gustavo, Vitor, Tatiana, Aluísio, Sinval, Lucas Ricco, Júnior Ibiapina, Ruani, Luciana Biazan etc.).

### O que NÃO vou mexer

- `createPerson` (já está correto).
- Lógica de matching/dedup, Smart Merge, Commercial Intent Guard, custom fields da Pessoa (continuam desativados — Piperun retorna 422).
- Origem da Pessoa (congelada no first-touch).

### Memória a atualizar

Adendo em `mem://integration/piperun-sync-spec-v6` (ou nova memória `piperun-person-contact-enrichment`): "updatePersonFields DEVE re-empurrar `emails` e `phones` canônicos do CDP em todo PUT — Piperun não preenche esses arrays automaticamente quando a Pessoa é criada via integração Meta nativa."
