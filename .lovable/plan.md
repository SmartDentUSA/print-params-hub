
# Adicionar campos ManyChat e WaLeads por membro da equipe

## Contexto das APIs

**ManyChat**: Usa autenticacao via Bearer Token na API. Cada vendedor tera sua propria API Key para enviar mensagens/flows individuais.
- Header: `Authorization: Bearer {API_KEY}`
- Endpoint principal: `https://api.manychat.com/fb/sending/sendFlow`

**WaLeads (ChatCenter)**: Usa autenticacao via API Key passada como query parameter `?key=API_KEY`.
- Base URL: `https://waleads.roote.com.br`
- Endpoints: enviar texto (`POST /public/message/text`), imagem, audio, gerenciar cards, funis, etc.

Cada membro da equipe tera suas proprias chaves configuradas individualmente.

---

## Alteracoes

### 1. Migration SQL -- novas colunas na tabela `team_members`

```sql
ALTER TABLE team_members ADD COLUMN manychat_api_key TEXT;
ALTER TABLE team_members ADD COLUMN waleads_api_key TEXT;
```

Ambas nullable -- nem todo membro precisara ter as duas integracoes.

### 2. Arquivo: `src/components/SmartOpsTeam.tsx`

**Interface `TeamMember`**: adicionar os dois novos campos.

**Estado `form`**: incluir `manychat_api_key` e `waleads_api_key` (string vazia por padrao).

**Dialog de edicao/criacao**: expandir com duas secoes visuais separadas por `Separator`:

```
--- Dados do Membro ---
[Nome Completo]
[Email]
[WhatsApp]
[ID Vendedor Piperun]
[Funcao]

--- Configuracoes ManyChat ---
[API Key ManyChat] (input type=password, placeholder="Bearer token do ManyChat")

--- Configuracoes WaLeads ---
[API Key WaLeads] (input type=password, placeholder="API Key do ChatCenter/WaLeads")
```

**Tabela principal**: adicionar coluna "Integracoes" entre "Funcao" e "Ativo", mostrando badges indicativas:
- Badge verde "MC" se `manychat_api_key` preenchida
- Badge azul "WL" se `waleads_api_key` preenchida
- Traco "---" se nenhuma configurada

**Funcoes `openAdd` e `openEdit`**: incluir inicializacao dos novos campos.

### 3. Edge function `smart-ops-cs-processor` (referencia futura)

Nenhuma alteracao agora, mas o processador de automacoes CS ja podera buscar a `manychat_api_key` individual de cada membro ao enviar mensagens, em vez de usar a chave global. Isso sera feito em etapa futura.

---

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar -- colunas `manychat_api_key` e `waleads_api_key` em `team_members` |
| `src/components/SmartOpsTeam.tsx` | Editar -- interface, form, dialog com secoes MC/WL, coluna integracoes na tabela |
