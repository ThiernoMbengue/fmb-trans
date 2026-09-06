-- =========================================================
-- Paramètres de l'application (clé / valeur)
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- Rejouable sans risque.
--
-- Sert notamment à stocker le mot de passe de l'espace investisseur,
-- sous forme hachée (scrypt) : la valeur en clair n'est jamais
-- enregistrée et ne peut pas être relue, seulement remplacée.
-- =========================================================

create table if not exists app_settings (
  cle text primary key,
  valeur text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table app_settings enable row level security;

-- Seul le gestionnaire peut consulter ou modifier les paramètres.
-- La page investisseur, elle, lit la valeur côté serveur avec la clé
-- service_role, qui contourne la RLS : le hachage n'est donc jamais
-- exposé au navigateur.
drop policy if exists "admin read settings" on app_settings;
create policy "admin read settings" on app_settings
  for select to authenticated using (is_admin());

drop policy if exists "admin insert settings" on app_settings;
create policy "admin insert settings" on app_settings
  for insert to authenticated with check (is_admin());

drop policy if exists "admin update settings" on app_settings;
create policy "admin update settings" on app_settings
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin delete settings" on app_settings;
create policy "admin delete settings" on app_settings
  for delete to authenticated using (is_admin());
