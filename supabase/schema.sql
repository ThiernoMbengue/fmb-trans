-- =========================================================
-- FMB Trans-Mobilité Services — schéma de base de données
-- À exécuter dans Supabase > SQL Editor
-- =========================================================

create extension if not exists "pgcrypto";

-- ---- Véhicules ----
create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  marque text not null,
  immatriculation text not null,
  proprietaire text,
  chauffeur text,
  created_at timestamptz not null default now()
);

-- ---- Saisies journalières ----
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  date date not null,
  receveur text,
  recette numeric not null default 0,
  gazoil numeric not null default 0,
  gazoil_note text,
  autres numeric not null default 0,
  autres_note text,
  total_caisse numeric not null default 0,
  net numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, date)
);

create index if not exists entries_vehicle_date_idx on entries (vehicle_id, date);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_entries_updated_at on entries;
create trigger trg_entries_updated_at
  before update on entries
  for each row execute function set_updated_at();

-- =========================================================
-- Row Level Security
-- Lecture: publique (n'importe qui avec le lien)
-- Écriture (insert/update/delete): utilisateurs connectés uniquement
-- =========================================================

alter table vehicles enable row level security;
alter table entries enable row level security;

drop policy if exists "public read vehicles" on vehicles;
create policy "public read vehicles" on vehicles
  for select using (true);

drop policy if exists "authenticated write vehicles" on vehicles;
create policy "authenticated write vehicles" on vehicles
  for all to authenticated using (true) with check (true);

drop policy if exists "public read entries" on entries;
create policy "public read entries" on entries
  for select using (true);

drop policy if exists "authenticated write entries" on entries;
create policy "authenticated write entries" on entries
  for all to authenticated using (true) with check (true);

-- =========================================================
-- Données de départ (véhicule + historique QM3)
-- =========================================================

insert into vehicles (id, marque, immatriculation, proprietaire, chauffeur)
values ('11111111-1111-1111-1111-111111111111', 'Renault QM3', 'AB-449-JL', 'Serigne Modou Diop', 'Weuz')
on conflict (id) do nothing;

insert into entries (vehicle_id, date, receveur, recette, gazoil, gazoil_note, autres, autres_note, total_caisse, net)
values
('11111111-1111-1111-1111-111111111111','2026-06-19','Weuz',38502,7000,'Le solde à mettre pour les courses',3000,'3000 Attesté par un policier',31502,28502),
('11111111-1111-1111-1111-111111111111','2026-06-20','Weuz',20000,0,'',0,'Samedi: location sans chauffeur',0,20000),
('11111111-1111-1111-1111-111111111111','2026-06-21','Weuz',20837,10000,'Gazoil',0,'',10837,10837),
('11111111-1111-1111-1111-111111111111','2026-06-22','Weuz',17147,7000,'Gazoil',0,'',10147,10147),
('11111111-1111-1111-1111-111111111111','2026-06-23','Weuz',19719,9000,'Gazoil',0,'',10719,10719),
('11111111-1111-1111-1111-111111111111','2026-06-24','Weuz',48550,18000,'Gazoil',5500,'Yango + dépôt aéroport, frais divers',25050,25050),
('11111111-1111-1111-1111-111111111111','2026-06-25','Weuz',41580,14800,'Gazoil',1000,'Lavage',25780,25780),
('11111111-1111-1111-1111-111111111111','2026-06-26','Weuz',0,0,'Repos',0,'Repos',0,0),
('11111111-1111-1111-1111-111111111111','2026-06-27','Weuz',36639,14000,'Gazoil',0,'Yango 8h-17h + location aprèm',36639,22639),
('11111111-1111-1111-1111-111111111111','2026-06-28','Weuz',24000,10000,'Gazoil',3600,'Péage',14000,10400),
('11111111-1111-1111-1111-111111111111','2026-06-29','Weuz',15000,0,'',0,'Versement journée, dépôt client Thiès',0,15000),
('11111111-1111-1111-1111-111111111111','2026-06-30','Weuz',15000,0,'',0,'Suite location retour village',0,15000),
('11111111-1111-1111-1111-111111111111','2026-07-01','Weuz',32381,10000,'Gazoil',1500,'Parking Dakar',19881,19881),
('11111111-1111-1111-1111-111111111111','2026-07-02','Weuz',0,0,'Repos',0,'Repos',0,0),
('11111111-1111-1111-1111-111111111111','2026-07-03','weuz',37859,11700,'Gazoil',4000,'Parking Dakar/Yeumbeul, Lavage',22159,22159),
('11111111-1111-1111-1111-111111111111','2026-07-04','Weuz',40873,10602,'Gazoil',3000,'Parking, Lavage',27271,27271),
('11111111-1111-1111-1111-111111111111','2026-07-05','Weuz',21275,7300,'Gazoil',0,'+15000 locations village',28975,28975),
('11111111-1111-1111-1111-111111111111','2026-07-06','Weuz',32500,9900,'Gazoil',0,'',22400,22400),
('11111111-1111-1111-1111-111111111111','2026-07-07','Weuz',17170,12403,'Gazoil, travail après-midi',500,'Parking',4767,4267),
('11111111-1111-1111-1111-111111111111','2026-07-08','Weuz',42206,12000,'Gazoil',3000,'Parking et Lavage',27206,27206),
('11111111-1111-1111-1111-111111111111','2026-07-09','Weuz',0,0,'Repos',0,'Repos',0,0),
('11111111-1111-1111-1111-111111111111','2026-07-10','Weuz',47243,11800,'Gasoil',3500,'Attestation carte grise, Parking',31943,31943),
('11111111-1111-1111-1111-111111111111','2026-07-11','Weuz',9694,0,'',9694,'Quelques courses le matin',9694,9694),
('11111111-1111-1111-1111-111111111111','2026-07-12','Weuz',38282,17381,'Gazoil',500,'Parking',20401,20401),
('11111111-1111-1111-1111-111111111111','2026-07-13','Weuz',0,0,'Entretien global',0,'',0,0),
('11111111-1111-1111-1111-111111111111','2026-07-14','Weuz',50000,14000,'Gazoil',500,'Parking, location chauffeur privé',35500,35500),
('11111111-1111-1111-1111-111111111111','2026-07-15','Weuz',21621,0,'',10000,'Réparation Feu',11621,11621),
('11111111-1111-1111-1111-111111111111','2026-07-16','Weuz',57000,12254,'Gazoil',500,'Parking; Yango et chauffeur privé',44246,44246),
('11111111-1111-1111-1111-111111111111','2026-07-17','Weuz',26000,4600,'Gazoil',500,'Parking; pas de Yango',21400,21400),
('11111111-1111-1111-1111-111111111111','2026-07-18','Weuz',0,0,'',0,'',0,0),
('11111111-1111-1111-1111-111111111111','2026-07-19','Weuz',36345,10100,'Gazoil',1000,'',26245,25245)
on conflict (vehicle_id, date) do nothing;
