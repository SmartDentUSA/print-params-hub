
-- Storage bucket for admin exports
insert into storage.buckets (id, name, public)
values ('admin-exports', 'admin-exports', false)
on conflict (id) do nothing;

-- Job tracking table
create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'processing',
  progress int not null default 0,
  current_step text,
  files jsonb not null default '[]'::jsonb,
  lead_count int default 0,
  deal_count int default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.export_jobs enable row level security;

create policy "admins manage export_jobs"
  on public.export_jobs for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Storage policies (admin only)
create policy "admins read admin-exports"
  on storage.objects for select
  using (bucket_id = 'admin-exports' and public.is_admin(auth.uid()));

create policy "admins write admin-exports"
  on storage.objects for insert
  with check (bucket_id = 'admin-exports' and public.is_admin(auth.uid()));
