# WindowInto — Fase 5 eindrapport: digitale PDF-verkoop, checkout & herroepingsrecht

Model C: de klant koopt één gepersonaliseerd digitaal PDF-product; de AI-gegenereerde opties zijn onderdeel van het personalisatieproces, geen aparte producten.

Alle onderstaande bestanden zijn gecommit naar het live project (`window-app`) op basis van de laatst bekende versie op schijf; er zijn geen bestaande wijzigingen overschreven.

---

## A. Geïmplementeerd

**Database (`supabase/migrations/0010_digital_sales_compliance.sql`, `0011_private_pdf_storage.sql`)**
- `products`-tabel (geseed met `windowinto-pdf`, €3,50, digitaal, PDF-levering).
- `payments` fungeert als het order-record: `order_number` (via `next_order_number()`-functie + sequence, race-conditionvrij) en `product_id` toegevoegd.
- `terms_acceptance` en `digital_delivery_consent`: append-only, order-gebonden, elk met versienummer en een sha-256-hash van de exact getoonde tekst (`consent_text_hash`) — zo blijft de precieze bewoording achter een versie verifieerbaar, ook als de i18n-tekst later per ongeluk wordt aangepast.
- `legal_documents`: lichte versie-registratie (type/versie/taal/actief) — geen database-CMS; de juridische tekst zelf blijft in `src/lib/i18n/dictionaries.ts`, gekoppeld via `src/lib/legal/versions.ts`.
- `window_plans` uitgebreid met `payment_id`, `generated_at`, `email_sent_at`, `pdf_version`.
- `window-plans` storage-bucket omgezet naar privé (was publiek met raadbaar pad — zie beveiligingsfix hieronder).

**Checkout & consent (`src/app/checkout/`, `src/components/window/CheckoutPanel.tsx`, `src/lib/consent.ts`, `src/lib/orderNumber.ts`)**
- Twee onafhankelijke, nooit vooraf aangevinkte checkboxen: (1) toestemming voor directe digitale levering + erkenning verlies herroepingsrecht (gecombineerd, toegestaan per de brief), (2) algemene voorwaarden. Knop pas actief als beide zijn aangevinkt.
- Server-side her-validatie in `createCheckoutSession` — de disabled-knop is alleen UX, geen beveiliging.
- Consent wordt weggeschreven vóór de redirect naar Stripe (na het aanmaken van de Checkout Session en het order-record, zodat het aan een specifieke order kan worden gekoppeld) — nooit pas na betaling. PDF-generatie gebeurt pas later op `/plan`, dus de vereiste volgorde ("geen levering vóór vastgelegde toestemming") is gegarandeerd. Dit is met een unit-test geverifieerd (zie F).
- IP-adres en user-agent worden vastgelegd bij het toestemmingsmoment (bewijswaarde bij een geschil).

**Herroepingsrecht (`src/app/herroepingsrecht/page.tsx`)**
- Losstaande, direct linkbare pagina (niet alleen een subsectie van `/terms`) — bereikbaar vóór betaling vanaf checkout, vanuit de footer, en vanuit de orderbevestigingsmail.
- Rechtsgrond: art. 6:230p BW, implementatie van art. 16 sub m Richtlijn 2011/83/EU — geverifieerd via websearch, niet aangenomen uit trainingsdata.

**PDF-downloadbeveiliging**
- **Correctie t.o.v. het Fase 2-voorstel**: een aparte geauthenticeerde downloadroute bleek niet nodig. Onderzoek van de code (niet alleen van het eerdere voorstel) liet zien dat `/shared/[id]` — de bewust publieke deelpagina — helemaal geen downloadlink toont; alleen de eigen `/plan`-pagina doet dat. Die pagina hanteert al een eigen autorisatie: toegang vereist een betaalde Stripe `checkout_session_id` (of een admin-`test_session_id`), geverifieerd tegen Stripe vóórdat de rij wordt opgehaald — niet een sessiecookie, want de gemailde link moet ook zonder cookie werken.
- `window_plans.pdf_url` bevat nu het kale storage-pad in plaats van een permanente publieke URL. `src/lib/pdfAccess.ts` (`getSignedPdfUrl`) zet dat pad om in een 1 uur geldige signed URL, vers gegenereerd bij elke render van `/plan`. Geen nieuwe route, geen nieuw aanvalsoppervlak — hergebruik van de bestaande, al-geverifieerde poort.

