# Corrigir login administrativo do SmartOps

## Objetivo
Fazer o botão **Entrar** autenticar de forma confiável e liberar o painel somente após confirmar a conta e a permissão administrativa.

## Alterações
- Corrigir o envio do formulário para normalizar o e-mail, validar a sessão retornada e mostrar o erro diretamente na tela.
- Remover dependência do evento assíncrono de login para concluir a entrada.
- Validar a sessão no servidor e carregar as permissões administrativas de forma explícita, com mensagem clara quando houver falha.
- Evitar que uma sessão antiga ou inválida deixe a tela aparentemente travada.

## Verificação
- Testar o clique em **Entrar**, estado de carregamento e mensagens de erro.
- Confirmar que uma conta administrativa abre `/smartops` e que uma conta sem permissão continua bloqueada.
- Conferir a tela em largura de celular e os registros de erro após a correção.
