## Problema

O link do grupo do WhatsApp está configurado corretamente em `success_redirect_url` do formulário. O problema é que a landing page (`/lp/:slug`) abre o formulário dentro de um **iframe em um modal** (`PublicLandingPage.tsx`, linha 107). Quando o usuário envia o formulário, `SubmittedScreen` executa:

```ts
window.location.href = redirectUrl; // src/pages/PublicFormPage.tsx:67
```

Isso navega **o iframe** para `https://chat.whatsapp.com/…`. O WhatsApp retorna `X-Frame-Options: DENY`, então o iframe fica em branco/com o ícone de imagem quebrada — exatamente a tela do screenshot.

## Correção (mínima, só frontend)

Detectar contexto de iframe/embed em `src/pages/PublicFormPage.tsx` e, na tela de sucesso, **estourar para a janela topo** em vez de navegar o próprio iframe.

### `SubmittedScreen` (linhas 60–110)

1. Calcular `inIframe = typeof window !== "undefined" && window.self !== window.top` — também aceitar `?embed=1` como sinal explícito.
2. Auto-redirect:
   - Se `inIframe`: `window.top!.location.href = redirectUrl` (mesma origem, funciona). Fallback silencioso para `window.open(redirectUrl, "_top")` em caso de erro.
   - Caso contrário: manter `window.location.href = redirectUrl`.
3. Botão de fallback ("Entrar no grupo de WhatsApp"):
   - Adicionar `target="_top"` quando `inIframe` e for link WhatsApp (browsers respeitam para escapar do iframe).
   - Manter `target="_blank"` para não-WhatsApp já existente.

Nenhum outro arquivo precisa mudar. Nada de backend/edge/DB. O comportamento fora de iframe continua idêntico.

## Verificação

- Abrir a landing `/lp/<slug>`, preencher e submeter → a aba/janela toda deve navegar para o convite do grupo (não mais quebrar dentro do modal).
- Abrir o formulário direto em `/f/<slug>` (sem iframe) → comportamento atual preservado.
