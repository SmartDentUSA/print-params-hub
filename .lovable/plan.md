
# Plano: Alimentar a Dra. L.I.A. com o Playbook da Rayshape Edge Mini

## Analise do Playbook

O JSON/TXT enviado contem um playbook extremamente rico com:
- Dados basicos do produto (preco, specs, dimensoes)
- Pitch de vendas e argumentacao comercial
- Especificacoes tecnicas detalhadas (resolucao 34.4 um, plataformas, tempos de impressao)
- Tabela comparativa vs concorrentes (Elegoo Mars 5 Ultra, Phrozen Sonic Mighty REVO 14K)
- Workflow odontologico digital (etapas de impressao, pos-cura, acabamento)
- Clinical Brain (produtos obrigatorios, produtos proibidos, regras anti-alucinacao)
- 10+ FAQs com respostas prontas
- 13 videos (YouTube + Instagram) com legendas e analises
- Reviews de clientes (50+ avaliacoes 5 estrelas)
- Conteudo de marketing (WhatsApp, Instagram, TikTok, blog comercial e tecnico)

## Estado Atual no Banco de Dados

| Camada | Status |
|--------|--------|
| `system_a_catalog` (descricao, benefits, FAQ) | Parcialmente populado - tem descricao e benefits, mas falta specs, comparativo, clinical brain |
| `agent_embeddings` (RAG vetorial) | 3 chunks indexados (descricao, benefits, FAQ) - falta profundidade tecnica |
| `company_kb_texts` (Brain Feeder) | Sem entrada dedicada ao produto - apenas referencias em dialogos arquivados |

## Estrategia de Populacao em 4 Camadas

### Camada 1: Atualizar `system_a_catalog.extra_data` (Dados Estruturados)
Enriquecer o campo `extra_data` JSONB do produto existente (id: `faa43292-9ceb-4441-afc5-4757e88fed3b`) com:
- `technical_specs`: array de specs do JSON (tecnologia, plataformas, resolucao, tempos)
- `competitor_comparison`: tabela comparativa Edge Mini vs Elegoo vs Phrozen
- `clinical_brain`: produtos obrigatorios, produtos proibidos, regras anti-alucinacao
- `workflow_stages`: etapas do workflow odontologico digital
- `objection_handling`: argumentacao para objecoes de preco/complexidade (extraida do pitch)

Isso garante que a LIA tenha dados estruturados para consultas diretas.

### Camada 2: Alimentar `company_kb_texts` via Brain Feeder (Conhecimento Curado)
Criar entradas curadas no Brain Feeder com conteudo de alta qualidade, segmentado por categoria:

| Titulo | Categoria | Conteudo |
|--------|-----------|----------|
| `Edge Mini — Ficha Tecnica Completa` | `comercial` | Specs + plataformas + tempos de impressao + resolucao |
| `Edge Mini — Pitch SDR e Argumentacao Comercial` | `sdr` | Sales pitch + USPs + argumentacao de objecoes |
| `Edge Mini — Comparativo Concorrentes` | `comercial` | Tabela comparativa detalhada vs Elegoo/Phrozen |
| `Edge Mini — Workflow e Produtos Complementares` | `workflow` | Clinical Brain: produtos obrigatorios + workflow digital |
| `Edge Mini — FAQ Tecnico-Comercial` | `faq` | 10 FAQs estruturadas com respostas |

Cada entrada sera automaticamente chunked (900 chars / 150 overlap) e indexada com embeddings no RAG.

### Camada 3: Re-indexar `agent_embeddings` (RAG Vetorial)
A indexacao sera feita automaticamente pelo `ingest-knowledge-text` ao criar as entradas da Camada 2. Alem disso, atualizar os chunks existentes de `catalog_product` com dados mais ricos (specs, comparativo).

### Camada 4: Atualizar `system_a_catalog` (Campos Diretos)
Atualizar campos de primeiro nivel:
- `description`: substituir pela descricao rica do playbook
- `meta_description`: SEO description otimizada
- `keywords`: keywords do playbook
- `promo_price`: R$ 28.500 (ja pode estar, confirmar)

## Detalhes Tecnicos

### Implementacao
1. **Edge Function**: Criar uma edge function `ingest-product-playbook` que:
   - Recebe o JSON do playbook
   - Extrai e organiza os dados por camada
   - Faz UPDATE no `system_a_catalog.extra_data`
   - Chama `ingest-knowledge-text` internamente para criar as entradas do Brain Feeder
   - Retorna um relatorio do que foi populado

2. **Alternativa (mais simples)**: Executar as operacoes diretamente:
   - SQL UPDATE para `system_a_catalog.extra_data`
   - Chamadas ao `ingest-knowledge-text` via edge function para o Brain Feeder
   - Isso pode ser feito com o codigo existente, sem nova edge function

### Formato do Conteudo para Brain Feeder
Cada texto sera formatado como narrativa estruturada (nao JSON bruto), otimizado para o RAG. Exemplo:

```
Rayshape Edge Mini — Ficha Tecnica
Tecnologia: MSLA (Masked Stereolithography Apparatus)
Resolucao XY: 34,4 um
Plataforma MiniVat: 74 x 64 x 100 mm (coroas, pontes)
Plataforma Normal: 130 x 80 x 100 mm (guias, alinhadores)
Tempos: Faceta 12min | Coroa 17min | 2 Placas 38min | 4 Guias 29min
Preco: R$ 35.000 (Promo: R$ 28.500)
```

### Seguranca Anti-Alucinacao
- Todos os dados serao extraidos LITERALMENTE do playbook
- Nenhuma informacao sera inventada ou inferida
- O Clinical Brain (produtos proibidos/obrigatorios) sera indexado para que a LIA saiba o que NAO recomendar junto
- Os tempos de impressao serao preservados com valores exatos

## Resultado Esperado

Apos a implementacao, a Dra. L.I.A. sera capaz de:
- Responder perguntas tecnicas (resolucao, plataformas, tempos) com dados precisos
- Fazer comparativos com concorrentes (Elegoo, Phrozen) sem inventar
- Recomendar produtos complementares corretos (resinas, pos-cura)
- NAO recomendar produtos proibidos (Atos Block, scanners concorrentes)
- Usar argumentacao SDR do pitch para conversas comerciais
- Citar FAQs prontas com respostas validadas

## Escopo Deste Plano (Somente Edge Mini)
Este plano cobre APENAS a Rayshape Edge Mini. O mesmo processo pode ser replicado para outros produtos conforme voce enviar os playbooks.
