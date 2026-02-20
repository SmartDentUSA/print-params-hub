
# Por que o RAG da L.I.A. não usa as informações do endpoint externo — e como corrigir

## Diagnóstico técnico

O endpoint `ai_training` existe e está funcionando. O problema é arquitetural: a edge function `index-embeddings` foi escrita para ler **exclusivamente tabelas do banco Supabase local** (4 fontes). Ela nunca foi conectada ao endpoint externo.

### O que o RAG indexa hoje (1.073 chunks)

| Fonte | Chunks |
|---|---|
| Vídeos locais (knowledge_videos) | 443 |
| Artigos locais (knowledge_contents) | 307 |
| Parâmetros (parameter_sets) | 305 |
| Resinas (resins) | 18 |
| **Empresa / Depoimentos / Parcerias** | **0** |

### O que o endpoint externo oferece (e está faltando no RAG)

Lendo os 1.438 linhas do `ai_training`, identifiquei 5 blocos ricos que nunca foram indexados:

**1. Perfil da empresa** — Missão, visão, valores, diferenciais, expertise técnica, posicionamento de mercado, áreas de serviço (SP, RJ, MG, PR, SC, RS, GO, BA, PE, AM, DF, EUA, América Latina)

**2. Histórico cronológico de parcerias** — Exatamente o que a L.I.A. não sabia responder:
- 2009: Fundação na USP São Carlos — primeira Central CAD/CAM do Brasil
- 2011: Parceria com Medit (escaneamento intraoral)
- 2012: Distribuidora oficial da Exocad (software CAD alemão)
- 2022: Resina Vitality + distribuidores ASIGA
- 2023: ChairSide Print (SCAN • CAD • PRINT • MAKE)
- 2024: Distribuidores BLZ INO200
- 2025: Parceria com RayShape + AI nos fluxos

**3. 20 depoimentos de clientes com transcrições completas** — Clientes reais de BA, RJ, SP, MG, RS, CE, DF, RN, PB, identificados pelo nome e cidade

**4. 62 avaliações Google (5 estrelas) com texto** — Permitem L.I.A. citar exemplos reais quando perguntam sobre satisfação

**5. Regras anti-alucinação por categoria** — Regras do tipo "NUNCA afirmar biocompatibilidade sem certificação ISO" que a L.I.A. deveria seguir ao responder sobre cada tipo de produto

**6. Insights NPS** — Protocolos Impressos (57 clientes, 68%), Impressão 3D (35, 42%), Cirurgia Guiada (35, 42%)

## Por que não foi feito antes

A abordagem atual de injetar o `ai_training` no system prompt (implementada nas últimas sessões) foi uma solução de curto prazo — eficiente para dados de contato, mas insuficiente para o volume rico de conteúdo disponível. O system prompt tem limite de tokens e não permite busca semântica: se um usuário perguntar "você tem clientes em Natal?", a L.I.A. não encontra o depoimento do Dr. Allyson André de Natal/RN porque esse texto não está no RAG.

## Solução: Nova stage no `index-embeddings` — `?stage=external_kb`

A estratégia é estender a edge function `index-embeddings` com uma **quinta fonte de dados**: o endpoint externo `ai_training`. Isso segue exatamente o padrão já existente (articles → videos → resins → parameters) e adiciona:

```text
5. EXTERNAL KB (novo)
   → Fetch do endpoint ai_training (live, sem cache)
   → Parse das seções por regex/split em ##
   → Geração de chunks semânticos por bloco
   → Inserção em agent_embeddings com source_type = "company_kb"
```

### Chunks que serão gerados (estimativa: ~50–80 chunks novos)

| Bloco | Chunks | source_type |
|---|---|---|
| Perfil da empresa (missão, visão, expertise, áreas) | 3–4 | company_kb |
| Histórico de parcerias (um chunk por marco cronológico) | 7–8 | company_kb |
| Parcerias internacionais (detalhe de cada parceiro) | 5 | company_kb |
| Depoimentos de clientes (1 chunk por cliente) | 20 | company_kb |
| Avaliações Google (agrupadas em lotes de 10) | 6–7 | company_kb |
| Regras anti-alucinação por categoria | 5–8 | company_kb |
| NPS Insights | 1–2 | company_kb |

### Exemplo de chunk gerado para busca semântica

```text
source_type: "company_kb"
chunk_text: "Smart Dent parceria exocad 2012 — Em 2012, a Smart Dent 
tornou-se distribuidora oficial da Exocad, empresa alemã referência 
global em softwares CAD para odontologia (DentalCAD, ChairsideCAD, 
Exoplan). Desde então, consolidou-se como referência em integração 
digital, levando tecnologia de ponta para clínicas e laboratórios 
em todo o Brasil. Relevância: 10/10."
metadata: {
  title: "Parceria Exocad — Smart Dent",
  partner: "exocad",
  since: "2012",
  url: "https://exocad.com/our-partners/reseller"
}
```

