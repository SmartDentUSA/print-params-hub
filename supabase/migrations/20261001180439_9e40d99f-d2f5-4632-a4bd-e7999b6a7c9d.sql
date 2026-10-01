create or replace function public.fn_link_crm_origin_to_event_form()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_form record; v_origin text;
begin
  v_origin := coalesce(nullif(trim(new.origin_name),''), nullif(trim(new.piperun_origin_name),''));
  if new.lead_id is null or v_origin is null then return new; end if;
  select id, name, event_id into v_form from smartops_forms
   where event_id is not null and lower(trim(name)) = lower(v_origin) limit 1;
  if v_form.id is null then return new; end if;
  update lia_attendances
     set event_id = v_form.event_id,
         form_name = coalesce(nullif(trim(form_name),''), v_form.name)
   where id = new.lead_id and merged_into is null and event_id is null;
  return new;
end $$;

drop trigger if exists trg_link_crm_origin_to_event_form on public.deals;
create trigger trg_link_crm_origin_to_event_form
after insert or update of origin_name, piperun_origin_name, lead_id on public.deals
for each row execute function public.fn_link_crm_origin_to_event_form();

-- backfill
update public.lia_attendances l
   set event_id = f.event_id,
       form_name = coalesce(nullif(trim(l.form_name),''), f.name)
  from public.deals d
  join public.smartops_forms f on f.event_id is not null
   and lower(trim(f.name)) = lower(coalesce(nullif(trim(d.origin_name),''), nullif(trim(d.piperun_origin_name),'')))
 where d.lead_id = l.id and l.merged_into is null and l.event_id is null;