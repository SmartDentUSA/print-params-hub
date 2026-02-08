

## Plano: Limpar Titulos dos Videos de Depoimentos

### Escopo
Atualizar os titulos de **54 videos** no banco de dados que seguem o padrao `XXX Depoimento - Nome.mp4`, mantendo apenas o nome da pessoa.

### Transformacao

| Antes | Depois |
|-------|--------|
| `152 Depoimento - Dielson e Viviane.mp4` | `Dielson e Viviane` |
| `153 Depoimento - Hugo.mp4` | `Hugo` |
| `165 Depoimento - Najila da Silva.mp4` | `Najila da Silva` |
| `200 Depoimento - Renato.mp4` | `Renato` |

### Implementacao

Uma unica operacao de UPDATE no banco de dados:

```sql
UPDATE knowledge_videos
SET title = TRIM(BOTH FROM regexp_replace(
    regexp_replace(title, '\.mp4$', '', 'i'),
    '^.*Depoimento\s*-\s*', '', 'i'
  ))
WHERE title ~* 'Depoimento'
  AND video_type = 'pandavideo';
```

**Logica do SQL:**
1. Remove a extensao `.mp4` do final
2. Remove tudo antes e incluindo `Depoimento -` (numero, palavra "Depoimento", hifen)
3. Aplica TRIM para remover espacos extras

### Impacto
- **54 videos** serao atualizados
- Nenhuma alteracao em codigo (apenas dados no banco)
- Os titulos atualizados refletirao automaticamente na lista de videos do admin
