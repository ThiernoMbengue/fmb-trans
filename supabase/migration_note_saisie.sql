-- =========================================================
-- Remarque libre sur une journée de saisie
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- Rejouable sans risque.
--
-- Les deux remarques existantes sont attachées à une dépense :
-- gazoil_note explique le carburant, autres_note explique les frais
-- divers. Il manquait un endroit pour ce qui concerne la journée
-- elle-même — une panne, un retard, un client particulier, une
-- explication sur une recette inhabituelle.
-- =========================================================

alter table entries
  add column if not exists note text;

comment on column entries.note is
  'Remarque libre sur la journée : incident, contexte, explication d''un montant.';

-- Index partiel : seules les lignes qui portent une remarque y figurent,
-- ce qui le garde petit même quand la plupart des journées n'en ont pas.
create index if not exists entries_note_idx
  on entries (vehicle_id, date)
  where note is not null and note <> '';

-- Contrôle : combien de journées portent une remarque ?
select
  v.immatriculation,
  count(*)                                                        as journees,
  count(*) filter (where e.note is not null and e.note <> '')      as avec_remarque
from entries e
join vehicles v on v.id = e.vehicle_id
group by v.immatriculation
order by v.immatriculation;
