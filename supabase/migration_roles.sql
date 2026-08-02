-- =========================================================
-- Comptes avec rôle : admin (gestionnaire) vs propriétaire
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
--
-- Toutes les instructions ci-dessous sont rejouables sans risque
-- (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS), même
-- si tu as déjà exécuté une version précédente de ce fichier.
--
-- Après avoir créé un compte (Authentication > Users), il devient
-- automatiquement "proprietaire". Pour le passer admin ou lui donner
-- un nom (utile s'il n'a pas encore été créé via la page "Comptes") :
--   update profiles set role = 'admin' where id = (select id from auth.users where email = 'ton_email@exemple.com');
--   update profiles set nom = 'Serigne Modou Diop' where id = (select id from auth.users where email = 'proprietaire@exemple.com');
-- =========================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'proprietaire' check (role in ('admin', 'proprietaire')),
  nom text,
  email text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Crée automatiquement une fiche "proprietaire" (avec email) pour tout nouveau compte
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Remplit l'email des comptes déjà créés avant l'ajout de la colonne
update profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Le compte connecté est-il admin ? (security definer : bypasse la RLS de "profiles")
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "self read profile" on profiles;
create policy "self read profile" on profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "admin read profiles" on profiles;
create policy "admin read profiles" on profiles
  for select to authenticated using (is_admin());

-- Rattache un véhicule au compte de son propriétaire.
-- ON DELETE SET NULL : supprimer un compte propriétaire ne supprime
-- jamais ses véhicules, ils redeviennent juste "sans compte lié".
alter table vehicles add column if not exists owner_id uuid references auth.users(id);
alter table vehicles drop constraint if exists vehicles_owner_id_fkey;
alter table vehicles add constraint vehicles_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

-- =========================================================
-- Véhicules : fini la lecture publique, place à la lecture par rôle
-- =========================================================

drop policy if exists "public read vehicles" on vehicles;
drop policy if exists "authenticated write vehicles" on vehicles;

drop policy if exists "scoped read vehicles" on vehicles;
create policy "scoped read vehicles" on vehicles
  for select to authenticated using (is_admin() or owner_id = auth.uid());

drop policy if exists "admin insert vehicles" on vehicles;
create policy "admin insert vehicles" on vehicles
  for insert to authenticated with check (is_admin());

drop policy if exists "admin update vehicles" on vehicles;
create policy "admin update vehicles" on vehicles
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin delete vehicles" on vehicles;
create policy "admin delete vehicles" on vehicles
  for delete to authenticated using (is_admin());

-- =========================================================
-- Saisies journalières (entries)
-- =========================================================

drop policy if exists "public read entries" on entries;
drop policy if exists "authenticated write entries" on entries;

drop policy if exists "scoped read entries" on entries;
create policy "scoped read entries" on entries
  for select to authenticated using (
    is_admin()
    or exists (select 1 from vehicles v where v.id = entries.vehicle_id and v.owner_id = auth.uid())
  );

drop policy if exists "admin insert entries" on entries;
create policy "admin insert entries" on entries
  for insert to authenticated with check (is_admin());

drop policy if exists "admin update entries" on entries;
create policy "admin update entries" on entries
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin delete entries" on entries;
create policy "admin delete entries" on entries
  for delete to authenticated using (is_admin());

-- =========================================================
-- Avances & dépenses imprévues
-- =========================================================

drop policy if exists "public read avances" on avances;
drop policy if exists "authenticated write avances" on avances;

drop policy if exists "scoped read avances" on avances;
create policy "scoped read avances" on avances
  for select to authenticated using (
    is_admin()
    or exists (select 1 from vehicles v where v.id = avances.vehicle_id and v.owner_id = auth.uid())
  );

drop policy if exists "admin insert avances" on avances;
create policy "admin insert avances" on avances
  for insert to authenticated with check (is_admin());

drop policy if exists "admin update avances" on avances;
create policy "admin update avances" on avances
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin delete avances" on avances;
create policy "admin delete avances" on avances
  for delete to authenticated using (is_admin());

-- =========================================================
-- Dernière étape, à faire une fois manuellement :
-- passer au moins un compte en admin, sinon personne ne peut
-- plus rien saisir ni gérer les autres comptes.
--   update profiles set role = 'admin' where id = (select id from auth.users where email = 'ton_email@exemple.com');
-- =========================================================
