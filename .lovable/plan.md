## 3 mudanças solicitadas

### 1. Substituir link de produto restante (banco)
Na varredura anterior atualizei apenas `knowledge_contents`. Ainda existem ocorrências do link antigo em outras tabelas:

- `system_a_catalog.cta_1_url` → **1 linha**
- `external_links.url` → **15 linhas**

Migration única que troca `https://loja.smartdent.com.br/pos-cura-pionext-uv-02` por `https://loja.smartdent.com.br/shapecure` apenas nessas linhas. Nada mais é tocado.

### 2. Fundo dos cards do Catálogo branco
Arquivo: `src/components/knowledge/KbTabCatalogo.tsx` (linha 395).

A área cinza que aparece atrás da seringa no print é o fundo do thumbnail do produto (`background: '#F6F8FB'`). Trocar para `#FFFFFF` para combinar com o fundo branco da maioria das fotos de produto.

- O resto do card já é branco (`.kb-card` em `kbStyles.ts` linha 75).
- O fallback colorido (quando o produto não tem imagem) **não muda** — continua com gradiente da categoria, senão fica um quadrado branco vazio.

### 3. Página Agenda Pública — exibir "Restam X vagas" inline
Arquivo: `src/pages/AgendaPublica.tsx` (linhas 521–544).

Hoje o card mostra 3 métricas (Vagas | Participantes | Acompanhantes) e abaixo, em texto separado, "Restam apenas X vagas" só quando `restam ≤ 5`.

Mudança:
- Transformar em **grid de 4 colunas**: `Vagas | Participantes | Acompanhantes | Restam`.
- A 4ª métrica mostra sempre o número de vagas restantes (`slots - enrolled_count`), em cor:
  - vermelho quando `restam = 0` (mantém também o aviso "Turma lotada" abaixo).
  - âmbar quando `restam ≤ 5`.
  - cor padrão acima disso.
- Remover o texto "Restam apenas X vagas" duplicado (mantém só "Turma lotada" quando aplicável).

### Fora de escopo
Não vou mexer em fluxo de inscrição, contagem de acompanhantes, RLS ou outros componentes (TurmaCard admin, etc.).
