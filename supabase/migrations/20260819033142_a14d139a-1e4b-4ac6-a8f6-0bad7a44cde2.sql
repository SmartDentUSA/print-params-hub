create or replace function public.fn_lower_connectors(txt text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when txt is null then null
    else regexp_replace(txt, '\m(OU|EM|DE|DA|DO|DAS|DOS|NO|NA|COM|PARA)\M', lower('\1'), 'g')
  end;
$$;

update public.knowledge_contents kc
   set excerpt          = public.fn_lower_connectors(kc.excerpt),
       meta_description = public.fn_lower_connectors(kc.meta_description),
       content_html     = public.fn_lower_connectors(kc.content_html),
       keywords         = (
         select array_agg(public.fn_lower_connectors(kw) order by ord)
           from unnest(kc.keywords) with ordinality u(kw, ord)
       ),
       updated_at       = now()
 where kc.category_id = 'ff524477-c553-4518-868e-8435e16a5c57';