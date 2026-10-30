# Cadeaubon, follow-up e-mail en prijstest (verbeterbrief, Fase 4)

Dit document is voor jou: wat er is gebouwd, wat je eenmalig moet instellen, hoe je het in testmodus van begin tot eind doorloopt, wat een jurist
moet nakijken en wat bewust nog niet kan.

## 1. Wat er is

**Cadeaubon (B3)**
- `/cadeaubon`: de gever betaalt **€14,95** (D5, standaard overgenomen; het boek voor jezelf blijft €7,50), vult optioneel de voornaam van de ontvanger,
  de eigen naam, een bericht (max. 280 tekens) en een e-mailadres in. Twee verplichte vinkjes: de Algemene Voorwaarden en de directe digitale levering.
- Na betaling: `/cadeaubon/klaar` toont de code (`WIN-XXXX-XXXX-XXXX`), een kaart om te downloaden (A5, of A6 = precies de helft), een deelbare link
  (`/cadeau/<code>`), een knop voor WhatsApp, en dezelfde gegevens staan in een mail aan de gever met de kaart als PDF-bijlage.
- De ontvanger opent de link (of typt de code op `/cadeau`), ziet de groet en het bericht van de gever, drukt op "Open je venster" en doet de intake
  zelf. Op het laatste scherm staat in plaats van de betaalknop "Open mijn venster". Het boek is voor de ontvanger gratis.
- Een code is **eenmalig te gebruiken en 12 maanden geldig** (vanaf het moment van betalen). Inwisselen is één voorwaardelijke databasewijziging: twee
  tegelijk kan nooit allebei lukken (getest). Mislukt er iets ná het claimen, dan wordt de code teruggegeven: nooit verbrand zonder boek.
- Het boek van de ontvanger opent met een eigen geheim (`/plan?gift=<token>`), niet met de code: de gever kent de code en kan het profiel van de
  ontvanger dus niet lezen.
- Een volledige terugbetaling (Stripe-event `charge.refunded`) maakt een nog niet ingewisselde bon ongeldig.

**Follow-up e-mail (B5)**
- Op de betaalpagina een schakelaar "Mail me over zes weken één keer: tijd voor een nieuw venster?", standaard uit, los van de twee verplichte vinkjes.
- Alleen met die toestemming wordt het adres bewaard (`window_plans.followup_email`) en gaat er **één** mail (`/api/cron/followup`, dagelijks 09:30) 42 dagen
  na het boek. Naar het adres van wie betaalde, nooit naar een cadeau-ontvanger die niets toestemde. Een ontvanger van een bon kan zelf toestemming geven
  bij het inwisselen.
- De knop in de mail (`/nieuw-venster?t=…`, ondertekend) start een verse intake en onthoudt welk boek al ontvangen is, zodat die ideeën er niet nog eens
  in komen (via de bestaande `history` van de selectiemotor). Onderaan staat een afmeldlink (`/afmelden?t=…`).

**Prijstest (B6)**: zie §5. Standaard uit.

**Seizoenseditie**: de voorbereiding (§6). Standaard uit en nergens zichtbaar.

## 2. Eenmalig instellen

1. **Migratie `supabase/migrations/0022_gift_vouchers_followup_pricing.sql`** uitvoeren in de Supabase SQL-editor. Zonder die migratie blijft de site
   werken (betalen van een boek valt dan terug op de oude kolommen), maar de cadeaubon geeft op `/cadeaubon` een nette foutmelding en de follow-up blijft uit.
2. **Controleer het daarna** (kost niets, laat niets achter):
   ```bash
   npx tsx --env-file=.env.local scripts/voucher-smoke.ts
   ```
   Elke regel moet `PASS` zijn. Het script maakt een wegwerp-bon, laat hem door alle toestanden lopen (ook twee gelijktijdige inwisselpogingen) en ruimt alles op.
