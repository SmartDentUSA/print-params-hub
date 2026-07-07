## Diagnóstico

**1. Fonte ilegível no input.** A screenshot da landing `https://parametros.smartdent.com.br/f/exocad_dentalcad_rms` mostra o campo "Nome completo" com fundo branco e texto/quase branco. Em `src/pages/PublicFormPage.tsx` (linhas ~621-637), o painel padrão `[data-pp-default="true"]` força `background: #E8ECF4` e `border` nos inputs, mas **não define a cor do texto digitado**. Como a página usa tema escuro (`.public-form-page` herda cor clara de `--form-body`), o texto fica invisível sobre o bg claro.

**2. "Erro ao abrir o WhatsApp" após envio.** O `success_redirect_url` do form é `https://chat.whatsapp.com/KWqNzep7sdZJsfPiHW1awq`. O usuário confirmou que, ao acessar o link diretamente, ele funciona (carrega a tela do WhatsApp Web). O `PublicFormPage` faz `window.location.href = redirectUrl` (linhas 483-486). O erro provavelmente ocorre quando:
- O redirect dispara em um momento em que o navegador ainda está processando eventos, e alguns bloqueadores/popup-blockers interceptam.
- No mobile, a navegação automática para `chat.whatsapp.com` às vezes não dispara o app nativo.
- A mensagem "Erro ao abrir o WhatsApp" pode ser um toast/mensagem própria da página que não deveria aparecer, ou o usuário vê a tela do WhatsApp Web e clica em "Abrir app", e aí falha (o link em si carrega, mas a abertura do app desktop/mobile não funciona em certos contextos).

## Plano de correção

### 1. Corrigir contraste do input no painel default

Arquivo: `src/pages/PublicFormPage.tsx`

Ajustar o bloco `[data-pp-default="true"]` para forçar texto escuro e placeholder cinza legível:

```css
.public-form-page[data-pp-default="true"] input,
.public-form-page[data-pp-default="true"] select,
.public-form-page[data-pp-default="true"] textarea {
  background: #E8ECF4;
  border: 1px solid #C8CACF;
  border-radius: 10px;
  color: #0F172A;
  caret-color: #0F172A;
}
.public-form-page[data-pp-default="true"] input::placeholder,
.public-form-page[data-pp-default="true"] select::placeholder,
.public-form-page[data-pp-default="true"] textarea::placeholder {
  color: #64748B;
  opacity: 1;
}
```

Isso mantém a experiência light para esse formulário específico sem afetar o tema dark padrão (`.dark` já sobrescreve quando aplicado).

### 2. Tornar o redirect para WhatsApp mais robusto

Arquivo: `src/pages/PublicFormPage.tsx` (linhas ~480-488)

Substituir o redirect direto por uma página de confirmação intermédia que:
- Tenta automaticamente abrir o WhatsApp após 800ms usando `window.location.href = redirectUrl`.
- Mostra um botão visível "Entrar no grupo de WhatsApp" como fallback.
- Exibe a mensagem de erro personalizada apenas se o redirect falhar de fato (timeout + confirmação de navegação não iniciada).

Novo fluxo após submit bem-sucedido:
1. Setar estado `submitted=true` (mesmo que haja redirect_url).
2. Renderizar tela de sucesso com título/mensagem do form e CTA principal para o WhatsApp.
3. Usar `useEffect` para tentar o redirect automático: `window.location.href = success_redirect_url`.
4. Se após 1,5s a URL ainda for a mesma do form, mostrar mensagem: "Se o WhatsApp não abrir, clique no botão abaixo."

### 3. Validação

- Acessar `https://parametros.smartdent.com.br/f/exocad_dentalcad_rms`, digitar no campo e verificar texto/placeholder legíveis.
- Simular envio do formulário e confirmar que aparece a tela de sucesso com botão de fallback e tentativa automática de redirect.
- Testar no desktop e mobile para garantir que não há mais a mensagem "Erro ao abrir o WhatsApp" genérica.

## Fora de escopo

- Não alterar tokens globais do tema (não impactar outras landings).
- Não modificar a tabela `smartops_forms` nem o `success_redirect_url` salvo no banco (o link está correto).
- Não mexer em outros formulários ou fluxos de submit.