**Order aan Idea Book gekoppeld (`src/app/plan/data.ts`)**
- `window_plans.payment_id` wordt al bij het starten van generatie gezet (ook bij een mislukte generatie, voor traceerbaarheid).
- `generated_at` en `pdf_version` (constante, op te hogen bij toekomstige PDF-sjabloonwijzigingen) worden bij succesvolle generatie vastgelegd.
- `email_sent_at` wordt pas gezet ná bevestigde verzending — blijft `null` bij een mislukte e-mail, zodat admin een echt niet-afgeleverde bevestiging kan onderscheiden van een afgeleverde.

**Orderbevestigingsmail (`src/lib/email/windowPlan.ts`)**
- Toont nu: ordernummer, het daadwerkelijk in rekening gebrachte bedrag (niet de actuele prijsconstante — zie `formatAmount` in `src/lib/pricing.ts`, zodat een oude order altijd toont wat er toen echt is betaald), besteldatum, een expliciete vermelding van directe digitale levering, een herhaling van de gegeven toestemming (inclusief het verlies van het herroepingsrecht), de versie van de algemene voorwaarden met link, een link naar de herroepingsrecht-pagina, en de bedrijfsgegevens-footer.

**Admin: orderoverzicht + orderdetail (`src/app/admin/orders/`)**
- Nieuw overzicht van alle orders (betaalstatus, PDF-status, wel/niet akkoord + versie, herroeping erkend, e-mail verzonden), met per order een detailpagina die het volledige bewijs toont: geaccepteerde tekstversies, tijdstippen, IP/user-agent, en de sha-256-hash van de getoonde tekst. Hergebruikt de bestaande admin-login (één gedeeld wachtwoord) — geen nieuw authenticatiesysteem.

**Tests (Vitest, nieuw toegevoegd — zie `vitest.config.ts`, `package.json`)**
- 6 testbestanden, 25 tests, allemaal groen (zie sectie F).

**Bewust buiten scope gehouden (op uw expliciete keuze "Later")**
- "Mijn WindowInto → Mijn bestellingen" klantaccount met magic-link authenticatie. Vereist nieuwe infrastructuur (tokens, sessiebeheer) die geen onderdeel is van de wettelijk verplichte kern.

---

## B. Architectuurkeuzes & bewuste afwijkingen van het eerste voorstel

1. **Geen aparte PDF-downloadroute** (zie hierboven) — de bestaande `/plan`-autorisatie bleek voldoende en passender bij hoe de gemailde link al werkt.
2. **`payments` als orderrecord** in plaats van een nieuwe `orders`-tabel — er bestond al één rij per Stripe Checkout-poging.
3. **`legal_documents` als versie-wijzer, geen CMS** — de juridische tekst blijft in de i18n-dictionary; alleen versienummers en publicatiedata worden in de database bijgehouden.
4. **`window_plans` uitgebreid in plaats van een parallelle `digital_products`-tabel** — deze tabel vervulde die rol al (status, pdf_url, timestamps).
5. **Ordernummer via een Postgres-sequence + functie**, niet "tel de rijen + 1" in de applicatie — voorkomt dubbele nummers bij gelijktijdige checkouts.

---

## C. Juridische aandachtspunten voor review door een jurist

Onderstaande punten zijn bewust **niet** zelf opgelost met een aanname — ze zijn als vraag geformuleerd voor uw jurist.

