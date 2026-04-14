
## Tornar categoria E visível na Base de Conhecimento

### Problema
A categoria **E • Depoimentos e Cursos** está com `enabled = false` no banco, por isso não aparece nos pills de navegação.

### Solução
Criar uma migration SQL para atualizar `enabled = true` na categoria E da tabela `knowledge_categories`.

### Mudança

**Nova migration SQL**:
```sql
UPDATE knowledge_categories SET enabled = true WHERE letter = 'E';
```

Uma única linha. Nenhuma mudança de código frontend necessária — o filtro `cats.filter(c => c.enabled)` já vai incluí-la automaticamente.
