

## Plano: Tornar categorias e produtos visíveis no catálogo público

### Causa raiz
Quando implementamos o filtro `.eq("visible_in_ui", true)` na query do catálogo, **127 de 128 produtos** tinham `visible_in_ui = false`. Por isso só aparece RESINAS 3D (que vem da tabela `resins`, sem esse filtro).

### Solução

#### 1. Migração SQL — ativar `visible_in_ui` para todos os produtos aprovados
Criar uma migration que faz:
```sql
UPDATE system_a_catalog 
SET visible_in_ui = true 
WHERE active = true AND approved = true;
```
Isso torna todos os produtos ativos/aprovados visíveis por padrão. O admin pode depois ocultar individualmente pelo checkbox.

#### 2. Nenhuma alteração no frontend
O código já está correto — sidebar de categorias, grid de produtos, filtro `visible_in_ui`. Só faltavam os dados marcados como visíveis.

### Arquivo afetado
- **Nova migration SQL**: `UPDATE system_a_catalog SET visible_in_ui = true WHERE active AND approved`