**1. Bewaartermijn IP-adres/user-agent in `digital_delivery_consent`**
- *Waarom het ertoe doet*: een IP-adres is persoonsgegeven; AVG vereist een gerechtvaardigde grondslag én een bepaalde bewaartermijn, niet "voor altijd".
- *Huidige implementatie*: wordt vastgelegd, geen automatische verwijdering/anonimisering na verloop van tijd.
- *Voorstel voor de jurist*: is 5 jaar (de gangbare civielrechtelijke verjaringstermijn, art. 3:307 BW, als oriëntatiepunt) een redelijke bewaartermijn voor dit bewijsmateriaal, of moet dit korter?

**2. Bedrijfsgegevens in juridische teksten en de orderbevestigingsmail**
- *Waarom het ertoe doet*: `dict.legal.companyInfo` bevat bewust placeholders (`[Bedrijfsnaam] · [KvK-nummer] · [Vestigingsadres] · [Btw-nummer]`) — ik heb geen echte bedrijfsgegevens verzonnen.
- *Huidige implementatie*: placeholders, niet productie-klaar.
- *Voorstel*: dit moet vóór livegang worden ingevuld met de daadwerkelijke, correcte bedrijfsgegevens (verplicht op grond van art. 6:230m BW, informatieplicht bij overeenkomsten op afstand).

**3. Combineren van de twee toestemmingen in één checkbox**
- *Waarom het ertoe doet*: de compliance-brief stond toe dat "directe levering" en "verlies herroepingsrecht" in één checkbox worden gecombineerd, mits beide expliciet worden benoemd.
- *Huidige implementatie*: één checkbox met beide elementen letterlijk in de tekst (zie `digitalDeliveryConsentLabel` in de dictionary).
- *Voorstel*: laten bevestigen dat deze samenvoeging in de huidige bewoording voldoet, of dat een striktere lezing van art. 6:230p BW twee aparte vinkjes vereist.

**4. Cadeau-aankopen (gift flow) en herroepingsrecht**
- *Waarom het ertoe doet*: bij een cadeau geeft de kóper toestemming en verliest daarmee zijn/haar eigen herroepingsrecht, maar de ontvanger van het PDF is een andere persoon.
- *Huidige implementatie*: ongewijzigd t.o.v. de bestaande cadeauflow — alleen de koper doorloopt checkout en geeft toestemming.
- *Voorstel*: bevestigen dat dit juridisch correct is zolang de ontvanger nooit zelf een aankoopovereenkomst aangaat (wat hier het geval is).

---

## D. Privacy/AVG — minimale-gegevensprincipe per nieuw veld

| Veld | Waarom nodig | Bewaartermijn | Wie heeft toegang |
|---|---|---|---|
| `digital_delivery_consent.ip_address` | Bewijslast bij een geschil over herroepingsrecht | Onbepaald — **zie openstaand punt C.1** | Alleen service-role (server), zichtbaar voor admin via het nieuwe orderdetailscherm |
| `digital_delivery_consent.user_agent` | Idem, aanvullend bewijs | Idem | Idem |
| `*.consent_text_hash` | Verifieert exacte bewoording zonder de volledige tekst dubbel op te slaan | Zelfde als de order | Idem |
| `window_plans.payment_id/generated_at/email_sent_at/pdf_version` | Operationele traceerbaarheid van levering, geen nieuw type persoonsgegeven | Zelfde als het bestaande `window_plans`-record | Idem |

Er is bewust **geen** koppeling gelegd tussen deze nieuwe tabellen en de bestaande, opzettelijk geanonimiseerde `audit_log` — die blijft ongewijzigd en niet herleidbaar, zoals in de oorspronkelijke migratie is vastgelegd.

---

## E. Webhook-idempotentie

De Stripe-webhook (`src/app/api/stripe/webhook/route.ts`) was al idempotent van opzet en is ongewijzigd gelaten: het is een `UPDATE ... WHERE stripe_payment_id = ...`, geen `INSERT` — een herhaalde aflevering van hetzelfde event (Stripe garandeert *at-least-once* delivery) past dezelfde toestand toe, zonder dubbele orders, betalingen, PDF's of e-mails. Dit is bevestigd met een test die hetzelfde event twee keer aanbiedt (zie F).

