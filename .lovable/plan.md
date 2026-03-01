

## Problemas Confirmados no Lead Rita

Dados do DB: `produto_interesse: "RayShape"`, `impressora_modelo: "Rayshape"`, `area_atuacao: "PLANNING CENTER"`, `especialidade: "RADIOLOGISTA"`.

Mensagem enviada: *"Olá Rita, aqui é a Patrica da **BLZ Dental**. Que ótimo saber do seu interesse no **RayShape** para o seu **PLANNING CENTER**, especialmente na área de **RADIOLOGISTA**."*

### 5 Problemas → 5 Correções

| # | Problema | Correção |
|---|----------|----------|
| 1 | "BLZ Dental" hardcoded (linhas 1638, 1653, 1701) | Trocar por **"Smart Dent"** |
| 2 | Produto genérico "RayShape" sem contexto | Combinar `produto_interesse` + `impressora_modelo` → "impressora 3D RayShape" |
| 3 | IA usou "PLANNING CENTER" e "RADIOLOGISTA" literalmente | Adicionar regra no prompt: "Use área/especialidade APENAS se forem termos odontológicos reais. Ignore dados genéricos ou incoerentes" |
| 4 | `temperature: 0.9` causa alucinações criativas | Reduzir para **0.6** |
| 5 | "Patrica" — typo no `team_members` | Informar usuário para corrigir no DB para "Patrícia Silva" |

### Alterações no arquivo `supabase/functions/dra-lia/index.ts`

**Linha 1638**: `"equipe BLZ Dental"` → `"equipe Smart Dent"`

**Linha 1641-1643**: Enriquecer contexto do produto:
```typescript
const produtoCtx = attendance.produto_interesse || "";
const impressoraCtx = attendance.impressora_modelo || "";
const resinaCtx = attendance.resina_interesse || "";
// Montar produto detalhado combinando campos
let produtoDetalhado = produtoCtx;
if (impressoraCtx && impressoraCtx.toLowerCase() !== produtoCtx.toLowerCase()) {
  produtoDetalhado = `${produtoCtx} (modelo ${impressoraCtx})`.trim();
}
if (resinaCtx) produtoDetalhado += `, resina ${resinaCtx}`;
```

**Linha 1653**: `BLZ Dental` → `Smart Dent`

**Linha 1657**: Usar `produtoDetalhado` no prompt

**Linhas 1661-1668**: Adicionar regras anti-alucinação:
```
8. Use área de atuação e especialidade SOMENTE se forem termos odontológicos reais (ex: Ortodontia, Prótese, Implantodontia). Se parecerem genéricos, inventados ou incoerentes, IGNORE-os completamente.
9. NÃO invente dados que não foram fornecidos acima.
```

**Linha 1680**: `temperature: 0.9` → `temperature: 0.6`

**Linha 1701**: `BLZ Dental` → `Smart Dent`

### Sobre o nome "Patrica"

O nome do vendedor está com typo na tabela `team_members` ("Patrica Silva" em vez de "Patrícia Silva"). Isso precisa ser corrigido diretamente no banco — não é um bug do código.

