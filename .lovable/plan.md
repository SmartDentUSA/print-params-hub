Substituir o edge function wa-dispatcher pela versão v66-evogo colada pelo usuário.

Alterações:
- Sobrescrever supabase/functions/wa-dispatcher/index.ts com o código v66-evogo (suporte a button/list/carousel/media via EvoGo).
- As colunas evo_go_instance_token e evo_go_base_url já existem em team_members (verificado via query).
- Nenhuma migration de banco é necessária.
- Fazer deploy do edge function após sobrescrever o arquivo.

Fora de escopo: nenhuma alteração no frontend, schema, ou outras functions.