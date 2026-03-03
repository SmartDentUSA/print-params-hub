

## Plano: Corrigir alucinação de nomes no briefing HISTÓRICO/OPORTUNIDADE

### Problema
A função `generateHistoricoOportunidade` em `smart-ops-lia-assign/index.ts` (linha 542-602) envia o nome correto do lead no prompt, mas o LLM retorna um nome inventado (ex: "Thiago" em vez de "Danilo"). Causa: o system prompt é genérico demais ("Retorne APENAS JSON válido") e não proíbe inventar dados.

### Solução

**Arquivo:** `supabase/functions/smart-ops-lia-assign/index.ts`

**1. Reforçar system prompt (linha 582)**

Trocar:
```
"Retorne APENAS JSON válido. Sem markdown."
```
Por:
```
"Retorne APENAS JSON válido. Sem markdown. Use EXCLUSIVAMENTE os dados fornecidos. NÃO invente nomes, datas ou valores que não estejam nos DADOS. Refira-se ao lead como 'o profissional' ou 'o lead', NUNCA use nomes próprios no texto gerado."
```

**2. Adicionar instrução obrigatória no prompt do usuário (linha 548-568)**

Adicionar antes da linha de retorno JSON:
```
REGRAS:
1. NÃO use o nome do lead no texto — diga "o profissional" ou "o lead"
2. Se um dado é "N/A" ou "Nunca", diga "sem informação disponível"
3. NÃO invente dados que não estejam listados acima
```

**3. Validação pós-geração (após linha 597)**

Após o `JSON.parse`, sanitizar removendo qualquer nome próprio que não seja de produtos/marcas conhecidas:
```typescript
const leadNome = String(lead.nome || "").split(" ")[0];
// Replace any accidental name usage with "o profissional"
if (parsed.historico) {
  parsed.historico = parsed.historico.replace(
    new RegExp(`\\b${leadNome}\\b`, "gi"), "o profissional"
  );
}
if (parsed.oportunidade) {
  parsed.oportunidade = parsed.oportunidade.replace(
    new RegExp(`\\b${leadNome}\\b`, "gi"), "o profissional"
  );
}
```

### Resultado esperado

| Antes | Depois |
|---|---|
| "*HISTÓRICO:* **Thiago** realizou o primeiro contato..." | "*HISTÓRICO:* **O profissional** realizou o primeiro contato..." |
| Nome alucinado pela IA | Referência impessoal, nome real já aparece no cabeçalho fixo do briefing |

O cabeçalho fixo do briefing (linhas 498-512) já contém `👤 ${lead.nome}`, então o vendedor vê o nome correto no topo. A seção HISTÓRICO/OPORTUNIDADE fica segura contra troca de nomes.

