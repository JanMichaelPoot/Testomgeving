# Testen met bekenden (via WhatsApp)

Gebruik dit voor een eerste groep van ± 10 mensen en later voor ± 50. Bijgewerkt op 14 november 2026 (Stap 180).

Doel: in een paar dagen zien of mensen het snappen, het boek goed vinden, er iets mee doen en er (denkbeeldig) voor zouden betalen,
zonder dat de rekening of de database ontspoort.

## Wat je vooraf regelt (één keer)

| # | Wat | Waarom |
|---|---|---|
| 1 | Migraties `0020_test_feedback_scores.sql`, `0021_test_quota.sql` en `0024_test_feedback_places_mail.sql` draaien in de Supabase SQL Editor (wat nog niet gedraaid is) | 0021: zonder die tabel werkt de limiet niet. 0020 en 0024: zonder die kolommen worden de nieuwere vragen (profiel, deuren, plekken, mail) niet bewaard; de site blijft werken en meldt het in de log |
| 2 | In Vercel: `TEST_MAX_BOOKS_PER_IP` = `2` (scope = de omgeving waar je test, hier meestal Production) en opnieuw deployen | zet de limiet aan |
| 3 | In Vercel: `NEXT_PUBLIC_TEST_FEEDBACK` = `1` en opnieuw deployen **zonder build-cache** | de vragenlijst onder het boek |
| 4 | `windowinto.nl` verifiëren in Resend en `EMAIL_FROM` op `WindowInto <hello@windowinto.nl>` zetten | met `onboarding@resend.dev` kan Resend alleen naar jouw eigen adres mailen: je vrienden krijgen dan geen mail met de PDF |
| 5 | `/admin` → *Instellingen van deze deployment* controleren: alles groen, en **`STRIPE_MODE` staat op "test"** | de testkaart werkt alleen in Stripe-testmodus; staat daar "LIVE", dan betalen testers echt €7,50. Gebruik dan een Preview-omgeving met `sk_test_`-sleutels (zie `docs/test-preview.md`). De gele testbalk bij het betaalblok verschijnt alleen in testmodus |
| 6 | `/admin` → *Opruimen*: alle oude testgegevens verwijderen (datum van gisteren) | de cijfers gaan dan alleen over deze test |
| 7 | Anthropic: een bestedingslimiet of waarschuwing instellen (console.anthropic.com → Limits) | vangnet voor het geval er iets doorschiet |
| 8 | PostHog: een funnel maken (zie `docs/analytics-events.md`) | laat zien waar mensen afhaken |
| 9 | Zelf een volledige testbestelling doen als laatste controle (inclusief de mail) | |

Jij zelf: log in op `/admin` in de browser waarmee je test. Zolang je daar bent ingelogd (8 uur), telt wat jij maakt niet mee voor de limiet.

Een betaling overslaan kan niet meer (die knop is op 30 oktober 2026 verwijderd): testers betalen met de Stripe-testkaart, dat test ook de volledige betaalroute en de mail.
Betalingen blijven in de testomgeving op "pending" staan zolang de Stripe-webhook niet is ingesteld; dat is voor deze test geen probleem.

## Kosten (richtlijn)

Een boek kost sinds de zoekrondes van Stap 177 meer dan de oude $0,15 à $0,20: gemeten **$0,39** voor een boek waarvan een deel van het zoekwerk al in de cache zat
(7 van de zoekopdrachten); een boek met een nieuwe plaats of nieuwe ideeën kost waarschijnlijk $0,6 à $0,8 (geschat, niet gemeten). Reken daarom met **$0,8 per boek als worstcase**.
Bij 10 mensen met elk 2 boeken is dat maximaal 20 boeken, dus **± $16 in het slechtste geval** (waarschijnlijk $6 à $10). Bij 50 mensen met elk 2 boeken loopt dat op tot $80:
zet dan eerst de limiet op 1 boek per verbinding of wacht op goedkopere zoekrondes. De limiet per internetverbinding is je kostenplafond (families of kantoren delen één verbinding,
dat valt in jouw voordeel). Controleer vooraf of het tegoed in de Anthropic-console ruim genoeg is.

## In drie golven uitnodigen

1. **3 mensen eerst** (een dag). Let op: loopt alles goed, komt de mail aan, snappen ze de testbetaling? Pas aan wat misgaat.
2. **De overige 7** (bij 50 mensen: ± 15, twee dagen). Kijk op `/admin` naar Overzicht (mislukt, blijft hangen, e-mail) en Feedback.
3. **Bij een grotere groep: de rest.** Daarmee voorkom je dat 50 mensen tegelijk dezelfde bug raken, en dat de Claude-aanroepen tegelijk tegen een snelheidslimiet lopen.

## Het bericht voor WhatsApp

Kopieer, vervang `LINK` door het adres van je site. Stuur het persoonlijk (niet in een grote groep): je krijgt veel meer reacties.
Leg bewust niet méér uit dan hieronder: wat iemand zelf niet snapt, is precies wat je wilt zien.

