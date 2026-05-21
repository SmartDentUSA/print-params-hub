
## Sim, é exatamente isso que está acontecendo — fluxo confirmado

### Fluxo real implementado no `smart-ops-lia-assign`

```text
1. findPersonExpanded (resolver em camadas)
   ├─ strict por email          → match
   ├─ strict por phone          → match
   ├─ fallback por localpart    → match
   └─ fallback por nome+contato → match
   
2a. ACHOU pessoa?
    → reusa pessoa_piperun_id
    → updatePersonFields (atualiza phones, job_title, custom_fields)
    → findOrCreateCompany (vincula empresa)
    → findPersonDeals (lista TODOS os deals da pessoa)
       ├─ Deal aberto em VENDAS  → GOLDEN RULE: preserva owner/stage, só anota
       ├─ Deal em ESTAGNADOS     → reativa para Vendas
       └─ Nenhum aberto          → cria NOVO Deal vinculado à mesma pessoa
                                   (preserva histórico de deals ganhos/perdidos)

2b. NÃO ACHOU?
    → createPerson  (hard-gate: exige email OU phone, senão bloqueia)
       payload: nome, emails[], phones[], job_title=especialidade, origin_id
       custom_fields da Pessoa:
         • 772727 SCANNER_FORM   (tem_scanner + scanner_modelo)
         • 772728 IMPRESSORA_FORM (tem_impressora + impressora_modelo)
         • 673900 AREA_ATUACAO   (enum match)
         • 445631 ESPECIALIDADE  (enum match)
    → findOrCreateCompany
    → createNewDeal
       custom_fields do Deal:
         • Especialidade, Produto Interesse, Área de Atuação,
           Tem Scanner, Tem Impressora, País, Produto Auto, Origem
```

Observação importante: hoje **NÃO** existe "buscar Organização antes de criar Pessoa" — o resolver é por **Pessoa** (email/phone/nome). Empresa é resolvida **depois** que a Pessoa existe, via `findOrCreateCompany`. Isso é proposital: a regra Core do CDP é "NEVER merge distinct people from the same company".

### Validação dos 57 leads do CSV (`leads_13.csv`, 21/05/2026)

Cruzei o CSV com o CDP. Amostra dos resultados:

| Email                          | Deal piperun_id | Person pessoa_piperun_id | Owner               | Reuso de Person? |
|--------------------------------|-----------------|--------------------------|---------------------|------------------|
| gmjpteixeira63@gmail.com       | 60023435        | **47146309**             | Lucas Silva         | Person nova      |
| manoalvesortodontia@gmail.com  | 60022670        | **23719570** (antiga)    | Lucas Silva         | ✅ reusou         |
| georgeprotese1234@gmail.com    | 60008540        | **28384591** (antiga)    | Adriano Oliveira    | ✅ reusou         |
| doutormfa@gmail.com            | 60002879        | **22816244** (antiga)    | Gabriella Ferreira  | ✅ reusou         |
| francacodontologia@gmail.com   | 60003516        | **46508660** (antiga)    | Lucas Silva         | ✅ reusou         |
| junior_santiago@hotmail.com    | 59995234        | **43195555** (antiga)    | Gabriella Ferreira  | ✅ reusou         |
| nakayamasergio8@gmail.com      | 59994977        | **23989441** (antiga)    | Lucas Silva         | ✅ reusou         |
| marcel.louzada@hotmail.com     | 60009633        | **34311241** (antiga)    | Lucas Silva         | ✅ reusou         |

→ Conclusão: o sistema **reusa Pessoas antigas** (IDs baixos de 22M/23M/28M/34M/43M/46M) e **vincula um novo Deal** a elas, preservando todo o histórico. Apenas leads genuinamente novos recebem Person com ID novo (47M).

### Pontos para você revisar

1. **`georgeprotese1234@gmail.com`** veio com `nome = georgeprotese1234@gmail.com` (não veio o nome no formulário). Person antiga 28384591 foi reusada, então o nome real está preservado no card. OK.
2. **`thaleszam8@gmail.com`** recebeu `proprietario_lead_crm = "102594"` (ID numérico, não nome) → owner novo no PipeRun ainda não está em `PIPERUN_USERS` no `piperun-field-map.ts`. Não bloqueia, mas aparece como número no CDP.
3. Custom fields da **Pessoa** (Scanner/Impressora/Área/Especialidade) só foram ativados recentemente (memo `piperun-person-custom-fields-activation`). Leads de hoje já estão recebendo. Históricos antigos não têm — pode rodar backfill via `updatePersonFields` se quiser preencher.

### Resumo

✅ Fluxo "achou Pessoa → vincula novo Deal" está funcionando.  
✅ Quando não acha, cria Pessoa com todos os campos pedidos (email, celular, área, especialidade, scanner, impressora, origem).  
✅ Todos os 57 leads do CSV foram processados (com `piperun_id` e `pessoa_piperun_id` populados, nenhum `crm_creation_blocked`).  
⚠️ Owner ID `102594` (Thales Zamprogno) precisa ser cadastrado em `PIPERUN_USERS`.

Sem alterações de código necessárias — a regra que você descreveu já está implementada e operando. Posso abrir um patch só para mapear o owner 102594 se quiser.
