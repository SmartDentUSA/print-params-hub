

## Plano: Enriquecer Pessoa/Empresa/Deal no PipeRun + Nota Estruturada

### Problema
1. **Pessoa (27370319)**: Criada com dados mínimos, sem custom fields (especialidade, area_atuacao)
2. **Empresa (22348229)**: Apenas nome "Thiago", sem email/telefone completos
3. **Deal**: Custom fields podem não estar persistindo corretamente no PUT
4. **Nota no Deal**: Usa `buildLeadNote` (formato simples), mas deveria usar o **mesmo template estruturado** enviado ao vendedor (`buildSellerNotification`)

### Mudanças

#### 1. `createPerson` — incluir custom fields da Pessoa
Adicionar `custom_fields` no payload de criação da pessoa usando `PESSOA_CUSTOM_FIELDS` (area_atuacao: 674001, especialidade: 674002).

#### 2. `findOrCreateCompany` — enriquecer com dados completos
Ao enriquecer empresa existente, incluir CNPJ, razão social, segmento se disponíveis no lead (`empresa_cnpj`, `empresa_razao_social`, etc.). Usar nome completo do lead.

#### 3. Novo helper: `updatePersonFields`
Após encontrar pessoa existente, fazer PUT para atualizar campos que podem estar vazios (job_title, phones, emails, custom_fields).

#### 4. Substituir `buildLeadNote` por `buildSellerNotification`
As notas inseridas no Deal (`addDealNote`) passam a usar o mesmo template estruturado do vendedor. Isso garante consistência entre a notificação no WhatsApp e a nota no PipeRun.

Mudanças específicas:
- `updateExistingDeal`: chamar `buildSellerNotification` em vez de `buildLeadNote`
- `moveDealToVendas`: idem
- `createNewDeal`: idem
- Todas recebem `supabase` como parâmetro adicional (necessário para buscar última mensagem do lead)

#### 5. Rodar fluxo para thiago.nicoletti@smartdent.com.br
Após deploy, executar e verificar:
- Pessoa 27370319: `job_title`, `custom_fields` preenchidos
- Empresa 22348229: nome completo, email, telefone
- Deal: custom fields + nota estruturada idêntica ao WhatsApp

### Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/smart-ops-lia-assign/index.ts` | `updatePersonFields` novo, `buildLeadNote` → `buildSellerNotification` nas notas do deal, `supabase` passado para `updateExistingDeal`/`moveDealToVendas`/`createNewDeal` |

