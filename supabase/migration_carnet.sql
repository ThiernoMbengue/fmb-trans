-- =========================================================
-- Carnet de bord — notes, dettes, échéances, documents
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- Rejouable sans risque.
--
-- Tout ce qui concerne l'entreprise sans avoir sa place ailleurs :
-- une chose à ne pas oublier, une dette hors du circuit des
-- véhicules, une assurance qui expire, une facture à garder.
--
-- Réservé au gestionnaire, lecture comprise.
-- =========================================================

create table if not exists carnet (
  id uuid primary key default gen_random_uuid(),

  -- note      : à ne pas oublier, à classer plus tard
  -- a_recevoir: quelqu'un doit de l'argent à FMB
  -- a_payer   : FMB doit de l'argent
  -- echeance  : assurance, visite technique, vignette, permis…
  -- entretien : révision, réparation à prévoir
  -- document  : carte grise, contrat, facture à conserver
  -- incident  : accident, PV, panne majeure
  type text not null default 'note'
    check (type in ('note', 'a_recevoir', 'a_payer', 'echeance', 'entretien', 'document', 'incident')),

  titre text not null,
  detail text,

  -- Facultatifs : une note libre n'a ni montant ni date.
  montant numeric,
  date_echeance date,

  -- Rattachement facultatif à un véhicule.
  vehicle_id uuid references vehicles(id) on delete set null,

  -- Une ligne réglée sort des totaux mais reste consultable. C'est la
  -- leçon des avances : supprimer efface aussi la trace.
  statut text not null default 'ouvert'
    check (statut in ('ouvert', 'regle')),
  regle_le date,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carnet_statut_idx on carnet (statut, date_echeance);
create index if not exists carnet_vehicle_idx on carnet (vehicle_id);

drop trigger if exists trg_carnet_updated_at on carnet;
create trigger trg_carnet_updated_at
  before update on carnet
  for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Pièces jointes : captures d'écran, PDF, photos
-- Le fichier lui-même vit dans le bucket « carnet » ; cette table
-- garde son nom d'origine et son emplacement.
-- ---------------------------------------------------------
create table if not exists carnet_fichiers (
  id uuid primary key default gen_random_uuid(),
  carnet_id uuid not null references carnet(id) on delete cascade,
  nom text not null,
  chemin text not null,
  type_mime text,
  taille bigint,
  created_at timestamptz not null default now()
);

create index if not exists carnet_fichiers_idx on carnet_fichiers (carnet_id);

-- ---------------------------------------------------------
-- Accès : gestionnaire uniquement, lecture comprise
-- ---------------------------------------------------------
alter table carnet enable row level security;
alter table carnet_fichiers enable row level security;

drop policy if exists "admin all carnet" on carnet;
create policy "admin all carnet" on carnet
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin all carnet_fichiers" on carnet_fichiers;
create policy "admin all carnet_fichiers" on carnet_fichiers
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------
-- Stockage des pièces jointes
-- Bucket privé : aucun fichier n'est accessible par simple URL,
-- l'application demande un lien signé à durée limitée.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('carnet', 'carnet', false)
on conflict (id) do nothing;

drop policy if exists "admin read carnet files" on storage.objects;
create policy "admin read carnet files" on storage.objects
  for select to authenticated using (bucket_id = 'carnet' and is_admin());

drop policy if exists "admin insert carnet files" on storage.objects;
create policy "admin insert carnet files" on storage.objects
  for insert to authenticated with check (bucket_id = 'carnet' and is_admin());

drop policy if exists "admin delete carnet files" on storage.objects;
create policy "admin delete carnet files" on storage.objects
  for delete to authenticated using (bucket_id = 'carnet' and is_admin());

-- Contrôle
select type, statut, count(*) as nombre, sum(montant) as total
from carnet
group by type, statut
order by type, statut;
