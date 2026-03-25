

# O codigo ja esta correto — falta publicar

O arquivo `PublicFormPage.tsx` ja contem:
- `useCompanyData()` importado e chamado (linha 9, linha 53)
- Footer com dados dinamicos da empresa (linhas 582-643)
- Icones de redes sociais com fallback para Instagram e YouTube (linhas 607-638)
- Layout `flex flex-col` no container principal (linha 332)

**O problema e que a versao em producao (`parametros.smartdent.com.br`) nao foi atualizada.** O codigo no editor ja esta correto.

## Acao necessaria

Nenhuma alteracao de codigo. Voce precisa **republicar o projeto**:

1. Clique em **"Publish" → "Update"** no painel do Lovable para que as alteracoes sejam enviadas ao dominio customizado
2. Aguarde o deploy finalizar (1-2 minutos)
3. Acesse `https://parametros.smartdent.com.br/f/-formulario-exocad-ia` e confirme que o footer agora exibe os icones de redes sociais

Enquanto isso, voce pode verificar que o preview do Lovable ja mostra o footer correto acessando a mesma rota `/f/-formulario-exocad-ia` na preview.

