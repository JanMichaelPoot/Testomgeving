-- Optional speed-up for the supply index (src/lib/claude/supplyIndex.ts, Stap 195).
--
-- The selection of every book first reads what earlier research found near the person's place: all rows of local_research_cache whose
-- place_key starts with that place ('laren|%': every radius, pass and version). The table's only indexes are the unique key
-- (activity_id, place_key, locale) and expires_at, neither of which serves a prefix search on place_key alone, so the query scans the table.
-- That is fine for thousands of rows and slow for hundreds of thousands. text_pattern_ops makes the btree usable for LIKE 'prefix%' in any collation.
--
-- Nothing breaks without it: the code works either way. Run it in the Supabase SQL editor when the cache has grown.

create index if not exists local_research_cache_place_idx on local_research_cache (place_key text_pattern_ops);
