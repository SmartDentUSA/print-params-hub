# Upload de Depoimentos na Agenda Pública

Manter a agenda exatamente como está e adicionar, logo abaixo do título "Próximos Treinamentos Presenciais" e do subtítulo, um acordeão **"Upload de depoimentos"** para qualquer vendedor enviar vídeos de depoimento recebidos por WhatsApp (ou outro canal) e colocá-los no mesmo pipeline de publicação já existente.

## Como funciona para o vendedor

1. Abre o acordeão (visível para quem está logado e é Team Member — mesma regra do botão de Upload de Mídias já usado nos cards).
2. Digita **e-mail, celular ou ID do Deal** do cliente e clica em Buscar.
3. O sistema mostra a ficha encontrada, para confirmação:
   - Nome completo
   - Celular (formatado)
   - Data do treinamento (turma em que participou)
   - Equipamentos comprados (itens dos negócios ganhos)
   - Cidade/UF e especialidade, quando existirem
4. Se o cliente aparecer em mais de um treinamento, o vendedor escolhe a turma correta.
5. Seleciona o vídeo (câmera ou galeria do celular) e envia.
6. O arquivo vai para a pasta oficial **04 - Vídeos Originais → 03 - Depoimentos** da turma escolhida e o pipeline atual segue igual: transcrição → identificação → artigo da Categoria E → RAG → Story do Instagram + Reels + TikTok.

Nenhuma etapa nova: o comportamento pós-upload é idêntico ao dos depoimentos enviados hoje pelo modal de mídias.

## Detalhes técnicos

- **Nova RPC `fn_search_testimonial_client(p_query text)`** (SECURITY DEFINER, restrita a Team Member via `fn_is_team_member()`): resolve o lead canônico (`merged_into IS NULL`) por e-mail, telefone (últimos 8 dígitos), `piperun_deal_id` ou `piperun_id`, devolvendo:
  - identidade (nome, telefone formatado, e-mail, cidade/UF, especialidade);
  - turmas em que o lead consta como inscrito ou acompanhante, com `turma_id`, número, curso e datas;
  - equipamentos comprados a partir dos itens dos negócios ganhos (`deal_items` dos `deals` do lead), com nomes normalizados pelo catálogo.
- **Novo componente `src/components/agenda/DepoimentoUploadAccordion.tsx`**: acordeão (shadcn `Accordion`) com campo de busca, cartão de confirmação da ficha, seletor de turma e o uploader.
- **Reuso total do upload existente**: `prepareUpload` + envio em chunks de `src/lib/trainingDriveUpload.ts` com `destination_key: "videos_depoimentos"`, `turma_id` escolhido e `enrollment_id`/`companion_id` quando houver vínculo — é isso que já cria a linha em `training_testimonials` com `auto_process = true` e alimenta a fila automática de 2 minutos.
- **`src/pages/AgendaPublica.tsx`**: inserir o acordeão logo após o `<header>` na variante `presencial`, condicionado a `isTeamMember`. Nada mais na página muda.
- Sem novas tabelas: `training_testimonials` já possui `turma_id`, `enrollment_id`, `participant_name` e os campos da fila automática.