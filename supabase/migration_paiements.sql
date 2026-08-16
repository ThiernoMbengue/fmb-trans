-- =========================================================
-- Paiements mensuels aux propriétaires
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- Rejouable sans risque (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Le décompte mensuel lui-même n'est pas stocké : il se recalcule à
-- partir des saisies (entries) et des avances. Seuls les paiements
-- réellement effectués sont enregistrés ici.
-- =========================================================

-- Numérotation continue des reçus : FMB-2026-0001, FMB-2026-0002, …
create sequence if not exists recu_seq;

create or replace function next_numero_recu()
returns text
language sql
volatile
as $$
  select 'FMB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('recu_seq')::text, 4, '0');
$$;

create table if not exists paiements (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  -- Période couverte par le règlement, au format 'YYYY-MM'
  periode text not null check (periode ~ '^\d{4}-\d{2}$'),
  -- Date à laquelle l'argent a été remis (peut tomber le mois suivant)
  date_paiement date not null default current_date,
  montant numeric not null default 0,
  mode text not null default 'especes'
    check (mode in ('especes', 'wave', 'orange_money', 'virement', 'cheque', 'autre')),
  reference text,
  note text,
  numero_recu text not null unique default next_numero_recu(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists paiements_vehicle_periode_idx on paiements (vehicle_id, periode);

alter table paiements enable row level security;

-- Lecture : l'admin voit tout, le propriétaire voit les paiements de ses véhicules
drop policy if exists "scoped read paiements" on paiements;
create policy "scoped read paiements" on paiements
  for select to authenticated using (
    is_admin()
    or exists (select 1 from vehicles v where v.id = paiements.vehicle_id and v.owner_id = auth.uid())
  );

-- Écriture : réservée au gestionnaire
drop policy if exists "admin insert paiements" on paiements;
create policy "admin insert paiements" on paiements
  for insert to authenticated with check (is_admin());

drop policy if exists "admin update paiements" on paiements;
create policy "admin update paiements" on paiements
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin delete paiements" on paiements;
create policy "admin delete paiements" on paiements
  for delete to authenticated using (is_admin());