3. **Stripe-webhook** (Developers → Webhooks → jouw endpoint `/api/stripe/webhook`): luister naar `checkout.session.completed`,
   `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` en nieuw: **`charge.refunded`**.
   De eerste activeert een betaalde bon ook als de gever het tabblad sluit voor Stripe hem terugstuurt.
4. **Vercel**: `CRON_SECRET` (aanbevolen: zonder staat de cron-route open), en het mailadres: `EMAIL_FROM` moet bij een in Resend **geverifieerd domein** horen,
   anders komt de bon-mail (en de follow-up) alleen aan op het adres van je eigen Resend-account.
5. Optioneel: `PRICE_TEST` en `SEASONAL_EDITION` (zie §5 en §6). Beide mogen leeg blijven.

## 3. Doorlopen in testmodus (Stripe testsleutels)

1. Open `/cadeaubon`, vul "Judith" / "Jan" / een bericht in, vink beide vakjes aan, betaal met de Stripe-testkaart `4242 4242 4242 4242`.
2. Je komt op `/cadeaubon/klaar`: de code staat er, de kaart downloadt (A5 en A6), de mail met bijlage is onderweg (controleer je inbox of Resend → Emails).
3. Open de link in een **ander browserprofiel** (of privévenster): groet, bericht en de knop "Open je venster".
4. Doorloop de intake. Op het laatste scherm staat "Judith, je cadeaubon is geldig". Vink de voorwaarden aan, druk op "Open mijn venster".
5. Het wachtscherm en daarna het boek verschijnen. In `/admin/orders` staat een order van €14,95 ("cadeaubon") en een order van €0,00 ("boek (bon)").
6. Probeer de code nog eens te gebruiken (andere browser): "Deze cadeaubon is al ingewisseld."
7. Volledige terugbetaling van een niet-ingewisselde test-bon in het Stripe-dashboard → de bon wordt ongeldig (vereist de webhook uit §2.3).

