# Central de Campanhas — destravar Step 1 → Segmentação

## Diagnóstico

No print, o botão **Próximo** está desabilitado mesmo com `Nome`, `Canal`, `Instância` e `Descrição` preenchidos. A causa é a validação no Step 1 (`SmartOpsCampaigns.tsx:569-573`):

```ts
disabled={ !selectedContent || !campaignName.trim() || (sendChannel==="evolution" && !evolutionInstance) }
```

O usuário digitou "DEDE" no campo de busca, mas **não clicou em nenhum resultado** (a busca não retornou itens correspondentes ao termo "DEDE"), então `selectedContent` continua `null` e a validação trava.

Hoje o Step 1 obriga escolher um item já existente da biblioteca de conteúdos, o que não faz sentido quando:
- a campanha é totalmente nova (texto vai ser composto depois);
- a busca não retorna nada;
- o usuário só quer disparar uma mensagem ad-hoc via Evolution.

## Mudanças (apenas UI em `src/components/SmartOpsCampaigns.tsx`)

### 1. Tornar `selectedContent` opcional
- Remover `!selectedContent` da condição `disabled` do botão Próximo.
- Renomear o card para **"1. Conteúdo (opcional)"** e adicionar texto auxiliar: *"Escolha um item da biblioteca ou avance para compor a mensagem na próxima etapa."*

### 2. Feedback quando a busca não retorna nada
Abaixo do input de busca, quando `searchTerm.length >= 2 && searchResults.length === 0 && !loadingSearch`, mostrar:
> *"Nenhum conteúdo encontrado para 'DEDE'. Você pode avançar sem selecionar."*

### 3. Botão "Pular seleção de conteúdo"
Quando `!selectedContent`, exibir um botão secundário discreto **"Continuar sem conteúdo"** ao lado do "Próximo", apenas para deixar claro que é permitido. (Tecnicamente redundante depois do item 1, mas remove a fricção visual reportada.)

### 4. Persistência
`handleCreate` já lida com `content_id` opcional via spread. Garantir que, quando `selectedContent` for `null`, gravamos `content_id: null` em `campaign_sessions` — confirmar no bloco existente sem alterar a estrutura do payload.

### 5. Step 3 (Revisar)
Quando não houver conteúdo selecionado, mostrar uma linha *"Conteúdo: a definir"* em vez de quebrar o card de preview.

## Fora de escopo
- Editor inline de mensagem nova (ficaria para próxima iteração).
- Mudanças em Step 2 (segmentação) ou backend.

## Pergunta única
Confirma que quero mesmo permitir campanhas sem item da biblioteca selecionado? (alternativa seria forçar o usuário a sempre criar/selecionar um conteúdo antes — porém o fluxo atual já trava nessa hipótese exata).
