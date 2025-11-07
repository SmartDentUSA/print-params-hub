# Mapeamento da API PandaVideo

## 🎯 Objetivo
Este documento mapeia a estrutura de dados retornada pela API REST do PandaVideo para o banco de dados SmartDent, garantindo integração correta entre os sistemas.

---

## 🔍 Estrutura de Dados Retornada

### 📹 Lista de Vídeos (GET /videos)

**Endpoint:** `https://api-v2.pandavideo.com.br/videos?page=1&limit=10`

**Estrutura esperada:**
```json
{
  "videos": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "thumbnail": "string (URL)",
      "duration": number (segundos),
      "embed_url": "string (URL)",
      "created_at": "string (ISO 8601)",
      "folder_id": "string (opcional)"
    }
  ],
  "total": number,
  "page": number,
  "limit": number
}
```

**Status:** ⏳ Aguardando testes reais

---

### 🎬 Vídeo Individual (GET /videos/{id})

**Endpoint:** `https://api-v2.pandavideo.com.br/videos/{videoId}`

**Estrutura esperada:**
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "thumbnail": "string (URL)",
  "duration": number (segundos),
  "embed_url": "string (URL)",
  "created_at": "string (ISO 8601)",
  "updated_at": "string (ISO 8601)",
  "folder_id": "string (opcional)",
  "views": number (opcional),
  "status": "string (opcional)"
}
```

**Status:** ⏳ Aguardando testes reais

---

### 📊 Analytics (GET /videos/{id}/analytics)

**Endpoint:** `https://api-v2.pandavideo.com.br/videos/{videoId}/analytics`

**Estrutura esperada:**
```json
{
  "views": number,
  "unique_views": number,
  "watch_time": number (segundos),
  "completion_rate": number (0-1),
  "average_watch_time": number (segundos),
  "drop_off_points": [
    {
      "time": number (segundos),
      "percentage": number (0-100)
    }
  ]
}
```

**Status:** ⏳ Aguardando testes reais

---

### 📁 Pastas (GET /folders)

**Endpoint:** `https://api-v2.pandavideo.com.br/folders`

**Estrutura esperada:**
```json
{
  "folders": [
    {
      "id": "string",
      "name": "string",
      "video_count": number,
      "created_at": "string (ISO 8601)"
    }
  ]
}
```

**Status:** ⏳ Aguardando testes reais

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

- [ ] **GET /videos** (Lista) - Aguardando teste
- [ ] **GET /videos/{id}** (Detalhes) - Aguardando teste
- [ ] **GET /videos/{id}/analytics** (Métricas) - Aguardando teste
- [ ] **GET /folders** (Pastas) - Aguardando teste

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
