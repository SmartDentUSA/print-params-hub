# Fix UX — Novo broadcast (passo 1/4 e 2/4)

## Problema

O wizard é IG-only (hard-coded `channel='instagram'`), mas a UX não deixa isso claro e ainda exige seleção manual da conta Zernio mesmo quando só existe uma. Resultado: usuário chega ao passo 2/4, vê "Nenhum contato elegível" e não entende por quê.

## Mudanças (apenas UI, sem mexer em regra de negócio)

Arquivo único: `src/components/social/broadcasts/SocialBroadcasts.tsx`.

### 1. Auto-select da conta IG única
No `useEffect` disparado quando `zernioAccounts` carrega: se houver exatamente uma conta IG ativa e `zernioAccountId` ainda vazio, setar automaticamente. Elimina o passo manual mais comum.

### 2. Header do passo 1 com escopo explícito
Adicionar banner no topo do passo 0 (e subtítulo no header do Dialog):

> "Disparo via Instagram Direct (Zernio). Contatos de WhatsApp, Facebook ou TikTok não são elegíveis neste canal."

### 3. Contadores ao vivo no passo 1
Ao lado de cada toggle, mostrar quantos contatos restam com o filtro ativo, lendo de uma segunda query leve (`select count head:true` filtrada). Ex.:
- "Somente inscritos (opt-in) — 24 elegíveis"
- "Apenas seguidores — 0 elegíveis" (em vermelho se zerar a lista)

### 4. Empty state acionável no passo 2/4
Hoje mostra só "Nenhum contato elegível com esses filtros." Trocar por bloco com:
- Diagnóstico do motivo provável (conta não selecionada / filtro de followers zera tudo / nenhum IG contact em `social_contacts`).
- Botão "Voltar e ajustar filtros" + botão "Sincronizar Zernio agora" (invoca `zernio-contacts-sync` e reexecuta a query).
- Link para `/social/contatos` para inspecionar.

### 5. Label do dropdown deixa claro o canal
Mudar `<Label>Conta Zernio (Instagram)</Label>` para `<Label>Conta Instagram (Zernio) — único canal suportado</Label>` e desabilitar o select com tooltip "Conta única detectada — auto-selecionada" quando só houver uma.

### 6. Badge de contagem no passo 2/4
Atualizar `{selectedIds.size} selecionados / {contacts?.length ?? 0} elegíveis` para incluir total bruto IG no banco: `… de {totalIgInDb} contatos IG`, dando referência clara da diferença entre universo e elegíveis pós-filtros.

## Fora do escopo

- Não vou tornar o broadcast multi-canal (WhatsApp/FB/TikTok) — confirmado pelo usuário.
- Sem mudanças no dispatcher (`zernio-broadcast-dispatch`), no schema ou em RLS.
- Sem alteração de defaults de toggles (`subscribed=true` continua ligado).