> Hoi {naam}! Ik heb een app gebouwd en jij mag hem als een van de eersten proberen. 🙂
> WindowInto laat je zien wat er mogelijk is: je kiest een paar beelden, vertelt kort wat er speelt, en krijgt een persoonlijk boekje met zes ideeën (en een wildcard) met bij elk idee echte plekken in jouw buurt en een eerste stap.
>
> Dit is een testversie, dus je betaalt niet echt:
> 1. Ga naar LINK en klik op "Open je venster". Het kost een paar minuten. Het werkt het mooist op je telefoon.
> 2. Bij het afrekenen gebruik je de testkaart **4242 4242 4242 4242**, een willekeurige toekomstige datum en een willekeurige drie cijfers. Er wordt niets afgeschreven. Gebruik je eigen e-mailadres: daar komt je boek met de PDF.
> 3. Het maken van je boek duurt een paar minuten. Blijf gerust even kijken.
> 4. Onder je boek staan acht korte vragen. Vul ze meteen in, zolang het vers is, dat helpt me het meest. Zet je voornaam erbij in het laatste vakje, dan kan ik je later nog iets vragen.
>
> Je kunt twee boeken maken (bijvoorbeeld een voor jezelf en een voor een ander, door bij het begin "voor iemand anders" te kiezen).
> Merk je iets geks, of loopt iets vast? Stuur me gewoon een berichtje met een screenshot. Dankjewel!

Engelse versie voor Engelstalige vrienden:

> Hi {name}! I've built an app and you get to be one of the first to try it. WindowInto shows you what's possible: you pick a few images, tell it briefly what's going on, and get a personal little book with six ideas (and a wildcard), each with real places near you and a first step.
> It's a test version, so you won't really pay: go to LINK, click "Open your window" (works best on your phone), and at checkout use the test card **4242 4242 4242 4242** with any future date and any three digits. Use your own e-mail address, that's where your book and its PDF arrive. Making the book takes a few minutes, feel free to watch.
> Under your book there are eight short questions: please fill them in right away, while it's fresh, and add your first name in the last box so I can ask you something later. You can make two books. If anything looks off or gets stuck, send me a screenshot. Thank you!

## Wat je tijdens de test bekijkt

- **`/admin` Overzicht**, elke ochtend: mislukte of hangende boeken, e-mail verstuurd (moet ± 100% zijn), duur per boek, hoeveel verbindingen hun limiet bereikten.
- **`/admin/feedback`**: pas conclusies trekken vanaf ± 20 antwoorden; lees de opmerkingen (zie de uitleg op die pagina). Kijk bij `De plekken` en `Is de mail aangekomen?`: een lage plekkenscore betekent dat de aanbieders niet bestaan of niet passen. Controleer dan zelf twee of drie plekken uit dat boek.
- **Wie de enquête niet invult**: de vragenlijst staat alleen onder het boek. Wie eerder afhaakt, ziet hem nooit. Vraag mensen die niet bij het boek kwamen persoonlijk waar ze stopten, en kijk in PostHog bij welk scherm.
- **`/admin/inhoud`**: of de motor genoeg variatie geeft en welke richtingen en beelden men kiest.
- **PostHog**: waar mensen in de intake afhaken.
- Vraag 5 tot 8 mensen persoonlijk hoe het was (bij 10 testers: ze allemaal); de vragenlijst vertelt wat, een gesprek vertelt waarom.

## Als iemand tegen de limiet aanloopt

Een vriend die zegt "ik kan geen boek meer maken" heeft twee boeken gemaakt, of deelt zijn internetverbinding (huisgenoten, kantoor, soms mobiel netwerk)
met iemand die er al twee maakte. Zo laat je hem door: `/admin` → *Opruimen* → vink alleen **Tellers van de testlimiet** aan (de boeken zelf blijven) en wis ze.
Dat geeft iedereen weer het volle aantal; doe het dus liefst eenmalig voor een groep, niet voor één persoon.

## Na de test

`/admin` → *Opruimen*: kies de dag vóór je echte start en wis de testgegevens (testboeken, feedback, logboek, tellers). Zet daarna `TEST_MAX_BOOKS_PER_IP` weg of op `0`
en zet `NEXT_PUBLIC_TEST_FEEDBACK` uit, tenzij je de vragenlijst wilt houden. Let op: de knop "Betaling overslaan" op de betaalpagina staat nog voor iedereen aan;
haal die weg (of zet hem achter een vlag) vóór de echte lancering.

## Zelf onbeperkt testen

Ben je niet ingelogd op `/admin` in de browser waarmee je test, dan tel je mee als iedereen. Twee manieren om onbeperkt te zijn:
1. Log in op `/admin` in die browser (werkt per browser).
2. Zet je eigen adres in Vercel in `TEST_QUOTA_EXEMPT_IPS` (komma-gescheiden) en deploy opnieuw. Op `/admin`, in het blok "Testlimiet", staat je adres zoals de server het ziet; dat kan een IPv6-adres zijn en dus anders dan wat een "wat is mijn IP"-site toont. Zet het adres uit het admin-blok erin (en eventueel allebei).
