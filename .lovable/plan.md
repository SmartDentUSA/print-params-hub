## Objetivo

Evitar erros como o de `smartdent_marketing` (credenciais Evolution vazias caindo na apikey global) expondo **todos** os campos por instância no dialog "Adicionar/Editar Membro" e adicionando uma seção separada para **Evolution GO**.

## Estado atual

`SmartOpsTeam.tsx` só edita `evolution_instance_name`. Os demais campos que o `wa-dispatcher` / `_shared/evolution.ts` já leem por linha (`evolution_api_key`, `evolution_phone`, `evolution_lid`, `evolution_base_url`) só são preenchíveis via SQL. EvoGo (`evo_go_instance_id`, `evo_go_instance_token`, `evo_go_base_url`) idem.

## Mudanças (só UI + persistência do form)

**Arquivo único: `src/components/SmartOpsTeam.tsx`**

1. Ampliar `interface TeamMember` e `EMPTY_FORM` com:
   - `evolution_api_key`, `evolution_phone`, `evolution_lid`, `evolution_base_url`
   - `evo_go_instance_id`, `evo_go_instance_token`, `evo_go_base_url`

2. `fetchMembers` (select) e `openEdit` (hidratação do form) passam a incluir esses campos. `handleSave` (`upsert`) grava-os. Strings vazias viram `null` para não sujar as rows.

3. Bloco "Configurações Evolution" no dialog ganha, abaixo do "Nome da Instância":
   - `Input password` "API Key da Instância" (`evolution_api_key`)
   - `Input` "Telefone Conectado" (`evolution_phone`, digits-only)
   - `Input` "LID do Bot" (`evolution_lid`, placeholder `98908885786860@lid`)
   - `Input` "Base URL" (`evolution_base_url`, placeholder `http://82.25.75.61:8080`)
   - Nota curta: "Sem esses campos, o disparo cai na apikey global e a Evolution rejeita com 400."

4. Novo bloco **"Configurações Evolution GO"** (`Separator` + título) com:
   - `Input` "Instance ID" (`evo_go_instance_id`)
   - `Input password` "Instance Token" (`evo_go_instance_token`)
   - `Input` "Base URL" (`evo_go_base_url`)

5. `Select "Provedor de mensagens"` ganha item `evolution_go` → "Evolution GO". Badge da tabela: adicionar `EG` roxo-claro quando `messaging_provider === 'evolution_go'`.

6. Botão "Conectar WhatsApp" continua ligado só ao Evolution clássico (não mexer no fluxo QR do EvoGo).

## Fora de escopo

- Nenhuma mudança em `wa-dispatcher`, `_shared/evolution.ts`, migrations, RPCs, roteador de leads ou fluxo de campanhas.
- Não sincronizo automaticamente LID via `fetchInstances` (fica manual pelo admin; podemos automatizar depois se quiser).
- Não altero políticas RLS: a tabela `team_members` já é acessível ao admin com as policies atuais.

## Validação

- Abrir dialog em um membro Evolution existente (Danilo-Henrique) → campos aparecem preenchidos com os valores atuais.
- Editar `smartdent_marketing` (Smart Dent | 16 anos) → preencher apikey `EDCEEC67FA93-...`, phone `5516997501531`, base_url `http://82.25.75.61:8080`, salvar, reabrir → valores persistiram.
- Rodar `wa-dispatcher` pelo item pending: agora usa a apikey correta e o 400 "Timed Out" some.
