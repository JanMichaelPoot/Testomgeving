-- Fase 6 (Interaction & Retention) — een lichte, duim-omhoog/omlaag reactie
-- per idee, alleen zichtbaar op /plan (de eigen pagina van de koper), nooit
-- op de publieke /shared/[id]-preview. Opgeslagen als een klein jsonb-object
-- in plaats van een aparte tabel: één plan heeft hooguit 7 reacties (6
-- ideeën + de wildcard) en ze worden altijd samen met het plan zelf
-- gelezen/geschreven, dus een genormaliseerde tabel zou hier alleen een
-- join toevoegen zonder echt voordeel.
--
-- Keys zijn "idea-<index>" (de index in ideas_json, in Claude's originele
-- generatievolgorde — stabiel ongeacht deur-volgorde of Uitdagingsmodus, die
-- alleen bepalen hoe diezelfde array op het scherm doorlopen wordt) of
-- "wildcard". Waarden zijn "up" of "down"; een gewiste reactie verwijdert
-- gewoon zijn key, in plaats van een derde "neutrale" waarde op te slaan.
alter table window_plans
  add column feedback_json jsonb not null default '{}'::jsonb;
