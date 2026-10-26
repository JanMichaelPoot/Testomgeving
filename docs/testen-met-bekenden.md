# Testen met ± 50 bekenden (via WhatsApp)

Doel: in een paar dagen zien of mensen het snappen, het boek goed vinden, er iets mee doen en er (denkbeeldig) voor zouden betalen,
zonder dat de rekening of de database ontspoort.

## Wat je vooraf regelt (één keer)

| # | Wat | Waarom |
|---|---|---|
| 1 | Migratie `supabase/migrations/0021_test_quota.sql` draaien in de Supabase SQL Editor | zonder deze tabel werkt de limiet niet (de site blijft werken, maar zonder limiet; er staat dan een waarschuwing in de log) |
| 2 | In Vercel: `TEST_MAX_BOOKS_PER_IP` = `2` (scope = de omgeving waar je test, hier meestal Production) en opnieuw deployen | zet de limiet aan |
| 3 | In Vercel: `NEXT_PUBLIC_TEST_FEEDBACK` = `1` en opnieuw deployen **zonder build-cache** | de vragenlijst onder het boek |
| 4 | `windowinto.nl` verifiëren in Resend en `EMAIL_FROM` op `WINDOW <hello@windowinto.nl>` zetten | met `onboarding@resend.dev` kan Resend alleen naar jouw eigen adres mailen: je vrienden krijgen dan geen mail met de PDF |
| 5 | `/admin` → *Instellingen van deze deployment* controleren: alles groen | je ziet meteen wat de draaiende site van zijn instellingen ziet |
| 6 | `/admin` → *Opruimen*: alle oude testgegevens verwijderen (datum van gisteren) | de cijfers gaan dan alleen over deze test |
| 7 | Anthropic: een bestedingslimiet of waarschuwing instellen (console.anthropic.com → Limits) | vangnet voor het geval er iets doorschiet |
| 8 | PostHog: een funnel maken (zie `docs/analytics-events.md`) | laat zien waar mensen afhaken |
| 9 | Zelf een volledige testbestelling doen als laatste controle (inclusief de mail) | |

Jij zelf: log in op `/admin` in de browser waarmee je test. Zolang je daar bent ingelogd (8 uur), telt wat jij maakt niet mee voor de limiet.

Let op: de knop "Betaling overslaan" op de betaalpagina is voor iedereen zichtbaar. Wie die gebruikt krijgt het boek op het scherm (met PDF-download) maar **geen e-mail**: de testmail van die knop gaat naar jouw eigen adres en wordt alleen verstuurd als jij zelf ingelogd bent. Vraag vrienden daarom de testkaart te gebruiken (zie het bericht hieronder); dat test ook de volledige betaalroute en de mail.
Betalingen blijven in de testomgeving op "pending" staan zolang de Stripe-webhook niet is ingesteld; dat is voor deze test geen probleem.

## Kosten (richtlijn)

Een boek kost ongeveer $0,15 à $0,20 aan Claude. Bij 50 mensen met elk 2 boeken is dat maximaal 100 boeken, dus ± $15 à $20. De limiet van twee boeken
per internetverbinding is dus ook je kostenplafond (families of kantoren delen één verbinding, dat valt in jouw voordeel).

## In drie golven uitnodigen

1. **3 à 5 mensen eerst** (een dag). Let op: loopt alles goed, komt de mail aan, snappen ze de testbetaling? Pas aan wat misgaat.
2. **± 15 mensen** (twee dagen). Kijk op `/admin` naar Overzicht (mislukt, blijft hangen, e-mail) en Feedback.
3. **De rest.** Daarmee voorkom je dat 50 mensen tegelijk dezelfde bug raken, en dat de Claude-aanroepen tegelijk tegen een snelheidslimiet lopen.

## Het bericht voor WhatsApp

Kopieer, vervang `LINK` door het adres van je site. Stuur het persoonlijk (niet in een grote groep): je krijgt veel meer reacties.

> Hoi {naam}! Ik heb een app gebouwd en jij mag hem als een van de eersten proberen. 🙂
> WINDOW laat je zien wat er mogelijk is: je kiest een paar beelden, vertelt kort wat er speelt, en krijgt een persoonlijk boekje met zeven ideeën (en een wildcard) met bij elk idee een echte plek en een eerste stap.
>
> Dit is een testversie, dus je betaalt niet echt:
> 1. Ga naar LINK en klik op "Open je venster". Het kost een paar minuten.
> 2. Bij het afrekenen gebruik je de testkaart **4242 4242 4242 4242**, een willekeurige toekomstige datum en een willekeurige drie cijfers. Er wordt niets afgeschreven. Gebruik je eigen e-mailadres: daar komt je boek.
> 3. Onder je boek staan zes korte vragen. Vul ze alsjeblieft in, dat helpt me het meest.
>
> Je kunt twee boeken maken (bijvoorbeeld een voor jezelf en een als cadeau voor iemand). Het werkt het mooist op je telefoon.
> Merk je iets geks, of loopt iets vast? Stuur me gewoon een berichtje met een screenshot. Dankjewel!

Engelse versie voor Engelstalige vrienden:

> Hi {name}! I've built an app and you get to be one of the first to try it. WINDOW shows you what's possible: you pick a few images, tell it briefly what's going on, and get a personal little book with seven ideas (and a wildcard), each with a real place and a first step.
> It's a test version, so you won't really pay: go to LINK, click "Open your window", and at checkout use the test card **4242 4242 4242 4242** with any future date and any three digits. Use your own e-mail address, that's where your book arrives. Six short questions under your book would help me most. You can make two books. If anything looks off, send me a screenshot. Thank you!

## Wat je tijdens de test bekijkt

- **`/admin` Overzicht**, elke ochtend: mislukte of hangende boeken, e-mail verstuurd (moet ± 100% zijn), duur per boek, hoeveel verbindingen hun limiet bereikten.
- **`/admin/feedback`**: pas conclusies trekken vanaf ± 20 antwoorden; lees de opmerkingen (zie de uitleg op die pagina).
- **`/admin/inhoud`**: of de motor genoeg variatie geeft en welke richtingen en beelden men kiest.
- **PostHog**: waar mensen in de intake afhaken.
- Vraag 5 tot 8 mensen persoonlijk hoe het was; de vragenlijst vertelt wat, een gesprek vertelt waarom.

## Als iemand tegen de limiet aanloopt

Een vriend die zegt "ik kan geen boek meer maken" heeft twee boeken gemaakt, of deelt zijn internetverbinding (huisgenoten, kantoor, soms mobiel netwerk)
met iemand die er al twee maakte. Zo laat je hem door: `/admin` → *Opruimen* → vink alleen **Tellers van de testlimiet** aan (de boeken zelf blijven) en wis ze.
Dat geeft iedereen weer het volle aantal; doe het dus liefst eenmalig voor een groep, niet voor één persoon.

## Na de test

`/admin` → *Opruimen*: kies de dag vóór je echte start en wis de testgegevens (testboeken, feedback, logboek, tellers). Zet daarna `TEST_MAX_BOOKS_PER_IP` weg of op `0`
en zet `NEXT_PUBLIC_TEST_FEEDBACK` uit, tenzij je de vragenlijst wilt houden. Let op: de knop "Betaling overslaan" op de betaalpagina staat nog voor iedereen aan;
haal die weg (of zet hem achter een vlag) vóór de echte lancering.
