
# Base de Conhecimento: Campo de busca aciona a Dra. L.I.A.

## Comportamento desejado

Quando o usuário digitar no campo "Buscar conteúdo..." da Base de Conhecimento e pressionar **Enter** (ou clicar em um botão de busca), a Dra. L.I.A. deve:
1. Abrir automaticamente (se estiver fechada)
2. Receber a pergunta digitada
3. Responder imediatamente

A busca normal por artigos continua funcionando normalmente enquanto o usuário digita (sem Enter).

---

## Arquitetura da solução: CustomEvent no browser

O `DraLIA` está em `App.tsx` e o campo de busca está em `KnowledgeBase.tsx` — não têm relação pai/filho direta. A forma mais simples e limpa de comunicação entre eles é via **`CustomEvent`** do browser:

```
KnowledgeBase                App.tsx
[campo de busca]             [DraLIA]
      |                          |
      | dispara CustomEvent      |
      | "dra-lia:ask"            |
      |------------------------->|
                                 | ouve o evento
                                 | abre o chat
                                 | envia a pergunta
```

Não é necessário criar context global, Redux, Zustand ou nenhuma dependência nova.

---

## Mudanças nos arquivos

### 1. `src/components/DraLIA.tsx` — Ouvir o evento e responder

Adicionar um `useEffect` que registra um listener para o evento customizado `dra-lia:ask`:

```typescript
useEffect(() => {
  const handler = (e: CustomEvent<{ query: string }>) => {
    const query = e.detail?.query?.trim();
    if (!query) return;
    setIsOpen(true);
    // Simular digitação e envio:
    setInput(query);
    // Precisamos chamar sendMessage com esse texto — usamos uma ref auxiliar
  };
  window.addEventListener('dra-lia:ask', handler as EventListener);
  return () => window.removeEventListener('dra-lia:ask', handler as EventListener);
}, []);
```

Como `sendMessage` usa `input` via closure e `setInput` é assíncrono, a solução correta é usar uma **`pendingQuery` ref** para disparar o envio logo após o estado ser atualizado:

```typescript
const pendingQueryRef = useRef<string | null>(null);

// No useEffect do evento:
pendingQueryRef.current = query;
setIsOpen(true);
setInput(query);

// Novo useEffect que observa mudança em input + pendingQueryRef:
useEffect(() => {
  if (pendingQueryRef.current && input === pendingQueryRef.current) {
    pendingQueryRef.current = null;
    sendMessage();
  }
}, [input, sendMessage]);
```

Isso garante que `sendMessage` só é chamado depois que `setInput(query)` terminou de renderizar, evitando o problema de closure stale.

### 2. `src/pages/KnowledgeBase.tsx` — Disparar o evento ao pressionar Enter

No campo de busca, adicionar `onKeyDown` que — quando o usuário pressionar **Enter** — dispara o `CustomEvent` e limpa o campo (a busca normal de artigos continua funcionando ao digitar):

```typescript
const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' && searchTerm.trim().length >= 2) {
    window.dispatchEvent(
      new CustomEvent('dra-lia:ask', { detail: { query: searchTerm } })
    );
    setSearchTerm(''); // Limpa o campo após enviar para a Dra. L.I.A.
  }
};
```

Também adicionar um placeholder atualizado indicando a nova funcionalidade, e um ícone de "pressione Enter para perguntar à Dra. L.I.A." abaixo do campo, tipo hint:

```tsx
{searchTerm.trim().length >= 2 && (
  <div className="text-xs text-muted-foreground mt-2 text-center">
    Pressione <kbd>Enter</kbd> para perguntar à Dra. L.I.A. 🦷
  </div>
)}
```

---

## Fluxo completo

```text
1. Usuário digita "resina para dentística"
   → Campo atualiza (busca de artigos normal funciona)
   → Hint aparece: "Pressione Enter para perguntar à Dra. L.I.A."

2. Usuário pressiona Enter
   → KnowledgeBase dispara: window.dispatchEvent(new CustomEvent('dra-lia:ask', { detail: { query: "resina para dentística" } }))
   → Campo de busca é limpo

3. DraLIA recebe o evento
   → setIsOpen(true) — abre o widget
   → setInput("resina para dentística")
   → sendMessage() é chamado automaticamente

4. Resposta aparece no chat da Dra. L.I.A. com media cards e botões 👍/👎
```

---

## Arquivos modificados

| Arquivo | Mudanças |
|---|---|
| `src/components/DraLIA.tsx` | Adicionar `pendingQueryRef`, `useEffect` para ouvir o `CustomEvent 'dra-lia:ask'`, e `useEffect` para disparar `sendMessage` quando o input for preenchido pelo evento |
| `src/pages/KnowledgeBase.tsx` | Adicionar `onKeyDown` no Input de busca que dispara o `CustomEvent` ao pressionar Enter + hint visual "Pressione Enter para perguntar à Dra. L.I.A." |

---

## Seção Técnica

- `CustomEvent` é nativo do browser, sem dependências adicionais — sem instalação de pacotes.
- O widget já está renderizado em `App.tsx` com `DraLIAGlobal` em todas as rotas exceto `/admin` e `/embed`, então ele sempre existe no DOM quando o usuário está na Base de Conhecimento.
- O `embedded` mode (usado em `/embed/dra-lia`) não escuta o evento porque o `DraLIA` em modo `embedded` não tem o botão flutuante — mas isso não é problema pois a página `/embed/dra-lia` nunca tem a KnowledgeBase aberta ao mesmo tempo.
- O hint só aparece quando `searchTerm.length >= 2` para não mostrar no estado vazio.
- A busca de artigos na sidebar continua funcionando normalmente (filtra enquanto digita). Enter apenas encaminha a pergunta para a Dra. L.I.A.
