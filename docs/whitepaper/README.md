# WindowInto productwhitepaper

Het productwhitepaper, de bewerkbare versie, de diagrammenbijlage en de bevindingenlijst, alles gebouwd uit één bron.
Basis: de broncode van branch `site-optimalisatie`, commit `0844364`, 13 november 2026.

## Wat staat hier

| Bestand | Wat |
|---|---|
| `WindowInto-whitepaper.pdf` | Het complete whitepaper (± 81 pagina's, met inhoudsopgave en paginanummers) |
| `WindowInto-whitepaper.docx` | Bewerkbare versie (Word; open en werk de velden bij met Ctrl+A, F9 voor de inhoudsopgave) |
| `WindowInto-whitepaper.html` | Dezelfde inhoud als één zelfstandig HTML-bestand |
| `WindowInto-diagrammenbijlage.pdf` | Alle 21 diagrammen, elk op een eigen pagina |
| `diagrammen/` | Elk diagram als `fig-<id>.png` (2,5x) en `.svg` |
| `WindowInto-bevindingen.pdf` en `.md` | Beknopte technische bevindingenlijst (26 bevindingen) |
| `src/` | De bron en de bouwscripts |

## Opnieuw bouwen

```bash
cd docs/whitepaper/src
npm install          # alleen de eerste keer (docx, pdfjs-dist, mammoth)
node verify.mjs      # controleert alle getallen tegen de broncode (108 controles)
node build.mjs       # bouwt alles; draait Chromium via Playwright (al in het project)
```

De inhoud staat in `src/content-1.mjs` tot `content-5.mjs` (platte JavaScript-objecten, zie `dsl.mjs`), de diagrammen in `src/figs-a|b|c.mjs`
(getekend met `svg.mjs`), de bevindingen in `src/findings.mjs`. De getallen en voorbeelden komen uit `src/facts/`, gemaakt met de scripts in
`src/probe/` (draaien met `npx tsx` vanuit de root van de repository; gratis, geen API-aanroepen).

Hulpscripts voor het nakijken: `src/preview.mjs` (losse diagrammen), `src/pdf-preview.mjs` en `src/contact-sheets.mjs` (pagina's van een PDF).

## Afspraken

- Niets hier doet een betaalde aanroep. Het zoeken en schrijven van het boek is niet gedraaid; wat het whitepaper daarover zegt, komt uit de code en uit
  eerder gegenereerde meetboeken (`scratch/persona-books/`).
- De drie voorbeelden zijn fictieve personen met de echte motor. Pas `src/probe/scenarios.ts` aan en draai hem opnieuw om andere voorbeelden te maken.
- Een getal in de tekst dat niet meer klopt, laat `verify.mjs` falen: voeg bij een nieuwe bewering een controle toe.
