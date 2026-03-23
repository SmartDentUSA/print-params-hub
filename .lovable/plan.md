
Objetivo: fazer o layout novo realmente chegar ao ambiente publicado em `https://print-params-hub.lovable.app` e no domínio `https://parametros.smartdent.com.br`.

O que eu confirmei agora:
- No código atual, `src/pages/PublicFormPage.tsx` já está com o layout novo:
  - `max-w-5xl`
  - `grid grid-cols-1 md:grid-cols-2`
  - coluna esquerda `md:sticky md:top-8`
- Mas o HTML servido em produção ainda está antigo. Eu li o HTML das duas URLs publicadas e ambas ainda entregam:
  - `<div class="w-full max-w-lg mt-1">`
  - mídia com `mb-6`
- Então o problema não é “CSS novo não carregou”. O problema é que o deploy publicado ainda está usando markup antigo.

Plano de correção:
1. Reconciliar a publicação do frontend
   - Publicar novamente este projeto no Lovable usando **Publish → Update**.
   - Isso é necessário porque mudanças de frontend só entram em produção após publish.

2. Confirmar o ambiente correto
   - Verificar em **Settings → Domains** se `parametros.smartdent.com.br` está ligado a este projeto atual, e não a outro deploy/projeto antigo.
   - Se o domínio estiver em outro projeto, mover/reconectar.

3. Validar a saída publicada
   - Após a publicação, conferir novamente o HTML da rota `/f/-formulario-exocad-ia`.
   - O esperado é aparecer no HTML publicado algo como:
```text
w-full max-w-5xl mt-1 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start
```

4. Eliminar falso positivo de cache
   - Testar em janela anônima / hard refresh.
   - Se ainda aparecer o layout antigo depois do publish, isso reforça que o domínio está apontando para outro projeto/deploy, não para cache.

5. QA final
   - Desktop: mídia/texto à esquerda e formulário à direita.
   - Mobile: empilhado verticalmente.
   - Verificar tanto em `print-params-hub.lovable.app` quanto em `parametros.smartdent.com.br`.

Detalhe técnico importante:
- A URL de preview autenticado não ficou acessível publicamente para inspeção direta, mas as duas URLs live/publicadas foram suficientes para provar a divergência.
- Como o HTML publicado contém `max-w-lg`, não há evidência de bug no Tailwind nem no JSX atual; a divergência está no deploy/publicação/domínio.

Se eu fosse implementar a correção em modo de execução, eu focaria em:
- republicar o frontend;
- checar o vínculo do domínio customizado;
- validar o HTML publicado depois.
