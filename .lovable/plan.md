
# Integração da Knowledge Base API (formato `ai_training`) na Dra. L.I.A.

## O que o endpoint externo fornece

O endpoint `https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-base?format=ai_training` retorna **dados ao vivo, sem cache**, com conteúdo estruturado em Markdown que cobre:

```text
PERFIL DA EMPRESA
  - Nome, Descrição, Missão, Visão, Valores, Diferenciais
  - Contato: telefone (16993831794), e-mail (comercial@smartdent.com.br)
  - Endereço, horário, redes sociais, CNPJ, fundador (Marcelo Del Guerra)
  - NPS Score: 96 | Rating Google: 5.0 | 150 reviews | 84 respostas NPS

INSIGHTS DE CLIENTES (NPS)
  - Produtos mais demandados: Protocolos Impressos (57), Impressão 3D (35), Cirurgia Guiada (35)
  - Keywords validadas por demanda real

VÍDEOS DA EMPRESA (YouTube + Instagram)
  - 13 vídeos de depoimentos de clientes
  - 11 vídeos de treinamentos/institucional

PARCERIAS INTERNACIONAIS
  - exocad (Alemanha), FDA (EUA), BLZ Dental (China), RAYSHAPE (China)

AVALIAÇÕES GOOGLE
  - 62+ avaliações individuais com texto completo (5 estrelas)

CATEGORIAS E SUBCATEGORIAS
  - 20+ categorias de produto com regras anti-alucinação específicas

LINKS E KEYWORDS ESTRATÉGICOS
  - Centenas de keywords mapeadas para URLs da loja

NAVEGAÇÃO E FOOTER
  - Links de menu, redes sociais, localizações
```

## Como a L.I.A. funciona atualmente

A L.I.A. usa **exclusivamente** dados do banco Supabase local via RAG:
1. `agent_embeddings` → busca vetorial (pgvector)
2. `knowledge_contents` → artigos da base de conhecimento
3. `knowledge_videos` → vídeos com transcrições
4. `resins` → dados de resinas com instruções de processamento
5. `parameter_sets` → parâmetros de impressão

**O que L.I.A. NÃO sabe hoje** (mas o endpoint externo tem):
- Telefone, e-mail, endereço completo da Smart Dent
- NPS, satisfação de clientes, produtos mais demandados
- Parcerias (exocad, FDA, BLZ, RAYSHAPE)
- Depoimentos reais de clientes
- Regras anti-alucinação por categoria de produto
- Links das redes sociais e navegação do site

## Estratégia de integração: Company Context no System Prompt

A abordagem mais eficiente **não é indexar no RAG** (que usaria tokens de embedding para dados que raramente mudam). A estratégia correta é buscar o endpoint `ai_training` diretamente dentro da edge function `dra-lia`, **uma vez por request**, e injetar as informações mais importantes como contexto estático no `systemPrompt`. Isso garante:

- **Dados ao vivo** (sem cache de 3h)
- **Zero custo de reindexação** — não polui `agent_embeddings`
- **Resposta imediata** — L.I.A. passa a conhecer contatos e empresa desde o primeiro request
- **Sem tokens extras de embedding** — o conteúdo vai direto no system prompt

### O que injetar (apenas o essencial — ~800 tokens)

Extrair do JSON `ai_training` apenas o bloco de empresa + contatos + NPS:

```text
## CONTEXTO DA EMPRESA (Smart Dent)
- Telefone: (16) 99383-1794
- E-mail: comercial@smartdent.com.br
- WhatsApp: https://wa.me/5516993831794
- Endereço: Dr. Procópio de Toledo Malta, 62 — São Carlos, SP
- Horário: Seg–Sex 8h às 18h
- Fundada em: 2009 | CEO: Marcelo Del Guerra
- NPS: 96 | Google: 5.0 ⭐ (150 reviews)
- Parcerias: exocad, RayShape, BLZ Dental, Medit
- Loja: https://loja.smartdent.com.br/
- Parâmetros: https://parametros.smartdent.com.br/
- Cursos: https://smartdentacademy.astronmembers.com/
```

### Fluxo de execução proposto

