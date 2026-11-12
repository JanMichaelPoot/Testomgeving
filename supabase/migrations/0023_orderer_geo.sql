-- Land en plaats van de besteller, voor het admin-logboek (/admin/logboek).
--
-- Waar komt een bestelling vandaan? Afgeleid van de verbinding door de hostingprovider (Vercel, de headers x-vercel-ip-country en
-- x-vercel-ip-city), op het moment dat de bestelling wordt geplaatst. Er wordt NOOIT een IP-adres in deze kolommen bewaard, en niets
-- preciezer dan een stad. Beide kolommen zijn optioneel: een bestelling van voor deze migratie of zonder hint (een lokale run) heeft ze niet.
--
-- payments: bij de bestelling (src/app/checkout/actions.ts), want daar komt het verzoek van de besteller binnen.
-- audit_log: overgenomen bij het schrijven van het boek (src/lib/auditLog.ts). Het logboek blijft verder anoniem: nog steeds geen
--   session_id, user_id of e-mailadres (zie 0008_audit_log.sql); alleen een grof land en plaats komen erbij.
--
-- De code werkt ook zolang deze migratie niet is gedraaid: de bestelling en de logregel worden dan zonder deze kolommen opgeslagen.

alter table payments add column if not exists ip_country text;
alter table payments add column if not exists ip_city text;

alter table audit_log add column if not exists orderer_country text;
alter table audit_log add column if not exists orderer_city text;

comment on column payments.ip_country is 'ISO 3166-1 alpha-2 van de verbinding waarvandaan is besteld (hostingprovider-header); nooit een IP-adres.';
comment on column payments.ip_city is 'Plaats van de verbinding waarvandaan is besteld (hostingprovider-header); nooit een IP-adres.';
comment on column audit_log.orderer_country is 'ISO 3166-1 alpha-2 van de verbinding waarvandaan is besteld; het enige herleidbare gegeven in dit logboek, en grof.';
comment on column audit_log.orderer_city is 'Plaats van de verbinding waarvandaan is besteld; grof, nooit een IP-adres.';
