-- =========================================================
-- Demandes d'avance : le propriétaire demande, l'admin approuve/refuse
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- Rejouable sans risque (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =========================================================

create table if not exists avance_requests (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  requested_by uuid references auth.users(id),
  montant numeric not null default 0,
  note text,
  status text not null default 'en_attente' check (status in ('en_attente', 'approuvee', 'refusee')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create index if not exists avance_requests_vehicle_idx on avance_requests (vehicle_id, created_at);

alter table avance_requests enable row level security;

drop policy if exists "scoped read avance_requests" on avance_requests;
create policy "scoped read avance_requests" on avance_requests
  for select to authenticated using (
    is_admin()
    or exists (select 1 from vehicles v where v.id = avance_requests.vehicle_id and v.owner_id = auth.uid())
  );

-- Un propriétaire ne peut créer une demande que pour son propre véhicule
drop policy if exists "owner insert avance_requests" on avance_requests;
create policy "owner insert avance_requests" on avance_requests
  for insert to authenticated with check (
    exists (select 1 from vehicles v where v.id = avance_requests.vehicle_id and v.owner_id = auth.uid())
  );

-- Le propriétaire peut annuler sa propre demande tant qu'elle est en attente
drop policy if exists "owner cancel own pending avance_requests" on avance_requests;
create policy "owner cancel own pending avance_requests" on avance_requests
  for delete to authenticated using (
    status = 'en_attente'
    and exists (select 1 from vehicles v where v.id = avance_requests.vehicle_id and v.owner_id = auth.uid())
  );

-- Seul l'admin approuve/refuse (change le statut)
drop policy if exists "admin update avance_requests" on avance_requests;
create policy "admin update avance_requests" on avance_requests
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin delete avance_requests" on avance_requests;
create policy "admin delete avance_requests" on avance_requests
  for delete to authenticated using (is_admin());
