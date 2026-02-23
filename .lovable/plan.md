

# Implementacao dos 3 Planos Pendentes

## 1. Corrigir Regex de Suporte que Bloqueia "pecas"

**Arquivo:** `supabase/functions/dra-lia/index.ts` (linha 192)

**Antes:**
```typescript
/(peça|peças|replacement part|reposição|componente)/i,
```

**Depois:**
```typescript
/(peça|peças).{0,20}(reposição|substituição|quebr|troc|defeito|danific|falt)/i,
/(replacement part|spare part).{0,20}(order|need|broken|replace)/i,
/(reposição|componente).{0,20}(quebr|troc|defeito|danific|falt)/i,
```

Isso evita que perguntas sobre capacidade de producao ("35 pecas por vez") sejam redirecionadas para suporte. A palavra "pecas" so dispara suporte quando acompanhada de contexto de problema tecnico.

---

## 2. Adicionar Suporte a VIDEO_YOUTUBE

### 2a. Adicionar `url` ao SELECT de videos (linha 1345)

**Antes:**
```typescript
.select("id, title, description, embed_url, thumbnail_url, content_id, pandavideo_id")
```

**Depois:**
```typescript
.select("id, title, description, embed_url, thumbnail_url, content_id, pandavideo_id, url")
```

### 2b. Incluir `youtube_url` no metadata (linha 1384-1395)

Adicionar `youtube_url: v.url || null` ao objeto metadata dos resultados de video.

### 2c. Adicionar tag VIDEO_YOUTUBE no buildStructuredContext (linha 1846-1850)

**Antes:**
```typescript
if (meta.url_interna) {
  part += ` | VIDEO_INTERNO: ${meta.url_interna}`;
} else if (meta.embed_url) {
  part += ` | VIDEO_SEM_PAGINA: sem página interna disponível`;
}
```

**Depois:**
```typescript
if (meta.url_interna) {
  part += ` | VIDEO_INTERNO: ${meta.url_interna}`;
} else if (meta.youtube_url) {
  part += ` | VIDEO_YOUTUBE: ${meta.youtube_url}`;
} else if (meta.embed_url) {
  part += ` | VIDEO_SEM_PAGINA: sem página interna disponível`;
}
```

### 2d. Atualizar Regra 7 do system prompt (linha 2043)

**Antes:**
```
7. Ao encontrar um VÍDEO: Se tiver VIDEO_INTERNO, gere um link Markdown [...] Se tiver VIDEO_SEM_PAGINA, mencione apenas o título sem gerar link.
```

**Depois:**
```
7. Ao encontrar um VÍDEO: Se tiver VIDEO_INTERNO, gere um link Markdown [Assistir no site](VIDEO_INTERNO_URL).
   Se tiver VIDEO_YOUTUBE, gere um link Markdown [Assistir no YouTube](VIDEO_YOUTUBE_URL).
   NUNCA use URLs do PandaVideo como links clicáveis. Se tiver VIDEO_SEM_PAGINA, mencione apenas o título sem gerar link.
```

---

## 3. Enriquecer extra_data do NanoClean PoD

**Tabela:** `system_a_catalog` (ID: `19bc59de-a1f0-4994-b5ab-4c1a2464b7e0`)

Atualizar o campo `extra_data` com dados tecnicos extraidos do PDF da tabela comparativa:

```json
{
  "technical_specs": {
    "capacity": "Até 35 peças por ciclo",
    "cleaning_method": "Ultrassônico + centrifugação",
    "liquid": "Liquido proprietário (sem álcool isopropílico)",
    "cycle_time": "10 minutos",
    "compatibility": "Resinas de alta carga e convencionais"
  },
  "competitor_comparison": {
    "vs_ipa_manual": "Elimina uso de IPA, processo automatizado vs manual",
    "vs_ultrasonic_only": "Centrifugação adicional remove residuos que ultrassom sozinho não alcança",
    "key_advantage": "Processo padronizado e reprodutível, sem variação de operador"
  },
  "workflow_stages": [
    "Remover peça da impressora",
    "Colocar no NanoClean PoD (até 35 peças)",
    "Ciclo automatico de 10 minutos",
    "Peça pronta para pós-cura"
  ]
}
```

Isso sera feito via UPDATE SQL usando a ferramenta de insercao de dados.

---

## Resumo de Alteracoes

| Item | Tipo | Arquivo/Tabela |
|------|------|----------------|
| Regex de suporte | Edge Function | `dra-lia/index.ts` linha 192 |
| SELECT de url | Edge Function | `dra-lia/index.ts` linha 1345 |
| youtube_url metadata | Edge Function | `dra-lia/index.ts` linha 1384-1395 |
| VIDEO_YOUTUBE tag | Edge Function | `dra-lia/index.ts` linha 1846-1850 |
| Regra 7 do prompt | Edge Function | `dra-lia/index.ts` linha 2043 |
| NanoClean extra_data | Banco de dados | `system_a_catalog` UPDATE |

