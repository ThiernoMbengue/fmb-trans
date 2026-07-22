-- =========================================================
-- Ajout: type "remboursement" pour les avances,
-- et taux de rémunération chauffeur par véhicule
-- À exécuter dans Supabase > SQL Editor (nouvelle requête)
-- =========================================================

alter table avances drop constraint if exists avances_type_check;
alter table avances add constraint avances_type_check
  check (type in ('avance_proprietaire', 'depense_imprevue', 'remboursement'));

alter table vehicles add column if not exists taux_chauffeur numeric not null default 5000;
