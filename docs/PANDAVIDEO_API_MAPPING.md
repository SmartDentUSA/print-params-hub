# Mapeamento da API PandaVideo

## 🎯 Objetivo
Este documento mapeia a estrutura de dados retornada pela API REST do PandaVideo para o banco de dados SmartDent, garantindo integração correta entre os sistemas.

---

## 🔍 Estrutura de Dados Retornada

### 📹 Lista de Vídeos (GET /videos)

**Endpoint:** `https://api-v2.pandavideo.com.br/videos?page=1&limit=50`

**Estrutura real (validada):**
```json
{
  "videos": [
    {
      "id": "uuid",                      // ID interno Panda
      "video_external_id": "uuid",       // Usado para embed/HLS
      "title": "string",
      "description": "string",
      "length": number,                  // Duração em segundos
      "thumbnail": "url",
      "preview": "url",
      "video_player": "url",             // URL embed pronta
      "video_hls": "url",                // URL streaming direto
      "folder_id": "uuid"
    }
  ],
  "total": number
}
```

**Status:** ✅ Estrutura validada e simplificada

---

### 🎬 Vídeo Individual (GET /videos/{id})

**Endpoint:** `https://api-v2.pandavideo.com.br/videos/{videoId}`

**Estrutura real (validada):**
```json
{
  "id": "uuid",                      // ID interno
  "video_external_id": "uuid",       // ID externo
  "title": "string",
  "description": "string",
  "length": number,                  // Segundos
  "thumbnail": "url",
  "preview": "url",
  "video_player": "url",
  "video_hls": "url",
  "folder_id": "uuid"
}
```

**Status:** ✅ Estrutura validada

---

### 📊 Analytics (GET /analytics/traffic)

**Endpoint:** `https://api-v2.pandavideo.com.br/analytics/traffic`

**Query Parameters:**
- `video_id` (string, obrigatório): ID do vídeo (UUID formato v4)
- `start_date` (string, obrigatório): Data inicial no formato YYYY-MM-DD
- `end_date` (string, obrigatório): Data final no formato YYYY-MM-DD
- `type` (string, opcional): "drm" para dados específicos de DRM

**Estrutura real (validada):**
```json
{
  "data": [
    {
      "t": "YYYY-MM-DD",  // Data
      "b": number         // Bytes consumidos
    }
  ]
}
```

**Notas:**
- Retorna dados de consumo de banda (bandwidth) do vídeo no período especificado
- O `video_id` deve ser o campo `id` (interno) da lista de vídeos, NÃO o `video_external_id`
- Formato do UUID: `^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`

**Status:** ✅ Endpoint validado com sucesso

---

### 📁 Pastas (GET /folders)

**Endpoint:** `https://api-v2.pandavideo.com.br/folders`

**Estrutura real (validada):**
```json
{
  "folders": [
    {
      "id": "uuid",
      "name": "string",
      "parent_folder_id": "uuid | null",
      "videos_count": number
    }
  ]
}
```

**Status:** ✅ Estrutura validada e simplificada

---

## 🗄️ Mapeamento para Banco de Dados

### Tabela: `knowledge_videos`

| Campo API | Campo DB | Tipo PostgreSQL | Observações |
|-----------|----------|-----------------|-------------|
| `id` | `pandavideo_id` | `VARCHAR(100)` | ID único do vídeo no PandaVideo |
| `title` | `title` | `TEXT` | Título do vídeo |
| `thumbnail` | `thumbnail_url` | `TEXT` | URL da thumbnail |
| `duration` | `video_duration_seconds` | `INTEGER` | Duração em segundos |
| `embed_url` | `pandavideo_embed_code` | `TEXT` | URL/código de embed |
| - | `video_type` | `VARCHAR(20)` | Valor fixo: `'pandavideo'` |
| - | `url` | `TEXT` | Mantido vazio ou NULL para vídeos PandaVideo |

### Notas de Implementação

1. **Campo `video_type`**: Discriminador para suportar YouTube e PandaVideo na mesma tabela
2. **Campo `url`**: Usado apenas para vídeos YouTube; deixar NULL para PandaVideo
3. **Campo `pandavideo_embed_code`**: Armazena a URL completa de embed do player
4. **Campo `thumbnail_url`**: URL da imagem de preview do vídeo

---

## ✅ Endpoints Testados

- [x] **GET /videos** (Lista) - ✅ Validado
- [x] **GET /videos/{id}** (Detalhes) - ✅ Validado
- [x] **GET /analytics/traffic** (Analytics) - ✅ Validado
- [x] **GET /folders** (Pastas) - ✅ Validado

---

## 📝 Instruções de Teste

### 1. Acessar Painel Admin
```
URL: https://parametros.smartdent.com.br/admin
Aba: 🧪 PandaVideo Test
```

### 2. Sequência Recomendada
1. **Testar Auth** → Validar API key
2. **Listar Vídeos** → Copiar um ID de vídeo
3. **Detalhes do Vídeo** → Colar ID e verificar campos
4. **Analytics** → Verificar métricas disponíveis
5. **Listar Pastas** → Ver organização

### 3. Após os Testes
- ✅ Atualizar este documento com estrutura real retornada
- ✅ Confirmar mapeamento de campos
- ✅ Identificar campos adicionais não previstos
- ✅ Marcar checkboxes dos endpoints testados

---

## 🔐 Autenticação

**Método:** Bearer Token  
**Header:** `Authorization: Bearer {PANDAVIDEO_API_KEY}`  
**Secret:** Configurado em Supabase Secrets como `PANDAVIDEO_API_KEY`

---

## 📌 Observações Importantes

1. **IDs do PandaVideo**: Verificar formato exato (ex: `panda-abc123` ou apenas `abc123`)
2. **Embed URLs**: Confirmar se retorna URL completa ou apenas ID
3. **Thumbnails**: Verificar se URLs são permanentes ou expiram
4. **Duração**: Confirmar unidade (segundos vs milissegundos)
5. **Pastas**: Verificar se é recurso disponível na API

---

## 🚀 Próximos Passos

Após validação da API:
1. ✅ Atualizar este documento com dados reais
2. ✅ Criar migration para tabela `knowledge_videos`
3. ✅ Implementar componente `PandaVideoPlayer`
4. ✅ Criar hook `usePandaVideo`
5. ✅ Desenvolver modal de seleção no admin
6. ✅ Integrar no front-end da Base de Conhecimento

---

**Última atualização:** 2025-01-07  
**Status:** 📋 Aguardando testes iniciais da API
