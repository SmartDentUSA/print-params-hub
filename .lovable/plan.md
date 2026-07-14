## Normalizar nome do produto

Substituir toda variação visível do nome do produto pelo padrão canônico **"Impressora 3D Rayshape Edge Mini"** nos componentes de UI, sem alterar dados ou lógica.

### Alterações

**`src/components/SmartOpsRayshape.tsx`**
- Linha 216: `Rayshape — Donos Edge Mini` → `Impressora 3D Rayshape Edge Mini — Donos`
- Linha 350: `Adicionar dono Rayshape Edge Mini` → `Adicionar dono — Impressora 3D Rayshape Edge Mini`

**`src/components/smartops/RayshapePanel.tsx`** (card no perfil do lead)
- Linha 205: `Sem Rayshape Edge Mini` → `Sem Impressora 3D Rayshape Edge Mini`
- Linha 228: `Rayshape Edge Mini` → `Impressora 3D Rayshape Edge Mini`
- Linha 324: `🖨️ Rayshape Edge Mini` → `🖨️ Impressora 3D Rayshape Edge Mini`

**`src/components/TestimonialSEOHead.tsx`**
- Linha 58 (JSON-LD): `Impressora RayShape Edge mini` → `Impressora 3D Rayshape Edge Mini`

### Fora do escopo
- Não altero `Itens da proposta` no banco (dados brutos do CRM).
- Não mexo em variáveis internas, filtros SQL (`ILIKE '%Edge Mini%'`) ou nomes de arquivos.
