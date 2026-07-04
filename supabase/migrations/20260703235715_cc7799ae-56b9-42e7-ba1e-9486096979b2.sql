
-- Site setting: WhatsApp oficial da Smart Dent (fallback quando o lead não tem vendedor)
insert into public.site_settings (key, value)
values ('whatsapp_official', '{"number":"5516993061659","label":"Smart Dent"}'::jsonb)
on conflict (key) do nothing;

-- === Régua de email ===
create table if not exists public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  produto_id uuid,
  audience_filter jsonb not null default '{}'::jsonb,
  stop_condition text not null default 'clicked'
    check (stop_condition in ('clicked','opened','deal_won','none')),
  status text not null default 'draft'
    check (status in ('draft','active','paused','archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz
);

grant select, insert, update, delete on public.email_sequences to authenticated;
grant all on public.email_sequences to service_role;

alter table public.email_sequences enable row level security;

create policy "email_sequences_select_authenticated"
  on public.email_sequences for select to authenticated using (true);
create policy "email_sequences_insert_authenticated"
  on public.email_sequences for insert to authenticated with check (true);
create policy "email_sequences_update_authenticated"
  on public.email_sequences for update to authenticated using (true) with check (true);
create policy "email_sequences_delete_authenticated"
  on public.email_sequences for delete to authenticated using (true);

create table if not exists public.email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  step_order int not null,
  delay_days int not null default 0 check (delay_days >= 0),
  send_hour int not null default 9 check (send_hour between 0 and 23),
  subject_template text not null,
  preheader_template text,
  html_template text not null,
  cta_button_label text,
  cta_config jsonb,
  tom text default 'consultivo',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);

grant select, insert, update, delete on public.email_sequence_steps to authenticated;
grant all on public.email_sequence_steps to service_role;

alter table public.email_sequence_steps enable row level security;

create policy "email_sequence_steps_all_authenticated"
  on public.email_sequence_steps for all to authenticated using (true) with check (true);

-- Rastreio de envios da régua (para saber qual step é o próximo)
create table if not exists public.email_sequence_dispatches (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  step_id uuid not null references public.email_sequence_steps(id) on delete cascade,
  lead_id uuid not null,
  send_log_id uuid,
  scheduled_for timestamptz not null,
  dispatched_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','dispatched','skipped','stopped','error')),
  error_message text,
  created_at timestamptz not null default now(),
  unique (sequence_id, step_id, lead_id)
);

grant select, insert, update, delete on public.email_sequence_dispatches to authenticated;
grant all on public.email_sequence_dispatches to service_role;

alter table public.email_sequence_dispatches enable row level security;

create policy "email_sequence_dispatches_all_authenticated"
  on public.email_sequence_dispatches for all to authenticated using (true) with check (true);

create index if not exists idx_email_sequence_dispatches_pending
  on public.email_sequence_dispatches(sequence_id, status, scheduled_for)
  where status = 'pending';

create index if not exists idx_email_sequence_steps_seq_order
  on public.email_sequence_steps(sequence_id, step_order);

-- Trigger updated_at
create or replace function public.tg_email_sequences_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_email_sequences_updated_at on public.email_sequences;
create trigger trg_email_sequences_updated_at
  before update on public.email_sequences
  for each row execute function public.tg_email_sequences_updated_at();

drop trigger if exists trg_email_sequence_steps_updated_at on public.email_sequence_steps;
create trigger trg_email_sequence_steps_updated_at
  before update on public.email_sequence_steps
  for each row execute function public.tg_email_sequences_updated_at();