PDF-generatie zelf is eveneens idempotent: `getOrCreateWindowPlan` controleert eerst op een bestaande "ready"-rij en hergebruikt die, in plaats van opnieuw te genereren.

---

## F. Testdekking (Vitest)

Nieuw toegevoegd: `vitest.config.ts`, 6 testbestanden, **25/25 tests slagen**, **0 TypeScript-fouten** (`tsc --noEmit`), **0 ESLint-fouten** (project-breed).

| Bestand | Dekking |
|---|---|
| `src/app/checkout/actions.test.ts` | Server-side afwijzing bij ontbrekende toestemming; bewijst dat order + beide consent-records worden weggeschreven **vóór** de redirect naar Stripe |
| `src/app/api/stripe/webhook/route.test.ts` | Idempotentie: hetzelfde event twee keer levert dezelfde eindtoestand op, geen dubbele schrijfacties |
| `src/lib/consent.test.ts` | Hash-determinisme, exacte payload van beide consent-inserts, foutafhandeling |
| `src/lib/pdfAccess.test.ts` | Signed-URL-generatie, null-pad, foutafhandeling van Supabase Storage |
| `src/lib/orderNumber.test.ts` | RPC-aanroep, foutafhandeling |
| `src/lib/pricing.test.ts` | `formatAmount` toont het bedrag van de order, niet de actuele prijsconstante |

Bewust buiten scope (al in Fase 2 als aanbeveling genoemd, zie G): volledige end-to-end tests met Playwright + Stripe CLI test-webhooks.

---

## G. Aanbevolen vervolgstappen

1. **Jurist-review** van de vier punten in sectie C, vóór livegang.
2. **Bedrijfsgegevens invullen** in `dict.legal.companyInfo` (nu placeholders).
3. **Klantaccount "Mijn bestellingen"** met magic-link-authenticatie — expliciet uitgesteld op uw keuze.
4. **Bewaartermijnbeleid** voor IP/user-agent formaliseren zodra de jurist een termijn heeft bevestigd (een periodieke opschoon-job toevoegen).
5. **End-to-end tests** (Playwright + Stripe CLI test-webhooks) voor de volledige koopflow, als aanvulling op de huidige unit-tests.
6. **`npm install`** uitvoeren op uw machine — `vitest` is toegevoegd als nieuwe devDependency en moet nog geïnstalleerd worden vóór `npm test` werkt.
7. **Supabase-migraties uitvoeren** (`0010_digital_sales_compliance.sql`, `0011_private_pdf_storage.sql`) op de live database — dit rapport committeert alleen code, migraties worden niet automatisch toegepast.

---

## Compliance-checklist

- [x] Eén digitaal PDF-product (Model C), geen aparte AI-optie-producten
- [x] Expliciete, niet-vooraf-aangevinkte toestemming voor directe digitale levering
- [x] Expliciete erkenning van het verlies van het herroepingsrecht
- [x] Server-side validatie van beide toestemmingen (niet alleen client-side)
- [x] Toestemming vastgelegd vóór PDF-levering, gekoppeld aan een specifieke order
- [x] Versiebeheer van juridische teksten (`legal_documents` + `LEGAL_VERSIONS`)
- [x] Consent-logging met tekst-hash, tijdstip, IP/user-agent
- [x] Losstaande, vooraf-bereikbare herroepingsrecht-pagina
- [x] Correcte orderbevestiging (ordernummer, bedrag, datum, consentherhaling, links)
- [x] Beveiligde PDF-opslag en -levering (privébucket + signed URLs)
- [x] Idempotente betaalwebhook
- [x] AVG-minimalisatie per nieuw veld gedocumenteerd (bewaartermijn nog te bevestigen — zie C.1)
- [x] Geen gefabriceerde juridische uitzonderingen of bedrijfsgegevens
- [x] Testdekking voor checkout-validatie, idempotentie en consent-logging
- [ ] Jurist-goedkeuring van de vier openstaande punten (sectie C)
- [ ] Echte bedrijfsgegevens ingevuld (nu placeholders)
- [ ] Migraties toegepast op de live database
