## Mudança

Remover o bloco de rodapé com razão social, CNPJ, endereço, site, telefone, redes sociais e copyright que aparece ao final de todo formulário público.

## Arquivo

`src/pages/PublicFormPage.tsx` — deletar o `<footer>` (linhas 981–1046), que renderiza:
- "MMTech Projetos Tecnológicos Importação e Exportação Ltda."
- Endereço "Rua Doutor Procópio de Toledo Malta…"
- Link do site + telefone
- Ícones de redes sociais
- "© 2026 Smart Dent. Todos os direitos reservados."

Nada mais é alterado — o `Footer.tsx` global (usado em outras páginas) continua intacto.