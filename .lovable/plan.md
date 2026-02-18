
# Dra. L.I.A. — Respostas Mais Assertivas + Parâmetros Apenas Sob Demanda

## Problema Identificado

O system prompt atual tem duas regras problemáticas:

```
REGRA 3 (atual): "Ao encontrar PARÂMETROS: apresente em formato legível com os valores exatos"
REGRA 6 (atual): "Tom: especialista empática, clara e didática — nunca robótica"
```

A Regra 3 instrui o modelo a **sempre exibir parâmetros** quando os encontra nos chunks — independente da pergunta do usuário. Se o usuário pergunta "o NanoClean é bom para uso em clínica?" e o RAG retorna chunks com parâmetros, o Gemini joga todos os valores técnicos na resposta.

O tom "empática e didática" também tende a gerar respostas longas e prolixas.

---

## O Que Será Alterado

Apenas 1 arquivo: `supabase/functions/dra-lia/index.ts`

Alterações no system prompt (linhas 276–297):

### Regra 3 — Parâmetros (mudança crítica)

**Antes:**
```
3. Ao encontrar PARÂMETROS: apresente em formato legível com os valores exatos
```

**Depois:**
```
3. PARÂMETROS DE IMPRESSÃO: só apresente valores técnicos (tempo de exposição, layer height, etc.)
   quando o usuário EXPLICITAMENTE pedir. Palavras-chave que indicam pedido explícito:
   "parâmetro", "configuração", "setting", "tempo", "exposição", "layer", "espessura",
   "velocidade", "how to print", "cómo imprimir", "como imprimir", "valores".
   Caso contrário, use os dados de parâmetros apenas para confirmar compatibilidade
   (ex: "Sim, o NanoClean é compatível com a Phrozen Sonic Mini 4K") sem listar os valores.
```

### Regras de Tom (mudança de assertividade)

**Antes (Regra 6):**
```
6. Tom: especialista empática, clara e didática — nunca robótica
```

**Depois:**
```
6. Tom: direto, assertivo e confiante — responda em 2-4 frases quando possível.
   Evite introduções longas como "Claro!", "Com certeza!", "Ótima pergunta!".
   Vá direto ao ponto da resposta.
```

### Nova Regra de Brevidade (adicionada)

```
11. Brevidade: prefira respostas curtas e precisas. Só detalhe quando o usuário pedir
    mais informações ou quando a pergunta for claramente técnica e detalhada.
```

### Ajuste na Regra 9

**Antes:**
```
9. Se houver múltiplos resultados relevantes, mencione os melhores 2-3, não todos
```

**Depois:**
```
9. Se houver múltiplos resultados relevantes, mencione o mais relevante primeiro.
   Ofereça os demais apenas se fizer sentido contextual ("Também encontrei um vídeo sobre...").
```

---

## Arquivo Modificado

| Arquivo | Linhas alteradas |
|---|---|
| `supabase/functions/dra-lia/index.ts` | Linhas 282–291 (system prompt rules) |

---

## Comportamento Esperado Após a Mudança

### Pergunta: "O NanoClean é bom para clínica?"
**Antes:** Listava 5 parâmetros técnicos (exposure time, layer height, etc.) + descrição
**Depois:** "Sim, o NanoClean da Resinamax é uma resina biocompatível indicada para uso clínico, com boa resistência e acabamento. Quer ver os parâmetros de impressão recomendados?"

### Pergunta: "Qual o tempo de exposição do NanoClean na Phrozen?"
**Antes:** Mesma resposta prolixa com contexto desnecessário
**Depois:** "Para a Phrozen Sonic Mini 4K: **tempo de exposição base = 35s**, camadas normais = **2.5s**, altura de camada = **0.05mm**."

### Pergunta: "Tem vídeo sobre resinas biocompatíveis?"
**Antes:** Listava 3 vídeos com descrições longas + parâmetros adjacentes
**Depois:** "Sim! Encontrei este vídeo: **[▶ NanoClean - Aplicação Clínica](link)**. Quer que eu busque mais sobre o assunto?"

---

## Seção Técnica

A modificação é exclusivamente no system prompt da edge function. Não há mudanças no banco de dados, no widget React, nem nas rotas. Após a edição, o deploy da edge function `dra-lia` é necessário para que as mudanças entrem em produção.

O Gemini continuará recebendo os chunks com parâmetros no contexto — a mudança está na **instrução de como usá-los**: como fonte para confirmar compatibilidade, não para despejá-los automaticamente.