Het testen van de follow-up zonder zes weken te wachten: zet bij een boek in de database `followup_email` op je adres en `created_at` op meer dan 42
dagen geleden, en roep de route aan: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/followup`.

## 4. Laat dit juridisch nakijken vóór je live gaat

Alle nieuwe teksten staan in `src/lib/i18n/gift.ts`. Ik ben geen jurist; dit zijn de punten waar ik een tekst heb moeten *bedenken* voor een nieuw product:

1. **Herroepingsrecht bij een cadeaubon** (`buy.consentBody`, `buy.consentLabel`, `email.footer`). De tekst zegt: de gever krijgt de bon direct; het boek wordt
   pas gemaakt bij inwisselen; herroepen kan 14 dagen zolang de bon niet is ingewisseld; dat recht vervalt zodra de ontvanger inwisselt en het boek is geleverd.
   De toestemming wordt vastgelegd in dezelfde tabellen als bij een boek (`terms_acceptance`, `digital_delivery_consent`), met de hash van déze tekst.
2. **De Algemene Voorwaarden** noemen de cadeaubon (geldigheid, eenmalig, terugbetaling, wat bij verlies van de code) nog **niet**. Ik heb de voorwaarden bewust
   niet aangeraakt. Ontvanger die inwisselt vinkt de bestaande voorwaarden aan, maar die gaan over een betaald boek.
3. **Privacyverklaring**: de naam van de ontvanger, het bericht en het e-mailadres van de gever/ontvanger worden bewaard (`gift_vouchers`); voor de follow-up
   wordt één e-mailadres per boek bewaard tot de mail is verstuurd of iemand zich afmeldt. Retentie van `gift_vouchers` is niet geregeld (nu: blijft staan).
4. **Follow-up mail**: valt onder toestemming (opt-in, aparte schakelaar, niet voorgevinkt, intrekbaar). Beoordeel of de huidige tekst genoeg is.
5. **Serverevent `gift_voucher_purchased`/`gift_voucher_redeemed`/`followup_*`** gaan zonder cookietoestemming naar PostHog (zonder persoon, zonder tekst),
   net als `payment_succeeded`. Past dat bij de cookiebanner? Zo niet: haal de `trackServerEvent`-aanroepen weg.
6. **Btw**: zie §5 over "prijzen inclusief btw".

## 5. Prijstest (B6)

Standaard **uit**: iedereen ziet en betaalt €7,50 (boek) en €14,95 (bon), niets wordt vastgelegd. Aanzetten kan alleen met de Vercel-variabele `PRICE_TEST`,
JSON met de *andere* varianten (de rest van de bezoekers is de "control" op de gewone prijs):

```
PRICE_TEST={"B":{"self":650,"gift":1295},"C":{"self":850}}
```

- Bedragen zijn **eindbedragen in centen** (100 t/m 10.000). Een fout (geen JSON, `7.5` in plaats van `750`) zet de hele test uit; `/admin` zegt dat.
- Een bezoeker krijgt **één keer** een variant, in een cookie (`window_price_variant`, 30 dagen), en ziet overal dezelfde prijs: landing, veelgestelde vragen,
  betaalpagina, Stripe en de order. De prijs die wordt afgerekend bepaalt de server uit dat cookie (nooit uit wat de pagina stuurde).
- Het cookie wordt **pas na toestemming voor analytics** gezet (een prijstest is geen noodzakelijk cookie) en verdwijnt bij weigeren. Wie niet toestemt, is control.
  De pagina ververst zichzelf eenmaal na de toestemming, zodat de prijs klopt.
- Vastgelegd: `payments.price_variant` (zichtbaar in `/admin/orders`) en de eigenschap `price_variant` op `checkout_viewed`, `pay_clicked`, `checkout_pay_clicked`,
  `payment_succeeded`, `gift_voucher_viewed`, `gift_voucher_pay_clicked` en `gift_voucher_purchased` (`none` = test uit, `control`, of de variant).
- **Lezen in PostHog**: vergelijk per variant het aantal `checkout_pay_clicked` (of `gift_voucher_pay_clicked`) met `payment_succeeded` / `gift_voucher_purchased`.
  Let op: server-events kunnen bewust niet aan dezelfde bezoeker worden gekoppeld; vergelijk dagtellingen per variant, niet individuele trechters.
- **Prijzen en btw**: de brief zegt "prijzen altijd inclusief btw". De code behandelt elk bedrag als het bedrag dat de klant betaalt, maar toont nergens "incl. btw" en
  rekent geen btw uit. Of "incl. btw" waar is hangt af van jouw btw-situatie (btw-plichtig of de kleineondernemersregeling); dat staat nergens in de code en
  `src/lib/company.ts` heeft (nog) geen btw-nummer.
- Wil je tijdens een test een prijs aan één kant verhogen en aan de andere verlagen, zet dan beide in dezelfde `PRICE_TEST`.

## 6. Seizoenseditie (voorbereiding)

`SEASONAL_EDITION=1` zet het aan; zonder die variabele wordt alles hieronder genegeerd. Dan kan de follow-uplink `?season=winter|spring|summer|autumn` dragen
(`/nieuw-venster?t=…&season=winter`): het volgende boek wordt geschreven voor die periode (de zoekopdrachten, de seizoensfilter en de datum in de prompt gebruiken
de 15e van de middelste maand van dat seizoen, of vandaag als het al dat seizoen is). Er is nog geen mail of knop die dat doet; dit is de voorbereiding.

## 7. Bewust nog niet gebouwd

- Geen aparte pagina om een bon opnieuw te mailen of de code terug te vinden; de gever heeft de mail en de `/cadeaubon/klaar`-link.
- Geen admin-overzicht van bonnen (alleen de orders met "cadeaubon"/"boek (bon)" en de variant). Wil je een lijst met status per code, dan is dat een kleine uitbreiding.
- Geen rate limit op het raden van codes (59 bits, praktisch niet te raden). Bij misbruik: Vercel's firewall op `/cadeau/*`.
- Geen QR-code op de kaart (nieuwe afhankelijkheid; de kaart toont het adres en de code).
- Geen retentieregel voor `gift_vouchers`.
