

## Plano: Parsing e exibição estruturada de `itens_proposta_crm`

### O que muda

**Formato atual (string crua):**
`(1544) PRO 15012 [1.0000] ATOS Resina Comp Direta 4g - BL2, PRO 15012 [1.0000] ATOS RESINA...`

**Formato novo (estruturado conforme imagem):**
- **Campo 1 — N. Proposta:** `(1544) PRO 15012`
- **Campo 2 — Itens da Proposta (tabela):**

```text
   Quant. | Item
   1      | ATOS Resina Comp Direta 4g - BL2
   1      | ATOS RESINA COMP. DIRETA TRAN.CLEAR 2
   1      | ATOS RESINA COMP. DIRETA XWE 4G
   1      | ATOS RESINA COMP.DIRETA OPALE.OPL 2G
```

### Implementação

#### 1. Criar função `parseItensProposta(raw: string)` (inline em `SmartOpsLeadsList.tsx`)
- Regex extrai número da proposta: `(?:\((\d+)\)\s*)?(PRO\s*\d+)` → ex: `(1544) PRO 15012`
- Split itens por `, PRO` ou `, (`
- Para cada item: extrair qty de `[X.XXXX]` → arredondar para inteiro, restante = nome do item

#### 2. Substituir campo na seção "Oportunidade" do Dialog (`SmartOpsLeadsList.tsx`, linha 669)
- Remover `{ label: "Itens Proposta", value: ... }` da lista de fields
- Após o `<DetailSection>` de Oportunidade, renderizar componente customizado `ProposalItemsDisplay` que mostra:
  - Linha bold: **N. Proposta:** `(1544) PRO 15012`
  - Mini-tabela com header Quant. | Item e cada item em linha separada

#### 3. Atualizar badge no Kanban (`SmartOpsKanban.tsx`, linhas 209-211)
- Substituir o badge que mostra o texto completo por badge resumido: `📋 PRO 15012` (apenas número da proposta extraído)

### Arquivos modificados
- `src/components/SmartOpsLeadsList.tsx`
- `src/components/SmartOpsKanban.tsx`