```text
source_type: "company_kb"
chunk_text: "Depoimento Dr. Allyson André — Natal e Patos, RN — 
Especialista em odontologia digital que escolheu a SmartDent 
para se inserir no mercado de vanguarda. Adquiriu scanner e 
impressora, fez curso presencial em São Carlos. Recomenda para 
quem quer precisão, trabalhos de qualidade e tratamentos duradouros."
metadata: {
  title: "Depoimento Dr. Allyson André",
  location: "Natal e Patos — RN",
  url: "https://www.youtube.com/shorts/ZaJ74X5dRn4"
}
```

## Implementação técnica

### Mudança única: `supabase/functions/index-embeddings/index.ts`

**1. Interface Chunk estendida** — adicionar `"company_kb"` como source_type válido:
```typescript
interface Chunk {
  source_type: "article" | "video" | "resin" | "parameter" | "company_kb";
  // ... resto igual
}
```

**2. Nova função `fetchExternalKBChunks()`** — chamada antes do processamento de batches:

```typescript
async function fetchExternalKBChunks(): Promise<Chunk[]> {
  const EXTERNAL_KB_URL = "https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-base";
  try {
    const res = await fetch(`${EXTERNAL_KB_URL}?format=ai_training`, {
      signal: AbortSignal.timeout(10000), // 10s — mais tolerante que o dra-lia (3s)
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseExternalKBToChunks(text);
  } catch (err) {
    console.warn("[external-kb] fetch failed:", err);
    return [];
  }
}
```

**3. Nova função `parseExternalKBToChunks(text)`** — parseia o texto por seções `##` e gera chunks:

- **Bloco PERFIL DA EMPRESA**: divide em 3 sub-chunks (identidade, expertise, áreas de serviço)
- **Bloco PARCERIAS INTERNACIONAIS**: um chunk por parceiro com nome, país, desde quando, descrição
- **Bloco VÍDEOS DE DEPOIMENTOS**: um chunk por linha de depoimento (URL + texto completo já transcrito)
- **Bloco INSIGHTS NPS**: chunk único com produtos demandados e keywords validadas
- **Bloco REVIEWS**: agrupa 8–10 avaliações por chunk (para não criar 62 chunks individuais)
- **Bloco CATEGORIAS**: um chunk por categoria com as regras anti-alucinação

**4. Integração no fluxo principal** — após os 4 loops existentes:
```typescript
// ── 5. EXTERNAL KB ──────────────────────────────────────────────
const externalChunks = await fetchExternalKBChunks();
console.log(`[external-kb] ${externalChunks.length} chunks from ai_training endpoint`);
chunks.push(...externalChunks);
```

**5. Limpeza no modo `full`** — o modo full já deleta tudo antes de reindexar, então os chunks `company_kb` serão automaticamente removidos e recriados a cada reindexação completa. No modo `incremental`, a deduplicação por `chunk_text` existente garante que apenas chunks novos/modificados sejam reinseridos.

## Por que RAG e não apenas system prompt

| Critério | System prompt (atual) | RAG (proposto) |
|---|---|---|
| Dados de contato rápidos | Excelente — acesso imediato | Desnecessário |
| "Você tem clientes em Natal?" | Não encontra — o texto não está no RAG | Recupera chunk do depoimento do Dr. Allyson de Natal/RN |
| "Vocês têm avaliações de laboratórios?" | Não sabe | Recupera avaliações de TPDs como Benedito de Mogi Guaçu |
| "Qual a regra para vender resinas biocompatíveis?" | Não encontra | Recupera chunk com regras anti-alucinação da categoria |
| Escalabilidade | Limitado por tokens do prompt | Ilimitado — só os chunks relevantes são recuperados |
| Atualização | Requer redeploy | Reindexação via botão no admin |

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/index-embeddings/index.ts` | + Interface Chunk com `company_kb` + `fetchExternalKBChunks()` + `parseExternalKBToChunks()` + integração no fluxo de chunks |

Nenhuma migração SQL necessária — a tabela `agent_embeddings` já aceita qualquer valor em `source_type` (coluna `text`). Nenhuma mudança no frontend ou no `dra-lia`. Deploy automático após a edição.

Após a implementação, o admin deve executar "Reindexar Tudo" no painel para popular os ~50–80 chunks novos de `company_kb`.
