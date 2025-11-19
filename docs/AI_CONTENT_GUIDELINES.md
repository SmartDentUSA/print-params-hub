# Diretrizes para Geração de Conteúdo com IA

## 📋 Objetivo

Este documento estabelece as melhores práticas para geração de conteúdo otimizado para SEO e Schema.org, garantindo que artigos gerados por IA sejam automaticamente detectados pelos extratores de schema implementados no sistema.

---

## 🎯 HowTo Schema - Boas Práticas

### ✅ Formato RECOMENDADO (Lista Ordenada)

**Use listas ordenadas HTML** para garantir 100% de compatibilidade:

```html
<h2>Protocolo de Uso</h2>
<ol>
  <li><strong>Passo 1: Preparo</strong> - Realize condicionamento ácido por 15 segundos usando gel de ácido fosfórico a 37%</li>
  <li><strong>Passo 2: Aplicação</strong> - Aplique o material diretamente na superfície preparada, utilizando uma camada uniforme</li>
  <li><strong>Passo 3: Fotopolimerização</strong> - Fotopolimerize por 20 segundos com luz LED de 1200 mW/cm²</li>
</ol>
```

**Vantagens:**
- ✅ Detectado automaticamente pelo extrator
- ✅ Semântica HTML correta
- ✅ Melhor acessibilidade
- ✅ Rich snippets no Google

---

### ⚠️ Formato ALTERNATIVO (Headings Numerados)

**Use quando não for possível usar listas ordenadas:**

```html
<h2>Protocolo de Uso</h2>

<h3>Passo 1: Preparo do Esmalte</h3>
<p>Realize o condicionamento ácido usando gel de ácido fosfórico a 37% por 15 segundos. Lave abundantemente com água por 30 segundos.</p>

<h3>Passo 2: Aplicação do Material</h3>
<p>Aplique o adesivo diretamente na superfície do bráquete utilizando o pincel aplicador. Não é necessário usar adesivo dental adicional.</p>
```

**Vantagens:**
- ✅ Detectado pelo extrator (fallback)
- ✅ Boa estrutura hierárquica
- ⚠️ Menos semântico que `<ol>`

---

### ❌ Formato a EVITAR (Tabelas)

**NÃO use tabelas para passos procedimentais:**

```html
<!-- ❌ EVITE ESTE FORMATO -->
<table>
  <tr>
    <td>Passo 1</td>
    <td>Preparo do esmalte</td>
  </tr>
  <tr>
    <td>Passo 2</td>
    <td>Aplicação do material</td>
  </tr>
</table>
```

**Problemas:**
- ⚠️ Baixa prioridade de detecção (fallback terciário)
- ⚠️ Semântica incorreta (tabelas são para dados tabulares)
- ⚠️ Dificulta acessibilidade
- ⚠️ Menos reconhecido por bots

**Use tabelas APENAS para dados comparativos** (ex: composição química, especificações técnicas).

---

## 🎯 FAQPage Schema - Boas Práticas

### ✅ Formato RECOMENDADO (Headings com "?")

```html
<h2>Perguntas Frequentes</h2>

<h3>O que é o monômero MDP e por que é considerado padrão ouro?</h3>
<p>O MDP (10-metacriloiloxidecil di-hidrogênio fosfato) é um monômero adesivo que forma ligações químicas com a hidroxiapatita do esmalte e dentina. Estudos mostram que aumenta a resistência adesiva em até 40% em relação a sistemas convencionais.</p>

<h3>Qual a resistência ao cisalhamento deste material?</h3>
<p>Testes realizados na FOP-UNICAMP (2021) demonstraram resistência média de 18,5 MPa, estatisticamente similar ao Transbond XT (3M), que é considerado padrão ouro na ortodontia.</p>
```

**Diretrizes:**
- ✅ Sempre use headings (`<h2>`, `<h3>`, `<h4>`) para perguntas
- ✅ Perguntas devem terminar com "?"
- ✅ Inclua palavras interrogativas: "Como", "Qual", "Quando", "Por que", etc.
- ✅ Respostas em parágrafos ou listas logo após o heading
- ✅ Mantenha respostas concisas (máx 500 caracteres para rich snippets)
- ✅ **Inclua dados científicos quando disponível** (testes, normas ISO, estudos)

