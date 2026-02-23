

# Plano: Ingestao da Apostila SPIN "Voce quer imprimir ou ser especialista" no Cerebro da L.I.A.

## Analise do Documento

O documento contem 7 camadas de informacao distintas:

| Secao | Linhas | Conteudo | Valor para L.I.A. |
|-------|--------|----------|-------------------|
| Contexto + Pitch | 1-32 | Posicionamento, dores, solucao | Alto (SDR) |
| Jornada SPIN | 39-64 | Desejo/Dor/Resultado + metricas | Alto (SDR) |
| 3 Produtos detalhados | 66-600 | Specs, FAQs, anti-alucinacao, comparativos, produtos requeridos/proibidos | Critico |
| 10 FAQs SDR | 570-611 | Perguntas comerciais com respostas completas | Alto (SDR) |
| Mensagem WhatsApp | 613-643 | Template de abordagem | Medio (SDR) |
| Video principal | 646-650 | URL YouTube do video de apresentacao | Medio |
| 200+ Depoimentos | 652-3855 | Transcritos de clientes com cidade/especialidade | Alto (prova social) |

## Estrategia de Ingestao: 3 Camadas

### Camada 1: Enriquecer `system_a_catalog.extra_data` (3 produtos)

Atualizar os 3 produtos mencionados no catalogo com dados estruturados extraidos da apostila:

**1a. Rayshape Edge Mini** - Adicionar ao `extra_data`:
- `anti_hallucination_rules`: O que NUNCA afirmar, NUNCA misturar, SEMPRE exigir, SEMPRE explicar
- `required_products`: Lista de resinas e equipamentos compativeis (17 itens)
- `prohibited_products`: Lista de produtos que NAO devem ser associados (26 itens)
- `competitor_comparison`: Tabela comparativa vs Elegoo Mars 5 Ultra e Phrozen Sonic Mighty
- `print_times`: Tempos de impressao por tipo de peca (facetas 12min, coroas 17min, etc.)
- `platforms`: Specs das 2 plataformas (MiniVat e Normal)

**1b. Resina Bio Vitality** - Adicionar ao `extra_data`:
- `anti_hallucination_rules`
- `required_products` (12 itens)
- `prohibited_products` (7 itens)
- `competitor_comparison`: Tabela de resistencia flexural vs 7 concorrentes
- `mechanical_specs`: 147 MPa, 5.49 GPa, Shore D >92, carga 59.3%
- `youtube_videos`: 5 URLs de videos

**1c. NanoClean PoD** - Ja foi parcialmente enriquecido anteriormente. Complementar com:
- `anti_hallucination_rules`
- `required_products`
- `prohibited_products`
- `competitor_comparison` (dados da tabela comparativa de lavagem)

### Camada 2: Ingerir em `company_kb_texts` (5 entradas segmentadas)

Usando a edge function `ingest-knowledge-text` para criar chunks vetoriais:

| Titulo | Categoria | Conteudo |
|--------|-----------|----------|
| `SPIN Competitive Edge - Pitch e Jornada` | `comercial` | Pitch de vendas + Jornada SPIN (Desejo/Dor/Resultado) + metricas de dor (ROI 12 meses, economia R$1.800/mes, etc.) |
| `SPIN Competitive Edge - FAQs SDR` | `sdr` | As 10 perguntas SDR com respostas completas (objecoes de preco, implementacao, ROI, suporte) |
| `SPIN Competitive Edge - WhatsApp e Abordagem` | `comercial` | Template WhatsApp + storytelling + video principal |
| `Edge Mini + Vitality + NanoClean - Regras Anti-Alucinacao` | `geral` | Compilado das regras anti-alucinacao dos 3 produtos (o que NUNCA dizer, o que SEMPRE explicar) |
| `Depoimentos Clientes - Prova Social Consolidada` | `comercial` | Resumo dos ~30 depoimentos mais relevantes (com nome, cidade, especialidade e frase-chave), NAO os 200+ transcritos brutos |

### Camada 3: NAO ingerir (dados descartados)

- **Depoimentos duplicados**: O documento contem cada depoimento 2x (duplicatas). Sera deduplificado.
- **Transcritos brutos longos**: Os 200+ depoimentos raw sao muito extensos e repetitivos para chunks vetoriais. Sera feito um resumo curado com os 30 mais impactantes.
- **Listas de imagens CDN**: URLs de imagens de produto nao agregam valor ao RAG textual.

## Implementacao Tecnica

### Passo 1: SQL - Enriquecer `extra_data` dos 3 produtos

Executar 3 UPDATEs no `system_a_catalog` via migration:

```sql
-- 1a. Edge Mini
UPDATE system_a_catalog
SET extra_data = extra_data || '{
  "anti_hallucination": { ... },
  "required_products": [...],
  "prohibited_products": [...],
  "competitor_comparison": { ... },
  "print_times": { ... }
}'::jsonb
WHERE slug ILIKE '%edge-mini%' OR name ILIKE '%Edge Mini%';

-- 1b. Bio Vitality
UPDATE system_a_catalog
SET extra_data = extra_data || '{...}'::jsonb
WHERE name ILIKE '%Vitality%';

-- 1c. NanoClean PoD (complemento)
UPDATE system_a_catalog
SET extra_data = extra_data || '{...}'::jsonb
WHERE id = '19bc59de-a1f0-4994-b5ab-4c1a2464b7e0';
```

### Passo 2: Chamar `ingest-knowledge-text` com as 5 entradas

Usar a edge function existente para criar os 5 registros em `company_kb_texts` e gerar embeddings automaticamente. Cada entrada sera chunked em ~900 chars com 150 overlap.

### Passo 3: Nenhuma alteracao em codigo

Nao ha necessidade de alterar a edge function `dra-lia/index.ts`. As melhorias de RAG ja implementadas (augmentacao de query com historico, fallback `searchCompanyKB`, catalogo expandido) ja cobrirao esses novos dados automaticamente.

## Resultado Esperado

Apos a ingestao, a L.I.A. sera capaz de:

1. Responder perguntas sobre especificacoes tecnicas dos 3 produtos com dados anti-alucinacao
2. Fazer comparativos com concorrentes usando dados reais (tabelas)
3. Citar depoimentos de clientes por nome/cidade como prova social
4. Conduzir conversas SDR usando o pitch SPIN e responder as 10 objecoes mais comuns
5. Recomendar produtos complementares e alertar sobre produtos incompativeis
6. Nunca misturar categorias de produto (ex: resina composta direta vs resina 3D)

