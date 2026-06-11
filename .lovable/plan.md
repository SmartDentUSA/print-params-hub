## Diagnóstico

O site `https://parametros.smartdent.com.br/` **não pertence a este projeto Lovable**. Este projeto (`print-params-hub`) tem como custom domain apenas `https://admin.smartdent.com.br`. Confirmações:

- `curl` em `parametros.smartdent.com.br/` retorna **HTTP 200** com HTML válido e o bundle JS (`/assets/index-DUy48xVb.js`) também responde 200. Do ponto de vista de rede, o site está no ar.
- Se aparece tela branca no navegador, é **erro de runtime do JavaScript** depois do HTML carregar — quase certamente causado pela alteração feita no botão Admin do Header naquele outro projeto, não neste.
- O revert que você fez aqui (no projeto `admin`) **não afeta** o projeto `parametros`, porque cada projeto Lovable tem seu próprio histórico, deploy e código.

## Causa provável da quebra no projeto `parametros`

A mudança "botão Admin do header → redireciona para `https://admin.smartdent.com.br/admin`" pode ter sido aplicada de forma que quebra o render do Header:

1. Substituição de `<Link to="/admin">` por algo que usa hook de roteamento fora de contexto, ou import inexistente.
2. `window.location.href` colocado no corpo do componente (executa no render → loop / crash).
3. Remoção da rota `/admin` interna que ainda era referenciada por outro componente.
4. Edição quebrada no `Header.tsx` (JSX inválido) que passou no build mas crasha em runtime via Error Boundary.

## Plano de recuperação (executar no projeto `parametros`, não aqui)

**Passo 1 — Reverter no projeto correto**
- Abra o projeto Lovable do `parametros.smartdent.com.br` (é um projeto distinto deste).
- Na aba **History** do chat daquele projeto, localize o ponto **imediatamente anterior** à alteração do botão Admin do Header e clique em **Revert**.
- Isso restaura o `Header.tsx` (e qualquer outro arquivo tocado) ao estado funcional.

**Passo 2 — Republicar**
- Após o revert, clique em **Publish** naquele projeto para gerar um novo deploy na Vercel.
- Em ~1 min, `parametros.smartdent.com.br` volta com o bundle anterior funcionando.

**Passo 3 — Reaplicar a mudança do botão de forma segura**
Forma correta para o botão "Admin" do Header redirecionar ao painel externo, sem quebrar nada:

```tsx
// Header.tsx
<a
  href="https://admin.smartdent.com.br/admin"
  target="_blank"
  rel="noopener noreferrer"
>
  <Button variant="outline" size="sm" className="flex items-center gap-2">
    <Settings className="w-4 h-4" />
    <span className="hidden md:inline">{t('common.admin')}</span>
  </Button>
</a>
```

Pontos-chave para evitar a quebra anterior:
- Trocar **apenas** o `<Link to="/admin">` por uma `<a href="…">` externa. Nada de `window.location` no corpo do componente.
- Manter o resto do `Header.tsx` intacto, incluindo `import { Link } from 'react-router-dom'` se ainda for usado em outros pontos.
- Não remover nem alterar nenhuma rota do `App.tsx` daquele projeto.

## Se preferir confirmar primeiro

Se quiser, eu posso, neste projeto aqui, deixar como referência um snippet pronto do Header corrigido para você colar no outro projeto. Mas a correção em si precisa ser feita lá — não tenho acesso ao código do projeto `parametros` a partir daqui.

## O que NÃO fazer

- Não editar arquivos deste projeto (`admin`) tentando consertar o `parametros`: são deploys separados.
- Não mexer em `vercel.json` aqui por causa daquele site.
- Não trocar DNS — o domínio responde normalmente; o problema é no bundle JS do outro projeto.