---

## 🎯 Prompt Genérico para IA - Template Otimizado

### Estrutura do Prompt

```markdown
**PAPEL E OBJETIVO:**
Você é um Copywriter Sênior especializado em SEO Técnico e Conteúdo Científico Odontológico.

**FORMATO DE SAÍDA OBRIGATÓRIO:**

## 1. [TÍTULO DO ARTIGO]
* Headline forte com nome do produto e principal benefício
* 2-3 parágrafos introdutórios apresentando o produto

## 2. Composição e Tecnologia
* Detalhamento da composição-chave
* **Incluir tabela de composição em Markdown**

## 3. Indicações Clínicas
* Lista de usos e aplicações práticas

## 4. [SCHEMA HOWTO] Protocolo de Uso Otimizado
**IMPORTANTE: Use LISTA ORDENADA (<ol><li>) para garantir detecção automática de schema**

<ol>
  <li><strong>Passo 1: [Nome]</strong> - [Descrição detalhada com tempos/temperaturas]</li>
  <li><strong>Passo 2: [Nome]</strong> - [Descrição detalhada com proporções]</li>
</ol>

## 5. [SCHEMA FAQPage] Perguntas Frequentes
**IMPORTANTE: Use headings com "?" para garantir detecção automática**

### Pergunta 1 com interrogação?
Resposta citando dados de testes ou conclusões de especialistas.

### Pergunta 2 específica do produto?
Resposta técnica com referências científicas quando disponível.

## 6. Performance e Conclusão
* Integrar resultados de testes
* Citações de especialistas
* CTA (Call to Action)
```

---

## 🎯 Checklist de Validação Pós-Geração

Após gerar um artigo com IA, valide:

### HowTo Schema
- [ ] Passos estão em lista ordenada `<ol><li>` OU headings `<h3>Passo X</h3>`
- [ ] Cada passo inclui tempos, temperaturas ou proporções (quando aplicável)
- [ ] Mínimo de 3 passos, máximo de 10 passos
- [ ] Passos começam com "Passo N:" ou numeração explícita

### FAQPage Schema
- [ ] Perguntas em headings (`<h2>`, `<h3>`, `<h4>`)
- [ ] Todas as perguntas terminam com "?"
- [ ] Respostas em parágrafos logo após cada pergunta
- [ ] Mínimo de 3 FAQs, máximo de 15 FAQs
- [ ] Respostas incluem dados científicos quando disponível

### SEO Geral
- [ ] Título contém palavra-chave principal
- [ ] Meta description clara e informativa (máx 160 caracteres)
- [ ] Headings hierárquicos (H1 → H2 → H3)
- [ ] Imagens com alt text descritivo
- [ ] Links internos e externos relevantes

---

## 🎯 Ferramentas de Validação

Após publicação, valide o schema usando:

1. **Google Rich Results Test**: https://search.google.com/test/rich-results
2. **Schema.org Validator**: https://validator.schema.org/
3. **Ver código-fonte**: `Ctrl+U` e buscar por `<script type="application/ld+json">`

---

## 📊 Benefícios Esperados

### Com HowTo Schema otimizado:
- **+40% CTR** em resultados com rich snippets expandidos
- **+200% área ocupada** nos SERPs (snippets maiores)
- Melhor indexação por IA regenerativa (Perplexity, ChatGPT Search)

### Com FAQPage Schema otimizado:
- **+30% CTR** em snippets com FAQs expandidos
- Aparição em "People Also Ask" do Google
- Melhor posicionamento em pesquisas conversacionais

---

## 📝 Notas Finais

- **Priorize clareza sobre criatividade**: Bots precisam entender a estrutura
- **Use dados reais**: Nunca invente especificações ou resultados de testes
- **Siga o E-E-A-T**: Experience, Expertise, Authoritativeness, Trustworthiness
- **Teste sempre**: Valide o schema antes de publicar em produção

---

**Última atualização:** 2025-11-19  
**Responsável:** Equipe de Conteúdo e SEO  
**Versão:** 1.0
