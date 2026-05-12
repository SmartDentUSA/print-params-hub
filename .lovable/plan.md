## Foco agora

O problema atual não é Astron: é o fluxo `Meta Lead Ads -> smart-ops-ingest-lead -> smart-ops-lia-assign -> PipeRun` criando o Deal com nota correta, mas deixando campos customizados vazios no PipeRun.

Exemplo: Flávio Rodrigues tinha no payload/formulário:

- telefone: `+5581996391671`
- produto_interesse: `RayShape Edge Mini`
- area_atuacao: `Clínica ou Consultório`
- tem_scanner: `não`
- tem_impressora: `sim`
- impressora_modelo: `elegoo`

Mas no PipeRun esses campos ficaram como “Adicionar valor” ou “sem scanner/não definido”.

## Causa provável

O `smart-ops-lia-assign` já monta `customFields`, mas o `createNewDeal` envia os campos customizados no POST como chaves hash soltas no payload do Deal. Pelo comportamento visto no PipeRun, o Deal nasce e a nota entra, mas os custom fields do POST não são persistidos de forma confiável.

O próprio código já trata PUT como mais confiável: `customFieldsToHashMap()` + `piperunPut(deals/{id}, hashFields)`. Então o fluxo do formulário do sistema deve ser replicado assim: criar Deal primeiro, depois fazer PUT de enriquecimento com todos os campos.

## Plano de correção

### 1. Corrigir criação de Deal no `smart-ops-lia-assign`

No `createNewDeal`:

1. Criar o Deal com payload mínimo e seguro:
   - title
   - pipeline_id
   - stage_id
   - owner_id
   - origin_id
   - reference
   - person_id
   - company_id
   - deleted: 0
2. Após receber `dealId`, executar imediatamente um `PUT /deals/{dealId}` com:
   - origin_id
   - company_id
   - todos os campos customizados via hash (`customFieldsToHashMap(customFields)`)
3. Só depois adicionar a nota estruturada.
4. Logar erro se o PUT dos campos falhar, porque antes o sistema só logava o POST do Deal.

Resultado: o Deal continua sendo criado, mas os campos aparecem preenchidos como no formulário do sistema.

### 2. Garantir que os campos do Meta sejam mapeados corretamente

No `_shared/piperun-field-map.ts`, reforçar `mapAttendanceToDealCustomFields` para:

- Resolver `telefone_raw` além de `telefone_normalized`.
- Resolver `produto_interesse` tanto do top-level quanto do `form_data.raw_fields`.
- Resolver `area_atuacao`.
- Resolver `tem_scanner`.
- Resolver `tem_impressora`.
- Se `tem_impressora=sim` e existir `impressora_modelo=elegoo`, enviar o valor final como `sim - elegoo` ou equivalente aceito pelo campo PipeRun.
- Normalizar respostas Meta (`clínica_ou_consultório`, `ainda_não_digitalizo`) para texto humano antes de enviar.

### 3. Corrigir o fluxo de ingestão Meta

No `smart-ops-ingest-lead`:

- Garantir que `tem_impressora` capture também o payload direto `tem_impressora` antes de buscas textuais genéricas.
- Garantir que `produto_interesse` use `payload.produto_interesse` antes de detectar produto pelo nome do formulário, para não transformar “RayShape Edge Mini” em “Impressora 3D”.
- Preservar todos os raw fields no `form_data`, como já faz.

### 4. Reprocessar o Deal do Flávio

Depois do patch:

- Buscar `lia_attendances` por `flaviobraga81@hotmail.com`.
- Reexecutar `smart-ops-lia-assign` com `lead_id` e `force=true` para aplicar o PUT de campos no Deal existente `59699720`, sem recriar Deal.
- Validar via logs que o PUT enviou os hashes de:
  - WhatsApp
  - Produto de interesse
  - Área de atuação
  - Tem scanner
  - Tem impressora
  - Produto interesse auto, quando existir

### 5. Separar Astron do comercial

Manter a regra já definida:

- Astron nunca cria Deal no Funil de Vendas.
- Astron, quando criar oportunidade, deve ir somente para `Interesse em cursos`.
- Cliente ganho ou pessoa com deal aberto não deve receber novo Deal comercial por causa de Astron.

Mas essa parte fica isolada para não quebrar novamente o fluxo Meta/Formulário.

## Arquivos a alterar

- `supabase/functions/smart-ops-lia-assign/index.ts`
- `supabase/functions/_shared/piperun-field-map.ts`
- `supabase/functions/smart-ops-ingest-lead/index.ts`

## Validação

- Conferir no banco o lead `flaviobraga81@hotmail.com`.
- Conferir logs do `smart-ops-lia-assign` após reprocessamento.
- Confirmar que o Deal existente foi atualizado, não duplicado.
- Confirmar que os campos que estavam vazios no PipeRun foram enviados via PUT.