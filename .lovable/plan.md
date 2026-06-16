## 1. Ajuste no card de Distribuidor (`KbTabDistribuidores.tsx`)

- Aumentar `CountryFlag` de 20px para **40x40 px** (border-radius proporcional, mesmo aspect).
- Mover a linha bandeira + ícones sociais para ficar **flush à esquerda** do bloco de nome (sem padding/margem extra), alinhados ao início do título — exatamente como no print de referência.
- Manter logo 96px, nome 700, layout horizontal.

## 2. Banco de dados — nova tabela `smartops_events`

Migration cria tabela pública com:

- `name` (texto, obrigatório)
- `country` (texto)
- `start_date`, `end_date` (date)
- `location` (texto — cidade/venue)
- `company_stand` (texto)
- `website_url` (texto)
- `cover_image_url` (texto — URL da capa)
- `is_active` (boolean, default true)
- `display_order` (int, default 0)

**GRANTs:** `SELECT` para `anon` + `authenticated` (público), `ALL` para `service_role`. RLS:
- Leitura pública (qualquer um vê `is_active = true`)
- Insert/Update/Delete restrito a `authenticated` com role `admin` (via `has_role`)

Bucket de storage `event-covers` (público) para upload das capas.

## 3. Editor no SmartOps — `SmartOpsEvents.tsx`

Novo componente admin (estilo dos outros editores SmartOps: `SmartOpsTeam`, `SmartOpsGoals`):

- Tabela listando eventos com colunas: capa miniatura, nome, país, datas, localização, stand, site, ações (editar / desativar / excluir).
- Botão "Novo evento" abre `Dialog` com formulário:
  - Nome do evento (input)
  - País (select com lista de países, mesma fonte usada em distribuidores)
  - Data início / Data fim (Calendar shadcn com `pointer-events-auto`)
  - Localização (input livre)
  - Stand da empresa (input)
  - Site do evento (input URL)
  - Upload de capa (`ImageUpload` reaproveitado, bucket `event-covers`)
- Salvar via `supabase.from('smartops_events').insert/update`.

Registrar a nova entrada no `AdminSidebar` (categoria SmartOps) e rota correspondente no `AdminViewSecure` / arquivo que lista as tabs SmartOps.

## 4. Aba pública "Eventos" na Base de Conhecimento — `KbTabEventos.tsx`

Espelho de `KbTabDistribuidores`:

- `KbSectionHeader` com **título "Eventos"** e **subtítulo "Mantenha-se atualizado sobre nossas atividades"**.
- Campo de busca idêntico (filtra por nome, país, localização).
- Fetch `smartops_events` onde `is_active=true`, ordenado por `start_date` ascendente (próximos primeiro).
- Card com:
  - Capa do evento (imagem topo, 16:9, fallback placeholder)
  - Nome (700)
  - Datas formatadas (ex: "12–14 mar 2026")
  - Localização + bandeira do país (40px, mesma `CountryFlag` reutilizada)
- Skeletons e estado vazio mantendo o mesmo visual.

Registrar a tab no componente pai da Base de Conhecimento (onde `?tab=distribuidores` é roteado) adicionando `?tab=eventos`.

## 5. Validação

- Abrir `/base-conhecimento?tab=distribuidores` — confirmar bandeira 40px e ícones flush à esquerda.
- Abrir editor SmartOps → criar evento de teste com capa → verificar persistência.
- Abrir `/base-conhecimento?tab=eventos` — confirmar listagem, busca e layout dos cards.

## Arquivos afetados

- `src/components/knowledge/KbTabDistribuidores.tsx` (ajuste bandeira/alinhamento)
- `src/components/knowledge/KbTabEventos.tsx` (novo)
- pai da Base de Conhecimento (adicionar tab "Eventos")
- `src/components/SmartOpsEvents.tsx` (novo)
- `AdminSidebar.tsx` e roteamento SmartOps (adicionar entrada)
- Migration SQL (`smartops_events` + bucket `event-covers`)

Nenhuma alteração em lógica de negócio existente, CDP, CRM ou pipelines.