# WindowInto: compact product reference

Source of truth for building explainer modules (a short film, a deck, social clips, a pitch page). Written 2026-11-04 from the code at commit `890457c` plus the log in `CLAUDE.md`. Facts only; where something is not live or not proven, it says so. UI copy exists in Dutch (default) and English; both are quoted where it matters.

## 1. One line

**WindowInto** (brand shown as WINDOW / "WindowInto", site windowinto.nl) turns a few images you tap into a personal book of five real-world things to try near you.

- Tagline: *"A Window Into What Could Be"*
- Core promise: *"You don't need another answer. Sometimes you need to see another possibility."*
- Homepage headline (NL): *"Wat als je iets ontdekt waarvan je nog niet wist dat het bij je past?"* EN: *"What if you discover something you didn't know suited you?"*
- Plain-language pitch: "Pick a few pictures. We make a personal book out of it, with real places near you."
- Tone: intelligent, curious, warm, a little mischievous. Closer to a premium travel magazine than a productivity dashboard. Informal "je" in Dutch.

## 2. Who it is for, and the problem

- People who feel stuck, bored, or ready for something new but cannot say what ("I don't know what I want to do with my free time").
- Also people searching for someone else (a child or young person, another adult, a group). The start screen asks who the search is for; the book is then written to that person or group.
- The problem: a search engine needs a question, and these people do not have one. Questionnaires feel like homework. Lists of top results are generic.
- The idea: show images, read taste from what you pick, then turn taste into concrete, local, doable activities.
- Netherlands only for now (places come from Dutch search; location suggestions use PDOK). No account needed.

## 3. The journey (what a user sees, in order)

Total: about **3 minutes** to fill in, then **1 to 2 minutes** to build the book. One language setting (NL/EN toggle in every header) drives UI and book.

| # | Screen | What happens | Key copy / detail |
|---|---|---|---|
| 0 | **Landing** | A realistic sliding-sash window (8 panes, oak frame, stone sill) opens pane by pane, each pane a different photo, one swaps softly every few seconds. One button. | Button: "Open je venster" / "Open your window". Below: four differentiators, sample book pages, trust block, FAQ. |
| 1 | **Start** | Who is this for (myself, child/young person, another adult, a group, not known yet; optional first name). Place (autocomplete) and travel distance (5 to 100+ km slider). Optional: time, budget per person (tot €10 to €200 or "maakt niet uit"), "what must be right" chips (only outdoors/indoors, by public transport, evenings, no group, vegetarian...). | Only the place is required. |
| 2 | **Images** | 18 photo cards at once (3 columns), one variant per family, mixed from place/moment/sense images. Tap what draws you. "Other images" gives a new set (up to 3 sets, previous sets reachable). 3 to 8 picks. "Surprise me" option. | "Welke beelden maken je nieuwsgierig?" No right or wrong answers. Cards carry no text about activities. |
| 3 | **Activities** | 18 concrete activities that sit close to the picks (3 are "maybe also?" explorations from other directions). Pick up to 8, or "let us choose". | "Zin om dit eens te proberen?" |
| 4 | **Profile** | The window now shows the picks. A short, warm reading of what the choices say ("Je houdt van ..., en van ..."), the red thread, a direction. Sliders and extras tucked behind "Bekijk en stuur bij". The order block sits at the bottom of this same screen. | A short AI-written reading, with fixed text as fallback. Never labels or diagnoses a person. |
| 5 | **Pay** | Price, what you get, optional different e-mail address, optional "this is a gift" (recipient e-mail), optional follow-up consent, two required checkboxes (disclaimer and waiver of the 14-day right of withdrawal because delivery is immediate), pay button to Stripe Checkout. | Price **€7,50** per book. iDEAL/cards via Stripe only after dashboard setup (see `docs/live-gaan.md`). |
| 6 | **Waiting** | Honest progress: your choices read, places looked up, ideas written, book laid out. Counts appear when known ("5 deuren gekozen"). | After about 2 minutes shows a calm "taking longer than usual" note. |
| 7 | **Your book** (`/plan`) | Echo of what you said, the one idea to start with, four doors of cards, a sealed wildcard you open, download PDF, share, heart ideas, "this is the one I will do". | See section 4. |
| 8 | **Afterwards** | Book also by e-mail with the PDF attached. Optional reminder with the first action after a few days; optional follow-up mail after about six weeks. | Both only with consent, one mail each. |

