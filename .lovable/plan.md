

## Plano: Rota 4 — Auxilio Suporte (5 botoes + novos campos sdr_)

### 1. Migration: 3 novos campos em `lia_attendances`

```sql
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_suporte_equipamento text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_suporte_tipo text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_suporte_descricao text;
```

- `sdr_suporte_equipamento`: qual botao o lead clicou (ESCANER INTRA ORAL / ESCANER DE BANCADA / IMPRESSORA 3D / NOTEBOOK / CHAMA ATENDENTE)
- `sdr_suporte_tipo`: tipo de suporte (tecnico, configuracao, etc — preenchido pela LIA)
- `sdr_suporte_descricao`: descricao do problema (preenchido pela LIA)

### 2. Frontend: Interceptar rota `support` no `DraLIA.tsx`

Quando o lead clica "Preciso de uma Mãozinha!" (id=support), em vez de ir direto para o chat:
- Mostrar 5 botoes de equipamento:
  - 🔍 Escâner Intra Oral
  - 🔬 Escâner de Bancada
  - 🖨️ Impressora 3D
  - 💻 Notebook
  - 👤 Chama Atendente

- Ao clicar num botao, salvar no `pendingSdrSelectionsRef` como `{ rota: 4, category: 'ESCANER INTRA ORAL' }` e enviar mensagem ao backend tipo "Preciso de suporte com Escâner Intra Oral"
- "Chama Atendente" dispara escalation direto

### 3. Backend: `dra-lia/index.ts`

Adicionar mapeamento para rota 4 no handler de `product_selections`:
```
rota === 4 → sdr_suporte_equipamento = ps.category
```

### 4. SmartOps UI: Exibir campos Rota 4

Adicionar na secao "Solucoes de interesse":
```
{ label: "🔴 Suporte Equipamento (Rota 4)", value: sdr_suporte_equipamento }
{ label: "🔴 Tipo Suporte", value: sdr_suporte_tipo }
{ label: "🔴 Descrição Suporte", value: sdr_suporte_descricao }
```

### Arquivos a editar

| # | Arquivo | Mudanca |
|---|---------|---------|
| 1 | Migration SQL | 3 novos campos `sdr_suporte_*` |
| 2 | `src/components/DraLIA.tsx` | Interceptar topic `support`, mostrar 5 botoes de equipamento, enviar `product_selections` com rota 4 |
| 3 | `supabase/functions/dra-lia/index.ts` | Adicionar `else if (ps.rota === 4)` no handler de sdr updates |
| 4 | `src/components/SmartOpsLeadsList.tsx` | Adicionar 3 campos 🔴 Rota 4 na secao Solucoes de interesse |

