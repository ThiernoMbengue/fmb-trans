-- =========================================================
-- Ajout: Avances & dépenses imprévues
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- =========================================================

create table if not exists avances (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('avance_proprietaire', 'depense_imprevue')),
  montant numeric not null default 0,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists avances_vehicle_date_idx on avances (vehicle_id, date);

alter table avances enable row level security;

drop policy if exists "public read avances" on avances;
create policy "public read avances" on avances
  for select using (true);

drop policy if exists "authenticated write avances" on avances;
create policy "authenticated write avances" on avances
  for all to authenticated using (true) with check (true);
