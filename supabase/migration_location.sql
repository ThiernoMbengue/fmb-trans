-- =========================================================
-- Journées de location sans chauffeur
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- Rejouable sans risque.
--
-- Quand le véhicule est loué seul, le client conduit et paie son
-- carburant : il ne remet qu'un forfait. Ces journées n'ont donc
-- aucune dépense à notre charge ET aucun salaire de chauffeur à payer.
--
-- Jusqu'ici ces journées étaient devinées à partir des montants
-- (recette > 0 et aucune dépense). C'est fragile : un jour avec
-- chauffeur sans achat de gazoil ressemblait à une location, et une
-- location où FMB avance un frais ressemblait à un jour avec chauffeur.
-- Le marqueur ci-dessous rend l'information explicite.
-- =========================================================

alter table entries
  add column if not exists sans_chauffeur boolean not null default false;

comment on column entries.sans_chauffeur is
  'Journée de location sans chauffeur : aucun salaire de chauffeur n''est dû.';

-- ---------------------------------------------------------
-- 1) Reprise de l'historique : toute journée ayant une recette mais
--    strictement aucune dépense est une location sans chauffeur.
-- ---------------------------------------------------------
update entries
set sans_chauffeur = true
where recette > 0
  and coalesce(gazoil, 0) = 0
  and coalesce(autres, 0) = 0
  and sans_chauffeur = false;

-- ---------------------------------------------------------
-- 2) Période de location déclarée : du 24 juillet au 21 août 2026
--    (29 jours) sur la Renault QM3. Marquée explicitement, même si
--    une dépense a été saisie par erreur sur l'un de ces jours.
--
--    Pour déclarer une autre période plus tard : dupliquer ce bloc en
--    changeant l'immatriculation et les deux dates.
-- ---------------------------------------------------------
update entries e
set sans_chauffeur = true
from vehicles v
where v.id = e.vehicle_id
  and v.immatriculation = 'AB-449-JL'
  and e.date between date '2026-07-24' and date '2026-08-21';

-- ---------------------------------------------------------
-- Contrôle : combien de jours de chaque type, par véhicule ?
-- Le total « location » doit afficher 29 pour la QM3 si les 29 jours
-- de la période ont bien une saisie. S'il en manque, c'est que
-- certaines journées n'ont pas été enregistrées du tout.
-- ---------------------------------------------------------
select
  v.immatriculation,
  count(*) filter (where e.recette > 0 and not e.sans_chauffeur) as jours_avec_chauffeur,
  count(*) filter (where e.recette > 0 and e.sans_chauffeur)     as jours_location,
  count(*) filter (where e.recette = 0)                          as jours_sans_activite
from entries e
join vehicles v on v.id = e.vehicle_id
group by v.immatriculation
order by v.immatriculation;
