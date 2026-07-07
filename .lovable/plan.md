## Diagnóstico

Para o produto **Ativação DentalCAD Ultimate Lab Bundle - RMS** os dois short links já existem no banco:

- `hxssbk` → `default_target = 'landing_page'`
- `fwr5e6` → `default_target = 'form'`

E o formulário `exocad_dentalcad_rms` está corretamente vinculado ao produto via `smartops_forms.product_catalog_id`.

O motivo dos botões não aparecerem é que **as tabelas `smartops_forms` e `smartops_short_links` não possuem `GRANT SELECT` para os roles `anon` e `authenticated`**. Suas policies RLS liberam leitura pública, mas sem o GRANT o PostgREST retorna vazio silenciosamente — o front recebe zero linhas e nenhum botão é renderizado.

## Correção

Migration curta apenas com grants:

```sql
GRANT SELECT ON public.smartops_forms TO anon, authenticated;
GRANT SELECT ON public.smartops_short_links TO anon, authenticated;
```

## Fora do escopo

- Não altera policies RLS existentes.
- Não muda o código da `ProductPage`.
- Não toca em nenhuma outra tabela.
