create or replace function public.fn_smart_titlecase(txt text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  out_txt text := txt;
  m text;
  keep text[] := array[
    'SP','RJ','ES','MG','RS','SC','PR','BA','GO','DF','PE','CE','PA','AM','MT','MS',
    'RO','RR','AP','AC','TO','MA','PI','RN','PB','AL','SE',
    'CAD','CAM','STL','DLP','LCD','LED','NPS','SEO','PDF','FAQ','CNPJ','CPF','API','USB','CEO',
    'ELEGOO','RAYSHAPE','MEDIT','EXOCAD','SMART','DENT','BLZ','INO','TRP','SDK'
  ];
begin
  if out_txt is null then return null; end if;
  for m in
    select distinct x[1]
      from regexp_matches(txt, '([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,})', 'g') x
     order by 1 desc
  loop
    if m = any(keep) then continue; end if;
    out_txt := replace(out_txt, m, initcap(lower(m)));
  end loop;
  return out_txt;
end
$$;

update public.knowledge_contents
   set excerpt          = public.fn_smart_titlecase(excerpt),
       meta_description = public.fn_smart_titlecase(meta_description),
       content_html     = public.fn_smart_titlecase(content_html),
       keywords         = (
         select array_agg(public.fn_smart_titlecase(k) order by ord)
           from unnest(keywords) with ordinality as u(k, ord)
       ),
       updated_at       = now()
 where category_id = 'ff524477-c553-4518-868e-8435e16a5c57'
   and (
        coalesce(excerpt,'') ~ '[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}'
     or coalesce(meta_description,'') ~ '[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}'
     or coalesce(content_html,'') ~ '[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}'
   );