# WindowInto Activity Reference Library v1.0

A standalone reference layer that sits next to the app's own discovery library (`src/lib/discovery/`).
The app does **not** read it at run time. It is an editorial master database: 20 main categories, activities,
a controlled vocabulary of associations, and the weighted links between them. It exports to one Excel
workbook, and it is used to check and grow the app's library.

Everything is a hypothesis until a human has reviewed it: every record is `Concept`, and a relevance
score is a judgement, not a measurement.

## What is in it

| File | Content |
|---|---|
| `data/categories.json` | 20 main categories with a target (550 in total) and a scope per language |
| `data/association-domains.json` | 10 association domains (materials, actions, environments, experiences, skills, themes, senses, social, challenge, aesthetics) |
| `data/associations.json` | 127 associations, each in one domain, with a definition in NL and EN and, where terms overlap, a `scope` note |
| `review/` | `findings.json` (all review findings), `REVIEW.md` (readable report) |
| `data/activities/cat-NN-*.json` | the activities, one file per category |
| `export/` | the generated Excel workbook (not committed) |

The source of truth is the JSON. The Excel file is generated from it and never edited by hand.

## An activity record

```json
{
  "id": "RA-014", "slug": "pottenbakken", "category": "CAT-04", "types": ["MAK", "LER"],
  "nl": "Keramiek draaien op een draaischijf", "en": "Throwing ceramics on a wheel",
  "sub": { "nl": "Keramiek", "en": "Ceramics" }, "desc": { "nl": "...", "en": "..." },
  "match": "exact", "legacy_id": "pottenbakken", "v0_id": "ACT-011",
  "facets": { "setting": "indoor", "social_formats": ["solo"], "level": 0, "duration": 3, "cost": 2, "safety_tier": 0, "source": "app" },
  "links": ["klei:5:M", "vakmanschap:5:V", "wetenschap:3:O"],
  "why": { "wetenschap": { "nl": "...", "en": "..." } },
  "status": "Concept"
}
```

- **One primary category** per activity. Secondary properties (setting, social form, level, duration,
  cost, safety) are facets, not extra categories. They use the same scales as the app.
- **Types**: `EXP` experience, `MAK` making, `LER` learning. One or more.
- **Links** are `association:score:relation`. Score 1-5 (5 core, 4 strong, 3 moderate, 2 weak, 1 faint).
  Relation: `D` direct, `T` thematic, `E` experiential, `V` skill, `M` material, `O` discovery.
  `M` may only point at materials, `V` at skills, `T` at themes, `D` at actions or environments, `E` at
  experiences, senses, aesthetics, social and challenge. `O` may point anywhere, but needs a written reason in
  NL and EN in `why`, and is scored 3 or lower (it is indirect by definition).
- **Skills and experiences are derived** from the links (the strongest linked associations in those domains).
  They are not typed twice.
- **Facets**: unknown is `null`, never a guess. `facets.source` says whether the values were copied from the
  matching app activity (`app`) or written for this record (`authored`).

## Recognition and discovery

Recognition is what someone already knows: high scores on direct, material and skill links. Discovery is the
`O` links: a non-obvious but sensible path to something they have not thought of, always with a reason. A good
record has both. The check requires at least one discovery link per activity (it was two until review round 3, when weak bridges were removed instead of padded).

## The link with the app's library

`match` says how a record relates to the app's activities (`src/lib/discovery/data/*.json`):

- `exact`: the same activity. The slug must equal the app id (`legacy_id`).
- `close`: the app has a neighbour with a different scope (for instance "Kleding naaien of verstellen" for
  "Kleding op maat naaien"). `legacy_id` points at it.
- `new`: not in the app. The check refuses a "new" record whose name or alias is already an app activity.

Nothing here changes the app's data. A `new` record is a candidate: to add it to the app it still needs tags
from the app's vocabulary, a photo scene and a review.

## Into the app (step 1 of the implementation plan)

