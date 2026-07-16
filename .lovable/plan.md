# Pasta automática da Imersão no Google Drive

Evoluir o botão "Criar Pasta" (já existente) para criar a estrutura hierárquica completa da imersão dentro de `# - Treinamentos` (raiz `164RCfpTAh0-5rbQyTiYLH1Vk61aZDflB`), guardar todos os IDs no banco, e passar a espelhar automaticamente DOCX de participantes, certificados e uma descrição em TXT.

## 1. Banco (migration)

Adicionar em `smartops_course_turmas`:

- `drive_folder_id text` (renomear via alias — manter `factory_drive_folder_id` populado por retrocompat)
- `drive_folder_url text`
- `drive_folder_name text`
- `drive_folder_created_at timestamptz`
- `drive_subfolders jsonb` — mapa `{ dados, certificados, certificados_individuais, certificados_pacote, fotos, fotos_turma, fotos_participantes_certificados, fotos_atividades, fotos_equipamentos, fotos_bastidores, videos, videos_vertical, videos_horizontal, videos_depoimentos, videos_atividades, videos_bastidores, entregas, entregas_carrossel, entregas_stories, entregas_reels, entregas_thumb_yt, entregas_reddit, entregas_legendas }`
- `drive_docx_file_id text` (DOCX de participantes espelhado)
- `drive_descricao_file_id text` (descrição TXT)

Os campos `factory_drive_folder_id/url` continuam sendo escritos em paralelo (retrocompat com `training-create-drive-folder` e UI atual).

## 2. Edge function `training-create-drive-folder` (rework)

Nome da pasta principal:

```
Imersão {turma_number} - {course_title} - {data_inicial} a {data_final}
```

Se dia único → `Imersão {n} - {curso} - {DD-MM-YYYY}`. Sem `sanitize` que quebre acentos (manter UTF-8, remover apenas `/` e `\`).

Estrutura criada em paralelo (mantém idempotência):

```
Imersão {n} - {curso} - {datas}
├── 01 - Dados da Imersão
├── 02 - Certificados
│   ├── 01 - Individuais
│   └── 02 - Pacote Completo
├── 03 - Fotos Originais
│   ├── 01 - Foto da Turma
│   ├── 02 - Participantes com Certificados
│   ├── 03 - Atividades Práticas
│   ├── 04 - Equipamentos e Resultados
│   └── 05 - Bastidores
├── 04 - Vídeos Originais
│   ├── 01 - Vídeos Verticais
│   ├── 02 - Vídeos Horizontais
│   ├── 03 - Depoimentos
│   ├── 04 - Atividades Práticas
│   └── 05 - Bastidores
└── 05 - Entregas
    ├── 01 - Carrossel Instagram
    ├── 02 - Stories
    ├── 03 - Reels
    ├── 04 - Thumbnail YouTube
    ├── 05 - Reddit
    └── 06 - Legendas e Textos
```

Comportamento:

- **Idempotente**: se `drive_folder_id` existe, listar filhos e criar somente subpastas ausentes; nunca duplicar pasta principal. Renomear a pasta principal só via ação explícita "Atualizar descrição".
- Persistir o mapa completo em `drive_subfolders` (jsonb).
- Sempre (re)gerar `01 - Dados da Imersão/descricao_da_imersao.txt` com o template do item 7 (UTF-8). Substituir arquivo por ID quando já existir.
- Também regravar `turma.json` (mantido, retrocompat).
- Retorno: `{ folder_id, folder_url, subfolders, updated, created }`.

## 3. DOCX de participantes (espelho no Drive)

Em `smartops-gerar-doc-turma`:

- Continuar retornando o `.docx` como download normal.
- Após gerar o buffer, chamar internamente `training-create-drive-folder` (garantir estrutura) e fazer upload multipart para `01 - Dados da Imersão`.
- Nome: `imersao_{numero}_participantes_{DD-MM-YYYY}.docx` (data = data inicial).
- Se `drive_docx_file_id` existir, `PATCH` uploadType=media no mesmo ID (evita `(1)`, `(2)`).
- Falha do upload não bloqueia o download — apenas logar `system_health_logs`.

## 4. Certificados (espelho no Drive)

Em `generate-certificate` (individual) e no fluxo de "Gerar Crachás/Certificados em lote":

- Após gerar o PDF, upload para `02 - Certificados/01 - Individuais/`.
- Nome: `certificado_{numero_imersao}_{slug(nome_participante)}.pdf` — slug sem CPF/telefone.
- Pacote completo (quando existir): `certificados_imersao_{n}.zip` em `02 - Certificados/02 - Pacote Completo/`, sobrescrevendo por ID.
- Nenhum dado sensível no nome do arquivo.

## 5. Frontend

`CriarPastaDriveButton.tsx`:

- Estados: `idle`, `Criando…`, `Pasta criada`, `Abrir pasta`, `Erro ao criar` (toast + retry).
- Após sucesso, exibir também ação "Atualizar descrição no Drive" (chama a mesma função com `refresh_description: true`).

`TurmaCard.tsx` / `TurmaListRow.tsx`:

- Se `drive_folder_url` presente, mostrar linha compacta: `✓ Pasta do Drive criada · [Abrir] · [Atualizar descrição]`.
- Botões "Enviar fotos" e "Enviar vídeos" ficam **fora deste escopo** (item 8) — seguem em backlog separado (upload UI com escolha de categoria).

## 6. Segurança

- Toda escrita no Drive é feita pela edge function via Service Account (`GOOGLE_SERVICE_ACCOUNT_JSON`), nunca no frontend.
- Nenhuma alteração de permissão pública: herdar da pasta raiz.
- Validar `auth.uid()` na edge function antes de operar (usar JWT do chamador via `Authorization` header + `service_role` para escrita).
- Nomes de arquivos sem CPF/CNPJ/telefone/contrato — usar slug do nome apenas.

## 7. Fora deste plano (backlog explícito)

- Upload de fotos/vídeos com escolha de categoria (item 8 do briefing).
- Botão "Atualizar descrição" separado no card (chama endpoint que já será idempotente).

## Detalhes técnicos

- Preserva a assinatura atual de `training-create-drive-folder` (`{ turma_id, update_only? }`), adiciona `refresh_description?: boolean`.
- Templates de subpastas armazenados como constante `FOLDER_TREE` (array recursivo) — permite adicionar novas categorias sem migração.
- Upload via `uploadType=multipart` para arquivos pequenos (DOCX/TXT/PDF individual), `uploadType=resumable` só se pacote ZIP > 5 MB.
- `drive_subfolders` consultado em cada chamada; subpastas ausentes recriadas por diff (nome exato).
