-- =========================================================
-- Assistant IA et justificatifs de saisie
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- Rejouable sans risque.
--
-- Deux choses :
--   1. les justificatifs — la capture d'écran envoyée par le chauffeur,
--      conservée avec la saisie qu'elle a servi à remplir ;
--   2. le suivi d'usage de l'IA — un compteur par personne et par jour,
--      qui sert de garde-fou sur la facture.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Justificatifs de saisie
-- Le fichier vit dans le bucket « justificatifs » ; cette table garde
-- son emplacement et le rattache à un véhicule et à un jour.
-- ---------------------------------------------------------
create table if not exists entry_justificatifs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  date date not null,
  nom text not null,
  chemin text not null,
  type_mime text,
  taille bigint,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists entry_justificatifs_idx on entry_justificatifs (vehicle_id, date);

alter table entry_justificatifs enable row level security;

-- Lecture : le gestionnaire, et le propriétaire pour ses propres véhicules.
drop policy if exists "scoped read entry_justificatifs" on entry_justificatifs;
create policy "scoped read entry_justificatifs" on entry_justificatifs
  for select to authenticated using (
    is_admin()
    or exists (select 1 from vehicles v where v.id = entry_justificatifs.vehicle_id and v.owner_id = auth.uid())
  );

-- Écriture : gestionnaire uniquement.
drop policy if exists "admin insert entry_justificatifs" on entry_justificatifs;
create policy "admin insert entry_justificatifs" on entry_justificatifs
  for insert to authenticated with check (is_admin());

drop policy if exists "admin delete entry_justificatifs" on entry_justificatifs;
create policy "admin delete entry_justificatifs" on entry_justificatifs
  for delete to authenticated using (is_admin());

-- Bucket privé : aucun fichier n'est accessible par simple adresse,
-- l'application demande un lien signé à durée limitée.
insert into storage.buckets (id, name, public)
values ('justificatifs', 'justificatifs', false)
on conflict (id) do nothing;

-- Les fichiers sont rangés par véhicule : « <id du véhicule>/<fichier> ».
-- Le premier dossier du chemin sert donc à savoir à qui le fichier appartient.
drop policy if exists "scoped read justificatifs files" on storage.objects;
create policy "scoped read justificatifs files" on storage.objects
  for select to authenticated using (
    bucket_id = 'justificatifs'
    and (
      is_admin()
      or exists (
        select 1 from vehicles v
        where v.id::text = (storage.foldername(name))[1] and v.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "admin insert justificatifs files" on storage.objects;
create policy "admin insert justificatifs files" on storage.objects
  for insert to authenticated with check (bucket_id = 'justificatifs' and is_admin());

drop policy if exists "admin delete justificatifs files" on storage.objects;
create policy "admin delete justificatifs files" on storage.objects
  for delete to authenticated using (bucket_id = 'justificatifs' and is_admin());

-- ---------------------------------------------------------
-- 2. Suivi d'usage de l'IA
-- Une ligne par personne et par jour. Écrite uniquement par le serveur
-- (clé de service) : personne ne peut remettre son compteur à zéro.
-- ---------------------------------------------------------
create table if not exists ia_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  jour date not null,
  appels integer not null default 0,
  tokens_entree bigint not null default 0,
  tokens_sortie bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, jour)
);

alter table ia_usage enable row level security;

-- Le gestionnaire peut consulter l'usage ; aucune règle d'écriture.
drop policy if exists "admin read ia_usage" on ia_usage;
create policy "admin read ia_usage" on ia_usage
  for select to authenticated using (is_admin());

-- Incrément atomique : deux demandes simultanées ne se marchent pas dessus.
-- Renvoie le nombre d'appels du jour après incrément.
create or replace function ia_compter(p_user uuid, p_jour date, p_appels integer, p_entree bigint, p_sortie bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  insert into ia_usage (user_id, jour, appels, tokens_entree, tokens_sortie)
  values (p_user, p_jour, p_appels, p_entree, p_sortie)
  on conflict (user_id, jour) do update
    set appels = ia_usage.appels + excluded.appels,
        tokens_entree = ia_usage.tokens_entree + excluded.tokens_entree,
        tokens_sortie = ia_usage.tokens_sortie + excluded.tokens_sortie,
        updated_at = now()
  returning appels into total;
  return total;
end;
$$;

-- Réservée au serveur : ni les comptes connectés ni les visiteurs ne
-- peuvent l'appeler.
revoke all on function ia_compter(uuid, date, integer, bigint, bigint) from public, anon, authenticated;

-- Contrôle
select
  (select count(*) from entry_justificatifs) as justificatifs,
  (select count(*) from ia_usage) as jours_d_usage;
