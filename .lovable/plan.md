## Problema

A função `smartops-gerar-comprovante-imersao` retorna **404** (`OPTIONS | 404`) — o arquivo foi criado em `supabase/functions/smartops-gerar-comprovante-imersao/index.ts` mas não está publicado no Supabase ainda.

## Correção

1. **Deploy da edge function** via `supabase--deploy_edge_functions(["smartops-gerar-comprovante-imersao"])`.
2. Re-testar o botão "Comprovante" em uma turma com participantes.
3. Se erro: ler `supabase--edge_function_logs("smartops-gerar-comprovante-imersao")` e ajustar (provavelmente coluna inexistente ou import npm:docx).

Nenhuma mudança de código planejada — só publicação. Se o deploy falhar (incompatibilidade do `docx@8.5.0` no edge runtime), troco para versão fixa estável e re-deploy.
