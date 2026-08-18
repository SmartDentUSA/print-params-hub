# Depoimentos automáticos: upload → transcrição → artigo publicado

Hoje o vídeo sobe para a pasta `04 - Vídeos / 03 - Depoimentos` do Drive, mas **nenhum registro é criado** no pipeline de depoimentos — por isso o painel fica vazio e transcrição/artigo só acontecem se alguém clicar nos botões. O plano fecha o ciclo: assim que o upload termina, o sistema transcreve, identifica o participante e publica o artigo na Base de Conhecimento (Categoria E) com nome, cidade/UF e especialidade reais.

## Fluxo final

```text
Upload (celular ou desktop)
   └─ pasta Depoimentos confirmada pelo Drive
        └─ registro criado no pipeline (status "Enviado")
             └─ cron a cada 2 min
                  ├─ transcreve o áudio do vídeo
                  ├─ identifica o participante (seleção manual, ou pela fala)
                  ├─ monta a ficha real: nome, cidade/UF, especialidade
                  ├─ gera o artigo (só com o que foi dito) e valida
                  └─ publica em /base-conhecimento (Categoria E) + indexa na RAG
                       └─ se a validação falhar → fica "Revisão humana" no painel
```

## O que muda

### 1. Criar o depoimento no fim do upload
Quando o Drive confirma o arquivo e o destino é a pasta de depoimentos, o sistema passa a registrar o depoimento no pipeline automaticamente, já com participante (quando escolhido no upload), arquivo do Drive, nome gerado e turma. Reenvio do mesmo arquivo não duplica (o `drive_file_id` já é único).

### 2. Processamento automático
Um cron a cada 2 minutos pega depoimentos pendentes e executa a sequência transcrever → gerar → publicar, com limite de tentativas e intervalo crescente em caso de falha. Nada é reprocessado depois de publicado. Os botões manuais do painel continuam existindo para reprocessar ou corrigir.

### 3. Identificação pela fala
Sem participante escolhido, a transcrição é usada para extrair o nome falado e casá-lo com os inscritos e acompanhantes daquela turma (comparação tolerante a acento, abreviação e sobrenome parcial). Sem casamento confiável, o depoimento fica em "Sem participante" no painel e não é publicado — nunca é atribuído ao participante errado.

### 4. Ficha real do participante no artigo (exposição para busca)
Com o participante vinculado, o sistema copia da inscrição: nome, cidade, estado e especialidade/área de atuação. O artigo passa a ter:
- bloco "Ficha do participante" visível (nome, cidade/UF, especialidade, curso e turma);
- transcrição completa exposta em seção própria, para ser encontrada em buscas;
- dados estruturados (schema.org) de depoimento e autor, com localidade e especialidade;
- os mesmos campos nos trechos indexados na RAG, para a Dra. LIA responder "tem depoimento de ortodontista em Campinas?".

Clínica/empresa, CNPJ, contrato, telefone, valores e equipamento **não** vão para o público. Nenhum preço no conteúdo (regra global) e nenhuma citação que não exista na transcrição (validação já existente).

### 5. Painel de depoimentos
O painel da turma passa a mostrar que o processamento é automático: contador de "na fila", motivo da última falha e tentativas. Marcar como manual/reprocessar continua num clique.

## Detalhes técnicos

- `training-drive-media-upload` (ação `chunk`, ao concluir): insere em `training_testimonials` quando `destination_key = 'videos_depoimentos'`, com `media_id`, `drive_file_id`, `drive_web_view_link`, `generated_filename`, `turma_id`, `course_id`, `enrollment_id`/`companion_id`, `participant_name`, status `uploaded` (ou `awaiting_identification`). `ON CONFLICT (drive_file_id) DO NOTHING`.
- Migration: colunas `auto_process` (bool, default true), `auto_attempts` (int), `auto_next_attempt_at` (timestamptz), `auto_last_error` (text) em `training_testimonials`; índice parcial por `(auto_next_attempt_at)` para os status pendentes. GRANTs mantidos como na tabela atual.
- Nova função `training-testimonial-auto-process` (`verify_jwt = false`, chamada por `pg_cron` com service role, a cada 2 min): claim atômico por linha (`update ... where auto_next_attempt_at <= now() returning`), até 5 itens por execução, chama internamente as etapas já existentes de `training-testimonial-transcribe` e `training-testimonial-publish` (`publish: true`). Máximo 3 tentativas; backoff 5/20/60 min; erro final grava `auto_last_error` e status `failed`.
- Identificação: em `training-testimonial-transcribe`, após a transcrição, prompt de extração de nome (JSON) + match normalizado contra `smartops_course_enrollments` e acompanhantes da turma; grava `participant_name`, `participant_type` e o vínculo. Sem match → `awaiting_identification`, sem publicar.
- Ficha: `participant_snapshot` recebe `{ nome, cidade, uf, especialidade, area_atuacao, curso, turma }` de `smartops_course_enrollments` (`empresa_cidade`, `empresa_estado`, `especialidade`, `area_atuacao`). `training-testimonial-publish` renderiza o bloco da ficha, a seção da transcrição e o JSON-LD, e envia os mesmos campos como metadados dos chunks da RAG.
- `useTrainingTestimonials` / `TestimonialPipelinePanel`: novos campos de fila/erro na interface e badges correspondentes.
- Sem mudança em `LeadDetailPanel`, Evolution, Golden Rule ou painel comercial.
