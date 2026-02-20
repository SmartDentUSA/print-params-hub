
# Implementação: SDR Consultivo para a Rota Comercial

## Estado atual confirmado no código

**Linha 1384** do arquivo `supabase/functions/dra-lia/index.ts`:

```typescript
topic_context === "commercial"
  ? "\nINSTRUÇÃO ADICIONAL COMERCIAL: Priorize dados de contato, loja, preços e parcerias. Não sugira fluxos de parâmetros técnicos espontaneamente."
  : ""
```

Esta é uma instrução de 1 linha sem estrutura de qualificação. Será substituída pela instrução SDR completa.

**Infraestrutura já presente (da implementação anterior):**
- `TOPIC_WEIGHTS` → linhas 14–23 ✅
- `applyTopicWeights` → linhas 25–34 ✅
- `topic_context === "commercial"` detectado → linha 1384 ✅

---

## Arquivo modificado: `supabase/functions/dra-lia/index.ts`

### Mudança 1 — Constante `SDR_COMMERCIAL_INSTRUCTION` (após linha 34)

Inserir logo após a função `applyTopicWeights`, antes de `const CHAT_API`:

```typescript
// ── SDR Consultivo — injetado quando topic_context === "commercial" ─────────
const SDR_COMMERCIAL_INSTRUCTION = `

### 🧑‍💼 MODO SDR CONSULTIVO ATIVO — ROTA COMERCIAL

**PERSONALIDADE E MISSÃO:**
Você é uma Consultora Estratégica da Smart Dent. Sua missão não é vender produtos isolados, mas sim diagnosticar o estágio atual do dentista no Workflow Odontológico Digital para oferecer a solução que maximize o seu ROI. Seja técnica, empática e orientada a sistemas.

**DIRETRIZES DE QUALIFICAÇÃO — WORKFLOW DIGITAL:**
Antes de apresentar preços ou links, identifique em qual etapa o cliente se encontra ou deseja chegar:
1. Scanear — Captura digital (Scanners Intraorais)
2. Desenhar — Planeamento CAD (Software exocad)
3. Imprimir — Fabricação (Impressoras 3D e Resinas)
4. Processar — Pós-processamento (Lavagem e Cura)
5. Finalizar — Acabamento (Caracterização e Polimento)
6. Instalar — Cimentação e finalização clínica

**REGRAS DE CONDUTA SDR:**
- Diagnóstico Primeiro: Se o usuário perguntar por produto de alta complexidade (Scanners ou Impressoras), responda: "Para eu ser mais assertiva na recomendação técnica: o senhor já atua com fluxo digital ou está a planear a montagem do seu primeiro centro de impressão?"
- Alta Complexidade (Hardware/Combos): Objetivo = AGENDAMENTO. Venda a importância de uma demonstração técnica com especialista.
- Baixa Complexidade (Resinas/Insumos): Objetivo = E-COMMERCE. Forneça o link direto para a categoria na Loja Smart Dent.
- Autoridade: Use NPS 96 e pioneirismo desde 2009 para validar que a Smart Dent é a escolha mais segura.

**CATEGORIAS DE DIRECIONAMENTO:**
- Clínico que quer autonomia total → Chair Side Print
- Dono de laboratório → Smart Lab
- Dúvidas sobre materiais → distinção entre Resinas Biocompatíveis e Uso Geral

**SCRIPTS DE SONDAGEM:**
- "Dr(a)., percebi o seu interesse na [Impressora/Scanner]. Como este equipamento altera o tempo de entrega e a precisão do trabalho, o ideal seria ver o sistema com os seus casos reais. Faz sentido agendarmos uma apresentação online de 15 minutos?"
- "Como o senhor já domina a etapa de Scanear, a etapa de Imprimir in-office vai reduzir os custos laboratoriais em até 70%. Quer que eu envie os cálculos de ROI para a sua especialidade?"

**PROIBIÇÕES NA ROTA COMERCIAL:**
- NUNCA responda "Não sei" para questões comerciais — use o fallback de WhatsApp.
- NÃO inicie o diálogo de parâmetros de impressão (tempos de cura/exposição) espontaneamente. Mantenha o foco em benefícios, processos e negócios.
- Para Scanners e Impressoras: peça o contato ou ofereça agendamento.
- Para Resinas e Insumos: envie o link da loja.
`;
```

**Por que como constante de módulo:** Mantém o builder do `systemPrompt` limpo e legível, e permite reutilização ou log futuro sem alterar a lógica de montagem.

---

### Mudança 2 — Substituir a instrução inline na linha 1384

**Antes:**
```typescript
topic_context === "commercial"
  ? "\nINSTRUÇÃO ADICIONAL COMERCIAL: Priorize dados de contato, loja, preços e parcerias. Não sugira fluxos de parâmetros técnicos espontaneamente."
  : ""
```

**Depois:**
```typescript
topic_context === "commercial" ? SDR_COMMERCIAL_INSTRUCTION : ""
```

A estrutura do `topicInstruction` (o cabeçalho com `CONTEXTO DECLARADO PELO USUÁRIO`) permanece inalterada. A única mudança é o que é concatenado quando `topic_context === "commercial"`.

---

## Sinergia com a implementação anterior de re-ranking

As duas camadas funcionam em conjunto:

| Camada | Função | Efeito na rota Comercial |
|---|---|---|
| `TOPIC_WEIGHTS` (Cérebro) | Reorganiza o RAG: `company_kb` sobe 2.0x | Dados de NPS, contato e autoridade chegam no topo do contexto LLM |
| `SDR_COMMERCIAL_INSTRUCTION` (Voz) | Instrui o LLM sobre como usar esses dados | Transforma a resposta de informativa em consultiva e orientada a conversão |

---

## Impacto por cenário

| Pergunta na Rota Comercial | Antes | Depois |
|---|---|---|
| "Quanto custa o scanner Medit?" | Dados técnicos + preço | Diagnóstico de workflow → proposta de demonstração |
| "Vocês têm resina para modelo?" | Mix de dados | Link direto ao e-commerce (baixa complexidade) |
| "Qual o NPS de vocês?" | Número isolado | NPS 96 + pioneirismo 2009 como argumento de autoridade |
| "Tempo de cura da Vitality?" | Tabela técnica | Foco em benefícios; parâmetros só se insistência explícita |

---

## Notas técnicas

- **Zero alteração no banco** — nenhuma migration SQL
- **Zero alteração no frontend** — `topic_context` já chega corretamente
- **Backward compatible** — outras rotas (`parameters`, `products`, `support`) não são afetadas
- **Sem risco de truncamento** — a instrução SDR tem ~700 tokens e será posicionada dentro do `topicInstruction`, que é das primeiras seções do `systemPrompt`
- **Deploy automático** após salvar o arquivo

## Resumo — 1 arquivo, 2 intervenções

| Intervenção | Localização |
|---|---|
| Constante `SDR_COMMERCIAL_INSTRUCTION` | Após linha 34 (após `applyTopicWeights`) |
| Substituição da string inline por `SDR_COMMERCIAL_INSTRUCTION` | Linha 1384 |
