

## Problema: LIA afirma que resina concorrente e "parceira"

### Diagnostico

A LIA disse **"A VoxelPrint e uma de nossas resinas parceiras"** — isso e uma alucinacao grave. A VoxelPrint nao existe no banco de dados (todas as resinas ativas sao `manufacturer = 'Smart Dent'`). A LIA inventou que era parceira porque:

1. **Lista de concorrentes incompleta** (linha 1207): so tem `["formlabs", "nextdent", "keystone", "bego", "detax", "gc", "dentsply"]` — faltam dezenas de marcas como VoxelPrint, SprintRay, Anycubic resins, etc.
2. **Nenhuma regra no system prompt** que diga: "Se o usuario mencionar uma resina que NAO esta nos dados das fontes, NAO afirme que e parceira/nossa. Diga que nao temos dados sobre ela."
3. A LIA assume que qualquer resina mencionada e do portfolio SmartDent se nao esta na lista de concorrentes.

### Correcao — 2 entregas

#### 1. Expandir lista de concorrentes e adicionar regra de "resina desconhecida"

**Arquivo**: `supabase/functions/dra-lia/index.ts`

**Linha 1207** — Expandir a lista `concorrentes` para incluir marcas conhecidas do mercado:
```
const concorrentes = [
  "formlabs", "nextdent", "keystone", "bego", "detax", "gc", "dentsply",
  "voxelprint", "voxel print", "sprintray", "dentca", "asiga", "ackuretta",
  "graphy", "desktop health", "liqcreate", "shining3d", "uniz", "stratasys",
  "envisiontec", "saremco", "kulzer"
];
```

#### 2. Adicionar regra anti-alucinacao no system prompt

**Arquivo**: `supabase/functions/dra-lia/index.ts` (system prompt, apos a regra 23)

Adicionar regra **25**:
```
25. RESINAS/PRODUTOS DESCONHECIDOS:
    Se o usuario mencionar uma resina, produto ou marca que NAO aparece nos DADOS DAS FONTES,
    NUNCA afirme que e "parceira", "do nosso portfolio" ou "nossa resina".
    Responda: "Nao temos dados da [nome] no nosso sistema. 
    Posso te ajudar com as resinas do portfolio SmartDent — temos opcoes para [aplicacao mencionada]. 
    Quer que eu te mostre?"
    PROIBIDO inventar que um produto externo faz parte do portfolio da SmartDent.
```

### Resumo de arquivos

| # | Arquivo | Acao |
|---|---------|------|
| 1 | `supabase/functions/dra-lia/index.ts` | Expandir lista de concorrentes (linha 1207) + nova regra 25 no system prompt |