`npx tsx scripts/reference-library/import-to-app.ts [--write]` writes the reference activities into the app's library
(`src/lib/discovery/data/*.json`). Input: this folder plus the hand-written `crosswalk/app-import.json` (the app-specific fields a
reference record does not hold: domain, sub, tags, intensity, supply, months, style register, photo scene, entry, and a decision per
record that was merged into an app activity instead). 124 activities were written and 7 merged; every exact or close record got a
source link. New activities are `concept` and `image_pending`, so they stay invisible until their photos exist. After the import the
reference record says `exact` (`legacy_id` = its slug) like any other. Idempotent; the report is `docs/reference-library-import.md`.
`scripts/reference-library/measure-with-pending.ts` measures the selection as if they were visible (`docs/eval/2026-11-08-reference-import-measurement.md`).
To add more: write the activity here, add its crosswalk record, run the import, then `npm run taxonomy:check` and `npm test`.

## Working with it

```bash
npm run reflib:check      # rules + reconciliation with the app; exits 1 on errors
npm run reflib:report     # the same, plus coverage per category and relation form
npm run reflib:export     # writes export/WindowInto_Activity_Reference_Library_v1.0.xlsx
npx tsx scripts/reference-library/explore.ts pottenbakken   # recognition and discovery neighbours of one activity
```

`explore` shows the two ways the layer is meant to be used. Recognition: activities that share the same
non-discovery associations. Discovery: activities from other categories that a discovery link reaches, with the
written reason. Discovery bridges through very common associations (history, science, world cultures) are
weighted down, because they join almost anything.

The check enforces: unique ids, slugs and names (NL and EN); a known category; 12-20 links per activity;
at least one discovery link with a reason; at least one strong link; at least three association domains per
activity; relation forms that point at the right kind of association; facets inside their scales; a correct
crosswalk to the app. It warns about boilerplate reasons repeated across records and about associations that
no activity uses yet.

## Growing it in batches

1. Pick a category and write a batch of 25-50 activities (one file per category, append to it).
2. Reuse the association vocabulary. Add a new association only when no existing one fits, in the right domain,
   with a definition in both languages.
3. Run `npm run reflib:check`. Fix errors; read the warnings.
4. Review a sample by hand before changing any status from `Concept`.
5. Re-export.

## Sources and licences

ICATUS, ESCO and WHO ICF are used only as inspiration for completeness. Nothing has been copied from them.
Check each licence before importing anything from them.

## Review round 1

All 550 records were reviewed once from four roles (craftsperson, sports and safety coach, cultural historian,
taxonomist): see `review/REVIEW.md`. The round added 15 associations (127 in total), `scope` notes on 29 overlapping
ones, removed 170 weak generic links (`trots` 43% to 18% of activities), corrected one factual claim and softened
ten more, raised two records to safety tier 1, and gave every record `qa` (round, checked or adjusted) and, where
needed, `qa_notes`. It is one AI playing four roles, not human review: records stay `Concept`. 13 extra tags for the
app's vocabulary are proposed in `review/findings.json` but not applied.

## Human sample

Jan checked 30 random activities (`review/steekproef-ronde-1.html`, built by `scripts/reference-library/make-review-sheet.py`):
3 of 180 strongest associations did not fit, 10 of 60 discovery bridges were weak or nonsense, 5 of 30 records had a wrong
facet. All were fixed (records carry `qa` round 2). A bridges-only sheet (`make-bridge-sheet.py`) is the next check. See `review/REVIEW.md`.

## Status (target reached)

550 activities, every category at its target, 127 associations and 8,883 links (16.2 per activity, 1,100
discovery links). 411 activities are the same as one in the app, 8 are close to one and 131 are not in the app.
419 of the app's 578 activities are covered; about 160 app activities (mostly shooting, throwing games, speed and
mystery activities, wellness and night-out items) are not yet in the reference library.

The category targets in the first workbook added up to 545, not the 550 of the brief. Five categories (visual arts,
wood, adventure, knowledge, social) were raised by one so that the total is 550.

`npm run reflib:check` gives 0 errors and 0 warnings. That means the structure and spread rules hold, not that the
content is right: every record is still `Concept`, and the scores and reasons are an editorial judgement that no
one else has reviewed.

Known limits:

- "Science" (36% of activities, 128 discovery links), "history" and "stories" still carry the most discovery links
  (27% for the top three), so many bridges run through a few broad themes. Batches 1-3 were written before the
  narrower associations existed and could be re-pointed at them.
- Facets of the 131 new activities are estimates (`facets.source: authored`).
- Nothing here has been validated with users. Do not rank anything with the scores before a human has sampled them.
