# Plan: `training-create-drive-folder` edge function

## Objetivo
Criar edge function no Sistema B (`okeogjgqijbfkudfjadz`) que provisiona a pasta da turma no Google Drive na 1ª inscrição e mantém `turma.json` atualizado a cada nova inscrição.

## Pré-requisitos (secrets)
Antes de criar a function, adicionar via `secrets--add_secret`:
- `GOOGLE_SERVICE_ACCOUNT_JSON` — JSON completo da service account com acesso de escrita à pasta raiz
- `GOOGLE_DRIVE_PARENT_FOLDER_ID` — ID da pasta raiz "imersões"

A service account precisa estar compartilhada como Editor na pasta raiz no Drive.

## Arquivos a criar
1. `supabase/functions/training-create-drive-folder/index.ts`
2. Entrada em `supabase/config.toml`:
   ```
   [functions.training-create-drive-folder]
   verify_jwt = false
   ```

## Contrato
- **Input**: `{ turma_id: string, update_only?: boolean }` (validar com Zod)
- **Output**: `{ ok: true, folder_id, folder_url, created: boolean, updated_json: boolean }`
- CORS habilitado (npm:@supabase/supabase-js@2/cors)

## Fluxo
1. Parse + valida body.
2. Cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY`.
3. `supabase.rpc('fn_get_turma_factory_data', { p_turma_id: turma_id })` → `factoryData`.
4. Carregar service account JSON e gerar **OAuth2 access token via JWT assertion**:
   - Header `{alg:"RS256", typ:"JWT"}`
   - Claim: `iss=client_email`, `scope="https://www.googleapis.com/auth/drive"`, `aud="https://oauth2.googleapis.com/token"`, `iat`, `exp=iat+3600`
   - Assinar com `private_key` via WebCrypto (`crypto.subtle.importKey` PKCS8 + `sign RSASSA-PKCS1-v1_5`)
   - POST `https://oauth2.googleapis.com/token` com `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>` → `access_token`
5. Verificar se turma já tem `factory_drive_folder_id` (do factoryData ou query direta). Define `shouldCreate = !update_only && !existingFolderId`.
6. **Se shouldCreate**:
   - Nome: `` `${turma_number} - ${curso_nome} - ${formatted_dates}` ``
   - Criar pasta raiz da turma (POST `https://www.googleapis.com/drive/v3/files` mimeType `application/vnd.google-apps.folder`, parent = `GOOGLE_DRIVE_PARENT_FOLDER_ID`)
   - Criar 5 subpastas (`dia1`, `dia2`, `dia3`, `depoimentos`, `fotos_grupo`) em paralelo, parent = nova pasta
   - `folderUrl = https://drive.google.com/drive/folders/<id>`
   - UPDATE `smartops_course_turmas SET factory_drive_folder_id, factory_drive_folder_url WHERE id = turma_id`
7. **Sempre** salvar/atualizar `turma.json`:
   - Buscar arquivo existente: `GET /drive/v3/files?q='<folderId>' in parents and name='turma.json' and trashed=false&fields=files(id)`
   - Body multipart com metadata + JSON pretty-printed
   - Se existe: `PATCH /upload/drive/v3/files/{id}?uploadType=multipart`
   - Se não: `POST /upload/drive/v3/files?uploadType=multipart` com parent = folderId
8. Retornar resultado. Try/catch global devolvendo 400/500 com `corsHeaders`.

## Formatação de datas
`factoryData.turma.days` (array) → agrupar por mês: `"10,11,12 Jun 2026"`. Se meses diferentes: `"30 Mai, 1 Jun 2026"`. Locale pt-BR, mês abreviado capitalizado.

## Pontos de atenção
- Assinatura RS256 em Deno: usar `crypto.subtle` nativo (sem libs externas) — converter PEM `private_key` para ArrayBuffer (strip headers + base64 decode).
- Não retentar criação se já existe pasta (idempotência via `factory_drive_folder_id`).
- Logar mas não falhar se subpasta individual falhar.
- `turma.json` upload via multipart boundary manual (Drive API não aceita JSON puro em `uploadType=multipart` sem metadata).

## Fora de escopo
- Não altera o caller (`useEnrollment` etc.). A integração de chamar essa function na 1ª/N-ésima inscrição será feita em tarefa separada.
- Não cria migration — colunas `factory_drive_folder_id`/`factory_drive_folder_url` em `smartops_course_turmas` são assumidas existentes (confirmar antes de invocar; se faltarem, adicionar em migration separada).
