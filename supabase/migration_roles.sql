-- =========================================================
-- Comptes avec rôle : admin (gestionnaire) vs propriétaire
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
--
-- Après avoir créé un compte (Authentication > Users) pour un
-- propriétaire, mets à jour sa fiche pour le nommer et, si besoin,
-- le passer admin :
--   update profiles set nom = 'Serigne Modou Diop' where id = '<uuid du compte>';
--   update profiles set role = 'admin' where id = '<uuid du compte gestionnaire>';
-- Un compte fraîchement créé est "proprietaire" par défaut.
-- =========================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'proprietaire' check (role in ('admin', 'proprietaire')),
  nom text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Crée automatiquement une fiche "proprietaire" pour tout nouveau compte
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Le compte connecté est-il admin ?
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

-- Rattache un véhicule au compte de son propriétaire
alter table vehicles add column if not exists owner_id uuid references auth.users(id);

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

-- N'oublie pas de passer au moins un compte en admin, sinon personne
-- ne peut plus rien saisir :
--   update profiles set role = 'admin' where id = '<uuid du compte gestionnaire>';
