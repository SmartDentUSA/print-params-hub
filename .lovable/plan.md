
Objetivo: alinhar o layout split já existente no código com o que está sendo servido em produção no `print-params-hub.lovable.app` e no domínio `parametros.smartdent.com.br`.

O que eu confirmei:
- O código atual já está correto em `src/pages/PublicFormPage.tsx`: a página usa `max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12`.
- A rota pública também está correta em `src/App.tsx`: `/f/:slug` renderiza `PublicFormPage`.
- Tanto o domínio publicado quanto o domínio customizado ainda estão servindo a versão antiga.

Plano de execução:
1. Validar qual deploy está ativo
   - Comparar a versão servida no preview autenticado, no `print-params-hub.lovable.app` e no `parametros.smartdent.com.br`.
   - Confirmar se o problema é “frontend não publicado” ou “domínio apontando para outro deploy”.

2. Reconciliar publicação do frontend
   - Publicar novamente o frontend deste projeto no Lovable.
   - Confirmar que o `print-params-hub.lovable.app/f/-formulario-exocad-ia` passa a refletir o layout split.

3. Reconciliar o domínio customizado
   - Verificar se `parametros.smartdent.com.br` está conectado a este mesmo projeto e não a um deploy antigo/paralelo.
   - Se estiver apontando fora do Lovable ou para outro projeto, corrigir o vínculo/DNS.

4. Verificar cache e propagação
   - Após alinhar a publicação, validar se ainda há cache de CDN/navegador mascarando a mudança.
   - Testar a rota com hard refresh e em janela anônima.

5. QA final
   - Confirmar o layout lado a lado em desktop.
   - Confirmar que no mobile ele continua empilhado.
   - Verificar fim a fim a URL `/f/-formulario-exocad-ia` nos dois domínios.

Detalhes técnicos:
- Não há indício de bug no JSX atual; o problema está no ambiente publicado.
- Como ambos os endereços ainda mostram a versão antiga, as causas mais prováveis são:
  1. publish do frontend não aplicado;
  2. domínio customizado ligado a outro deploy/projeto;
  3. cache persistente após publicação.
- Não prevejo mudanças de lógica nem de banco; o foco é publicação e vínculo de ambiente.