## 4. What is in the book

**Structure:** 4 ideas + 1 wildcard, ordered by distance from you, called **doors** (never "levels" in the UI):

1. **Vertrouwd / Familiar** (1): close to what you already do, worked out a little better.
2. **Ontdekking / Discovery** (1): fits what you enjoy, not tried yet.
3. **Onverwacht / Unexpected** (1): surprising at first, until you read why it fits.
4. **Uitdaging / Stretch** (1): just outside your comfort zone, still doable.
5. **Wildcard** (1): "the idea we shouldn't really suggest. But do anyway." Sealed until you open it.

**Per idea:** why it fits you (refers back to what you chose), time, level, an experience profile (five dimensions), a possible plan, three ways to start (**taste** about an hour, **do** half a day, **go further** weekend or course), cost and duration, **real places near you** with a map link and, where found, a rating that a search result actually showed, a first step you can do within a minute, and "ook in deze richting" (related ideas). A thread shows how your picks led here ("Zo kwamen we hierop").

**Formats:** the web page, a designed PDF (7 pages minimum, up to about 12 with the extra layer; ivory paper, gold lines, Cormorant Garamond headings), and an e-mail with the PDF attached.

**Free, before paying:** your window (the image collage) and the profile reading, including a downloadable window image. **Paid:** the book.

## 5. How it works (plain words, for a voice-over)

- **Images are a language.** 342 image cards in 114 families (place, moment, sense), each family with 3 look-alike variants, so what we read never depends on which photo you saw. Each card carries weighted tags (nature, craft, precision, silence ...) and axes (social, energy, indoor/outdoor, familiar/new).
- **A library of activities.** About **578 activities** across **21 directions** (craft, sport, music, travel, food, mystery, helping, growing, style ...), each with tags, social form, level, cost, duration, season, and what supervision it needs. Activities that need supervision are only offered through an accredited provider, with an instructor.
- **A selection engine that follows rules, not luck.** It picks five: your own choices come first (up to two), then one neighbouring idea, one surprising idea built from a curated combination, and a wildcard. Hard limits are never broken: budget, indoors/outdoors, season, supervision, who the search is for. A grown-up activity is never offered to a child.
- **Real places.** For the chosen ideas, an AI with web search looks up providers near you, drops anything whose website does not exist or does not mention the offer, prefers well-rated ones, and says so when nothing is found. A second round looks for online or national options so every idea has something concrete.
- **Writing.** A second AI call writes the text per idea from those facts, then a quality gate removes visible machinery, repeated sentences, and season or setting contradictions, and repairs them.
- **Cost reality (internal):** roughly $0,15 to $0,35 in AI cost per book (hard ceiling $0,50), against a €7,50 price. Do not put this in public material.

## 6. Pricing and products

- **Book:** €7,50 once, one purchase per book, no subscription, no account.
- **Gift voucher:** €14,95 (card with a code, redeemable for one book, valid 12 months). Built and working, **deliberately not offered on the homepage, menu or footer right now**; direct link only.
- **Follow-up:** an optional "time for a new window?" mail, about six weeks later. The next book avoids repeating earlier ideas.
- **Guarantee:** "Klopt een plek niet? Je krijgt een extra kortingscode van €2,50 als compensatie." (Mail info@vantagelabs.nl; sent from the admin, Step 235.)

## 7. Visual identity (for matching a film or deck)