```text
Request chega em dra-lia
       │
       ├── [NOVO] Fetch company context do endpoint ai_training
       │          └── Timeout: 3s (se falhar, usa fallback hardcoded)
       │
       ├── Busca RAG (agent_embeddings / FTS / ILIKE)
       │
       ├── Busca parâmetros (parameter_sets)
       │
       └── Monta systemPrompt
              └── [NOVO] Inclui bloco COMPANY CONTEXT no topo do systemPrompt
```

## Implementação técnica

### Arquivo único: `supabase/functions/dra-lia/index.ts`

**1. Nova constante no topo do arquivo:**
```typescript
const EXTERNAL_KB_URL = "https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-base";
```

**2. Nova função `fetchCompanyContext()` (antes do `serve()`):**

A função faz um fetch com timeout de 3 segundos ao endpoint `?format=ai_training` (texto plano, sem necessidade de parsear JSON). Extrai por regex simples os campos:
- `**Telefone de Contato:** (\S+)` → telefone
- `**Email de Contato:** (\S+)` → e-mail
- `**NPS Score:** (\d+)` → NPS
- `**Rating:** ([^\n]+)` → rating Google
- `**Endereço Completo:**[\s\S]+?(?=\*\*)` → endereço
- `**Horário de Funcionamento:**[\s\S]+?(?=\n\n)` → horário

Retorna uma string formatada para injeção no systemPrompt. Se o fetch falhar (timeout ou erro de rede), retorna um bloco hardcoded com os valores já conhecidos — garantindo zero impacto em produção.

**3. Modificação no `serve()` — antes das buscas RAG:**
```typescript
const companyContext = await fetchCompanyContext();
```

**4. Modificação no `systemPrompt` — novo bloco antes das 17 diretrizes:**
```typescript
### 🏢 DADOS DA EMPRESA (fonte: sistema ao vivo)
${companyContext}

INSTRUÇÃO ESPECIAL: Você está ONLINE e ativa. Quando perguntarem "você está online?", 
"você funciona?", "você está ativa?" — responda afirmativamente com o horário de atendimento 
e ofereça o WhatsApp como complemento humano.

Para perguntas sobre contato comercial, retorne SEMPRE:
- 📞 WhatsApp: (16) 99383-1794
- ✉️ E-mail: comercial@smartdent.com.br
- 🕐 Horário: Segunda a Sexta, 8h às 18h
```

**5. Complementar SUPPORT_FALLBACK:** Hoje o fallback de suporte hardcoda o número. Com o `companyContext` disponível, os dados ficam sempre atualizados.

## Casos de uso imediatos que passam a funcionar

| Pergunta do usuário | Situação atual | Após implementação |
|---|---|---|
| "Você está online?" | Fallback genérico | "Sim! Estou ativa e pronta para ajudar..." |
| "Qual o telefone de contato?" | "Não tenho essa informação" | "(16) 99383-1794 / WhatsApp" |
| "Como entrar em contato com o comercial?" | Resposta vaga | E-mail + WhatsApp + horário |
| "A Smart Dent tem parceria com a exocad?" | "Não sei" | "Sim, desde 2012..." |
| "Qual o NPS de vocês?" | "Não sei" | "Nosso NPS é 96..." |
| "Vocês atendem em todo o Brasil?" | "Não sei" | "Sim, com presença em SP, RJ, MG..." |

## Timeout e resiliência

A função `fetchCompanyContext()` usa `AbortSignal.timeout(3000)`:
- Se o endpoint externo responder em < 3s → dados ao vivo ✓
- Se demorar > 3s ou falhar → usa fallback hardcoded com dados estáticos conhecidos ✓
- Zero risco de quebrar o fluxo principal da L.I.A. ✓

## Arquivos modificados

| Arquivo | Tipo de mudança |
|---|---|
| `supabase/functions/dra-lia/index.ts` | + `EXTERNAL_KB_URL` constante + `fetchCompanyContext()` + injeção no systemPrompt |

Nenhuma migração SQL. Nenhuma mudança no frontend. Nenhuma nova edge function.

O deploy é automático após a edição do arquivo.
