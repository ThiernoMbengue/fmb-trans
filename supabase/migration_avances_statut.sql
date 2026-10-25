-- =========================================================
-- Statut de règlement des avances
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- Rejouable sans risque.
--
-- Jusqu'ici, une avance ne pouvait que disparaître : le seul bouton
-- disponible était « supprimer », ce qui effaçait aussi la trace de
-- l'argent remis. Une avance a pourtant une vie : elle est remise, puis
-- récupérée — le plus souvent en étant déduite d'un paiement mensuel.
--
-- Ce statut sépare les deux : ce qui reste à récupérer, et ce qui l'a
-- déjà été. Le décompte mensuel, lui, ne change pas : il reste le fait
-- historique de ce qui a été déduit ce mois-là.
-- =========================================================

alter table avances
  add column if not exists statut text not null default 'en_cours';

alter table avances
  add column if not exists regularisee_le date;

-- Période de paiement qui a soldé cette avance, au format 'YYYY-MM'.
alter table avances
  add column if not exists regularisee_periode text;

-- Vrai si le marquage vient du règlement d'un décompte, faux s'il a été
-- posé à la main. Les marquages manuels ne sont jamais défaits
-- automatiquement : seule la machine reprend ce que la machine a écrit.
alter table avances
  add column if not exists regularisee_auto boolean not null default false;

alter table avances
  add column if not exists regularisee_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'avances_statut_check'
  ) then
    alter table avances
      add constraint avances_statut_check
      check (statut in ('en_cours', 'regularisee'));
  end if;
end $$;

create index if not exists avances_statut_idx on avances (vehicle_id, statut);

-- ---------------------------------------------------------
-- Reprise de l'historique
--
-- Rien n'est marqué automatiquement ici : le rattrapage se fait tout
-- seul au prochain affichage de la page Paiements, à partir des
-- décomptes réellement soldés. Lancer la page suffit.
-- ---------------------------------------------------------

-- Contrôle : combien d'avances de chaque statut, par véhicule ?
select
  v.immatriculation,
  a.type,
  a.statut,
  count(*)        as nombre,
  sum(a.montant)  as total
from avances a
join vehicles v on v.id = a.vehicle_id
group by v.immatriculation, a.type, a.statut
order by v.immatriculation, a.type, a.statut;
