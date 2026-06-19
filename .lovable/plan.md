Apagar 3 publicações da categoria G (Catálogo de Produtos) na tabela `knowledge_contents` via `supabase--insert` (DELETE):

| Slug | ID |
|---|---|
| tudo-sobre-smart-print-bio-vitality-resina-3d-fda-restauracoes-definitivas | 9d2b76ee-8a5b-4a35-94e4-2e774aa50bdc |
| tudo-sobre-fda-510k-k260152-aprovacao-smart-dent-restauracoes-definitivas | 10d41669-78bc-4e6e-aff2-c8d35e6f34a7 |
| tudo-sobre-chairside-print-restauracao-definitiva-consultorio-uma-sessao | d89b3f4e-c616-4446-904a-1fc65c888041 |

SQL único:
```sql
DELETE FROM knowledge_contents WHERE id IN (
  '9d2b76ee-8a5b-4a35-94e4-2e774aa50bdc',
  '10d41669-78bc-4e6e-aff2-c8d35e6f34a7',
  'd89b3f4e-c616-4446-904a-1fc65c888041'
);
```

Sem alterações de código. Os artigos canônicos originais (`smart-print-bio-vitality-resina-3d-fda-para-restauracoes` em C, `fda-510k-k260152-smart-dent-aprovacao-mercado-americano` em C, e `fda-510k-clearance-k260152-smart-print-bio-vitality` em B) permanecem intactos.