- **Site palette "Warm Walnut":** walnut `#5B3F2F`, dark walnut / primary button `#3C2920`, secondary `#A98262`, background `#F7F5F0`, surfaces `#FFFDFA`, text `#202020`, muted `#77736C`, border `#DED8CE`, selected fill `#F2ECE1`. Gold `#B08A4A` only as a restrained accent.
- **Type:** Newsreader (serif) for landing headlines; Plus Jakarta Sans for everything else. PDF uses Cormorant Garamond for titles.
- **Shapes:** radius 8 / 12 / 18 px, 1 px borders, no heavy shadows, no glow effects.
- **Recurring motif:** the window frame. It is the hero, the intake panel that fills as you choose, the PDF cover, and the share card. Panes number 3 to 24, one per choice; the layout style (sliding sash, transom window, large glass) depends on how broad the taste is.
- **Photography:** photorealistic, warm, no people or faces in the card images, no readable text on cards. AI-generated (Gemini) from own prompts.
- **Logo:** two overlapping rounded squares in an orange-to-blue gradient, wordmark "Window" + gradient "Into".

## 8. Asset map (reuse, do not regenerate)

| Need | Where |
|---|---|
| Logo | `public/logo/`, `windowinto-cream.png` |
| Hero window textures (oak, plaster, stone) | `public/illustrations/hero-window/` |
| 342 association card photos | `public/illustrations/associations/` |
| Activity photos (578) and direction photos | `public/illustrations/discovery/` |
| Sample book pages (NL/EN: cover, profile, idea 1, idea 2) | `public/examples/spreads/*.jpg` |
| Full sample books | `public/examples/idea-book-nl.pdf`, `idea-book-en.pdf` |
| Share cards (story 1080x1920, square 1080x1080) | route `/share-card/story-nl`, `/share-card/square-en`, ... |
| Window as an image for any choice set | route `/api/window-image?c=<ids>` |
| Image licence record | `src/lib/imageProvenance.json` (3 images still marked "confirm") |

Note: the sample book is a real generation for a Dutch profile (a real town and real places). Using it in a film shows real output, but check that you are happy to show that profile.

## 9. Claims you must not make

- Not "verified places" or "checked opening hours". The honest line: "We look places up on the web and check that their website exists." Opening hours and addresses are not checked against a structured source.
- No reviews or testimonials exist yet. The site says so. Do not invent any.
- Not medical, therapeutic, financial or legal advice (disclaimer shown before payment).
- Not "personalised by an algorithm you can trust blindly": the book is made with AI and says so ("Gemaakt met AI").
- Netherlands only. No app. No account. No social features beyond a simple share link.
- Do not name the internal "levels" or any person's label (age, "senior"). Doors only.
- Never imply a free book; the window and profile are free, the book costs €7,50.

## 10. Suggested 75-second explainer (modules to build from)

| Beat | Time | Picture | Voice-over (EN draft) |
|---|---|---|---|
| 1 Hook | 0 to 8 s | Empty window, cream wall | "Ever felt ready for something new, but have no idea what?" |
| 2 Problem | 8 to 18 s | Search bar blinking, blank | "A search engine needs a question. You don't have one yet." |
| 3 Images | 18 to 33 s | 18-photo grid, taps, panes of the window fill | "So we start with pictures. Tap what draws you. No right or wrong." |
| 4 Reading | 33 to 43 s | Profile screen, one warm sentence | "We read what your choices say about you, and show it back." |
| 5 Book | 43 to 62 s | Four doors, a sealed wildcard, a map link, "first step" | "Seven ideas, from familiar to unexpected, with real places near you and a first step you can take today." |
| 6 Honest | 62 to 70 s | PDF page, small print "made with AI" | "Made with AI, from places we look up. If one is wrong, you get a new book." |
| 7 CTA | 70 to 75 s | Logo, button "Open je venster", price | "Open your window. €7,50." |

Module split that works: (a) hook + problem, (b) the three-tap demo, (c) the book tour, (d) trust + price, (e) end card. Each is reusable as a separate clip.

## 11. Where to read more

`CLAUDE.md` (full build log), `docs/product-reference.md` (this file), `docs/discovery-engine.md` (selection engine), `docs/analytics-events.md` (metrics), `docs/live-gaan.md` (going live), `docs/cadeaubon.md` (voucher), `docs/centrale-intake.md` (start page and audience), `reference-library/` (separate, unconnected activity reference library, not used by the app).
