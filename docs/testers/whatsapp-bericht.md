# WhatsApp-bericht voor de testers

Plaatje erbij: `docs/testers/whatsapp-testers.png` (1080 x 1350, logo, tagline). Stuur het plaatje met de tekst hieronder als bijschrift, dan is de link meteen aanklikbaar.

## Bericht (kopieer alles tussen de lijnen)

---
Hoi! 👋

Ik heb iets nieuws gebouwd en ik zoek een paar mensen die het willen uitproberen. Jij bent een van die mensen.

*WindowInto* maakt voor jou een persoonlijk ontdekkingsboek: je geeft aan wie je bent en waar je zin in hebt, en je krijgt 4 ideeën plus één wildcard terug, met echte plekken in jouw buurt. Gewoon even kijken wat er allemaal mogelijk is.

👉 *Probeer het hier:* https://www.windowinto.nl

*Zo gaat het:*
1. Open de link en volg de stappen (ongeveer 10 minuten).
2. Vul bij het laatste scherm je *e-mailadres* in. Je hoeft niets te betalen, het is een gratis testversie.
3. Na een paar minuten staat je boek klaar, en je krijgt het ook per *e-mail* met de PDF erbij.

📩 *Belangrijk:* helemaal *onderaan die e-mail* staat een knop met *"Vul de vragen in"*. Dat zijn acht korte vragen (2 minuten) en ik hoor er heel graag je mening bij: wat klopte, wat niet, en welk idee je echt gaat doen. Je mag alles overslaan wat je niet wilt beantwoorden. Daar leer ik het meest van.

Een paar kleine dingen:
• Komt de mail niet binnen? Kijk even in je *spam* of ongewenste e-mail.
• Het is een testversie, dus er kan nog iets haperen. Zie je iets raars, laat het me gerust weten.
• Je kunt maximaal 2 boeken maken.

Dank je wel, het betekent echt veel voor me! 🙏
---

## Korte versie (als je het in een groepsapp zet)

---
Hoi allemaal! Ik heb *WindowInto* gebouwd: een persoonlijk ontdekkingsboek met ideeën en echte plekken in jouw buurt. Willen jullie het testen? Het is gratis (ongeveer 10 minuten): https://www.windowinto.nl
Je krijgt je boek ook per mail. Onderaan die mail staat een knop "Vul de vragen in" (2 minuten): daar ben ik het meest mee geholpen. Kijk in je spam als de mail niet binnenkomt. Dank je wel! 🙏
---

## Voor jezelf, voor je het verstuurt
- De afzender van de mail is nu nog "WINDOW" (`info@vantagelabs.nl`). Wil je dat de testers "WindowInto" zien, zet dan `EMAIL_FROM` op Vercel op `WindowInto <hello@windowinto.nl>` en deploy opnieuw.
- Zet `TEST_MAX_BOOKS_PER_IP` op Vercel op `2` (en deploy opnieuw), anders klopt de zin "maximaal 2 boeken" niet.
- Doe zelf een proefbestelling met de gratis route, zodat je zeker weet dat de mail met de knop onderaan aankomt.
