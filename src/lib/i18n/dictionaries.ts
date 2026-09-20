import type { Locale } from "@/lib/locale";

export interface Option {
  value: string;
  label: string;
}

interface FollowUpCopy {
  label: string;
  sub: string;
  placeholder: string;
  // Shown as clickable chips on this mandatory field — unlike the optional
  // `situation` field above it, this one used to offer zero scaffolding
  // for the first required freeform answer in the flow.
  suggestions: string[];
}

export interface Dictionary {
  header: {
    switchLanguage: string;
    navHowItWorks: string;
    navExamples: string;
    navAbout: string;
  };
  footer: {
    privacy: string;
    terms: string;
    withdrawal: string;
    cookies: string;
    contact: string;
    companyInfo: string;
    priceFaqLabel: string;
    priceFaqAnswer: string;
    tagline: string;
    productHeading: string;
    legalHeading: string;
    navHowItWorks: string;
    navExamples: string;
  };
  consent: { message: string; accept: string; decline: string };
  landing: {
    badgeLabel: string;
    headlineLine1: string;
    headlineEmphasis: string;
    headlineLine2: string;
    subcopy: string;
    cta: string;
    secondaryCta: string;
    ctaCaption: string;
    heroAlt: string;
    whatYouGetHeading: string;
    whatYouGetSubcopy: string;
    whatYouGetItems: { title: string; body: string }[];
    testimonialsHeading: string;
    testimonials: { quote: string; name: string; role: string }[];
    ctaBannerHeading: string;
    ctaBannerBody: string;
    ctaBannerCta: string;
  };
  legal: {
    privacyTitle: string;
    privacyHeading: string;
    privacyIntro: string;
    // `id` gives every section a stable, locale-independent anchor
    // (e.g. "#cookies") — the heading text itself differs per locale, so
    // it can't double as the anchor the way it used to.
    privacySections: { id: string; heading: string; body: string }[];
    termsTitle: string;
    termsHeading: string;
    termsIntro: string;
    termsSections: { heading: string; body: string }[];
    // Model C digital sale compliance — the standalone /herroepingsrecht
    // page (see src/app/herroepingsrecht/page.tsx). Kept apart from
    // termsSections because it's also its own required standalone route,
    // not only a Terms subsection.
    withdrawalTitle: string;
    withdrawalHeading: string;
    withdrawalIntro: string;
    withdrawalSections: { heading: string; body: string }[];
  };
  checkout: {
    pageTitle: string;
    heading: string;
    priceCaption: string;
    subcopy: string;
    stepsHeading: string;
    steps: string[];
    disclaimer: string;
    // The two explanation blocks required before the checkboxes: what
    // digital delivery means, and the immediate-delivery/withdrawal notice.
    digitalDeliveryHeading: string;
    digitalDeliveryBody: string;
    withdrawalNoticeHeading: string;
    withdrawalNoticeBody: string;
    // Two separate, never-pre-checked checkboxes (never combined into
    // one) — digital delivery + withdrawal waiver together (that pairing
    // is allowed to be one checkbox), and terms acceptance on its own.
    digitalDeliveryConsentLabel: string;
    termsAcceptanceLabelPrefix: string;
    termsAcceptanceLinkText: string;
    termsAcceptanceLabelSuffix: string;
    legalLinksIntro: string;
    legalLinks: {
      terms: string;
      withdrawal: string;
      privacy: string;
      contact: string;
    };
    giftToggleLabel: string;
    giftEmailLabel: string;
    giftEmailPlaceholder: string;
    ctaIdle: string;
    ctaPending: string;
    errorGeneric: string;
    errorTermsRequired: string;
    errorConsentRequired: string;
    errorPaymentFailed: string;
    testModeLabel: string;
    testModeHelper: string;
    testModeCta: string;
    testModePending: string;
    errorTest: string;
  };
  plan: {
    pageTitle: string;
    errorHeading: string;
    refreshLink: string;
    errorNoPayment: string;
    errorGeneric: string;
    // Shown instead of errorGeneric specifically once payment is already
    // confirmed but PDF generation itself failed (section 24) — the buyer
    // needs to know their money was received and nothing needs to be paid
    // again, which errorGeneric's wording doesn't convey.
    errorPdfGenerationFailed: string;
    errorFallback: string;
    generating: {
      heading: string;
      messages: string[];
      autoRefreshNote: string;
    };
    eyebrow: string;
    possibilitiesHeading: string;
    wildcardFallback: string;
    downloadPdf: string;
    emailedCopy: string;
    shareButtonLabel: string;
    shareCopiedLabel: string;
    book: {
      back: string;
      next: string;
      wildcardLabel: string;
      doneHeading: string;
      doneSub: string;
      // Used by /shared/[id]'s Open Graph share-preview image, not by
      // IdeaBookViewer itself (see opengraph-image.tsx).
      statsIdeasLabel: string;
      statsWildcardLabel: string;
      // The Possibility Map screen (the Open Doors legend plus the One
      // Thing highlight) and its "view as PDF" links per idea/wildcard —
      // see src/lib/possibilityMap.ts. This is deliberately the only
      // screen before the closing download/share screen; a separate
      // profile/preferences/discovery-profile/per-idea walkthrough used to
      // sit here (see git history) but was removed on request — the PDF
      // is the product, so getting to it should take one click from this
      // overview, not a walk through several screens first.
      mapEyebrow: string;
      mapHeading: string;
      mapIntro: string;
      mapViewLabel: string;
      oneThingBadge: string;
      oneThingCaption: string;
      viewAsPdfLabel: string;
      doors: Record<
        "natural" | "discovery" | "unexpected" | "stretch",
        { label: string; description: string }
      >;
      // Repeat-use nudge on the closing "done" screen.
      doneReturnCta: string;
    };
  };
  shared: {
    pageTitle: string;
    eyebrow: string;
    intro: string;
    ctaLabel: string;
    notFoundHeading: string;
    notFoundBody: string;
    bannerHeading: string;
    bannerSub: string;
    bannerCta: string;
  };
  email: {
    subjectSuffix: string;
    heading: string;
    viewOnline: string;
    // Order confirmation additions (section 17): order number, price,
    // date, an explicit digital-delivery note, a re-confirmation of the
    // consent given at checkout, the terms version + link, a link to the
    // legal information, and company details.
    orderNumberLabel: string;
    priceLabel: string;
    dateLabel: string;
    digitalDeliveryNote: string;
    consentConfirmation: string;
    termsVersionLabel: string;
    termsLinkText: string;
    legalInfoLinkText: string;
    companyInfo: string;
    reminder: {
      subject: string;
      heading: string;
      intro: string;
      ctaLabel: string;
    };
  };
  pdfChrome: {
    coverEyebrow: string;
    coverTagline: string;
    profileEyebrow: string;
    mustHaves: string;
    preferences: string;
    possibilityEyebrow: string;
    wildcardFallbackHeading: string;
    whyItFitsFallback: string;
    stepsFallback: string;
    firstActionFallback: string;
    practicalFallback: string;
    locationFallback: string;
    requirementsFallback: string;
    mapLinkLabel: string;
    footerWordmark: string;
  };
  intake: {
    pageTitle: string;
    stepWord: string;
    ofWord: string;
    back: string;
    continueLabel: string;
    opening: string;
    makeThisReal: string;
    errorGeneric: string;
    pages: {
      situation: { heading: string; subheading: string };
      about: { heading: string; subheading: string };
      dials: { heading: string; subheading: string };
      openness: { heading: string; subheading: string };
      final: { heading: string; subheading: string };
    };
    situation: {
      label: string;
      sub: string;
      placeholder: string;
      suggestions: string[];
      optionalHint: string;
    };
    purpose: { label: string; options: Option[] };
    purposeFollowUp: Record<"self" | "gift" | "problem" | "curious", FollowUpCopy>;
    ageCategory: { label: string; options: Option[] };
    location: { label: string; sub: string; placeholder: string };
    searchDistance: { label: string; options: Option[] };
    // A behavioral scenario question, not a self-rating — see
    // src/lib/characterProfile.ts.
    freeTimePattern: { label: string; sub: string; options: Option[] };
    practicalToWild: { label: string; options: Option[] };
    timeAvailable: { label: string; options: Option[] };
    budget: { label: string; options: Option[] };
    effort: { label: string; options: Option[] };
    solutionTypes: { label: string; sub: string; options: Option[] };
    opennessIntro: string;
    mustHaves: {
      label: string;
      sub: string;
      placeholder: string;
      suggestions: string[];
      optionalHint: string;
    };
    preferences: {
      label: string;
      sub: string;
      placeholder: string;
      suggestions: string[];
      optionalHint: string;
    };
    // The one open, weighted-heavily question from the WindowInto brief —
    // optional, but invited with suggestion chips like situation/mustHaves.
    personalReflection: {
      label: string;
      sub: string;
      placeholder: string;
      suggestions: string[];
      optionalHint: string;
    };
    // Keyed by the same purpose the person chose on step 1 (see
    // purposeFollowUp above) — "gift" needs different wording here, since
    // by this point they've already told us the *recipient*, and a plain
    // "who's this for?" reads as contradicting that earlier answer.
    company: {
      label: string;
      sub: Record<"self" | "gift" | "problem" | "curious", string>;
      options: Option[];
    };
  };
}

const nl: Dictionary = {
  header: {
    switchLanguage: "Taal wisselen",
    navHowItWorks: "Hoe het werkt",
    navExamples: "Voorbeelden",
    navAbout: "Over ons",
  },
  footer: {
    privacy: "Privacy",
    terms: "Voorwaarden",
    withdrawal: "Herroepingsrecht",
    cookies: "Cookies",
    contact: "Contact",
    companyInfo: "Bedrijfsgegevens",
    priceFaqLabel: "Wat kost het?",
    priceFaqAnswer: "Eén Idea Book kost {price}, eenmalig. Geen abonnement, geen verborgen kosten.",
    tagline: "Persoonlijke ideeën voor mensen die vastzitten of toe zijn aan iets nieuws.",
    productHeading: "Product",
    legalHeading: "Juridisch",
    navHowItWorks: "Hoe het werkt",
    navExamples: "Voorbeelden",
  },
  consent: {
    message:
      "We gebruiken alleen analytics om te begrijpen hoe WINDOW gebruikt wordt — pas na jouw toestemming.",
    accept: "Prima",
    decline: "Liever niet",
  },
  landing: {
    badgeLabel: "Gegenereerd door AI · Persoonlijk voor jou",
    headlineLine1: "Ontdek wat er",
    headlineEmphasis: "mogelijk is",
    headlineLine2: "voor jou.",
    subcopy:
      "Vertel ons wie je bent en wat je beweegt. In enkele minuten ontvang je een persoonlijk Idea Book — zes concrete ideeën plus één wildcard, volledig uitgewerkt.",
    cta: "Maak mijn Idea Book",
    secondaryCta: "Bekijk een voorbeeld",
    ctaCaption: "Geen account nodig · vanaf {price}",
    heroAlt: "Een venster dat opengaat naar vier verschillende mogelijkheden",
    whatYouGetHeading: "Wat je krijgt",
    whatYouGetSubcopy:
      "Geen generieke tips. Geen lange vragenlijsten zonder uitkomst. Concrete ideeën, helemaal voor jou.",
    whatYouGetItems: [
      {
        title: "Zes mogelijkheden, voor jou",
        body: "Geen generieke tips. Elke suggestie is gebouwd op wat jij hebt verteld — je situatie, je budget, je tijd.",
      },
      {
        title: "Eén wildcard",
        body: "Het idee dat we eigenlijk niet zouden moeten voorstellen. Maar toch doen.",
      },
      {
        title: "Een Idea Book om te bewaren",
        body: "Een mooi vormgegeven PDF, geen los lijstje. Je ontvangt 'm ook meteen in je mail.",
      },
    ],
    testimonialsHeading: "Wat anderen zeggen",
    testimonials: [
      {
        quote:
          "Ik zat al maanden vast. Het Idea Book gaf me drie ideeën die ik daadwerkelijk uitvoerbaar vond — één ervan doe ik nu echt.",
        name: "Marieke V.",
        role: "Marketeer, 34",
      },
      {
        quote:
          "De wildcard sloeg me met verstomming. Ik had er zelf nooit op gekomen, maar het klopte perfect.",
        name: "Thomas K.",
        role: "Leraar, 41",
      },
      {
        quote:
          "Eindelijk iets dat niet alleen 'mediteer meer' zegt. De ideeën waren specifiek, uitvoerbaar en pasten echt bij mij.",
        name: "Sofie D.",
        role: "Freelancer, 29",
      },
    ],
    ctaBannerHeading: "Klaar om een venster te openen?",
    ctaBannerBody: "In een paar minuten beantwoord je de intake. Je Idea Book staat er meteen na betaling.",
    ctaBannerCta: "Start de intake",
  },
  legal: {
    privacyTitle: "Privacybeleid — WINDOW",
    privacyHeading: "Privacybeleid",
    privacyIntro:
      "Kort en concreet: dit is wat er met jouw gegevens gebeurt wanneer je een Idea Book aanvraagt bij WINDOW.",
    privacySections: [
      {
        id: "wie-zijn-we",
        heading: "Wie zijn we",
        body: "WINDOW is een klein product in de testfase. Vragen of verzoeken over je gegevens? Mail naar hello@windowinto.nl.",
      },
      {
        id: "gegevens",
        heading: "Welke gegevens we verzamelen",
        body: "Je intake-antwoorden (je situatie, leeftijd, locatie en voorkeuren) en, als je betaalt, het e-mailadres dat je bij Stripe invult. Bij een betaalde bestelling leggen we ook vast dat je de Algemene voorwaarden hebt geaccepteerd en toestemming hebt gegeven voor directe digitale levering — inclusief tijdstip, versie en (voor die ene toestemming) je IP-adres en browser, als bewijs bij een eventueel geschil. WINDOW slaat zelf nooit kaart- of betaalgegevens op — dat verloopt volledig via Stripe.",
      },
      {
        id: "gebruik",
        heading: "Waarvoor we het gebruiken",
        body: "Uitsluitend om jouw Idea Book samen te stellen en te versturen, en om aan te kunnen tonen onder welke voorwaarden een betaalde bestelling tot stand kwam. We verkopen of delen je gegevens nooit aan derden.",
      },
      {
        id: "bewaartermijn",
        heading: "Hoe lang we het bewaren",
        body: "Je intake-antwoorden blijven gekoppeld aan een anonieme sessie, niet aan je naam of e-mailadres. Pas zodra je betaalt, koppelen we je e-mailadres aan die sessie om je Idea Book te kunnen versturen. Bestel- en toestemmingsgegevens bewaren we zolang dat nodig is om een bestelling aantoonbaar te houden.",
      },
      {
        id: "rechten",
        heading: "Jouw rechten",
        body: "Je kunt op elk moment inzage of verwijdering van je gegevens aanvragen. Mail daarvoor naar hello@windowinto.nl.",
      },
      {
        id: "cookies",
        heading: "Cookies en analytics",
        body: "We gebruiken PostHog om te begrijpen hoe WINDOW gebruikt wordt. Waar dat wettelijk verplicht is, vragen we eerst je toestemming.",
      },
      {
        id: "contact",
        heading: "Contact",
        body: "Vragen over je gegevens, je bestelling, of iets anders? Mail naar hello@windowinto.nl.",
      },
      {
        id: "bedrijfsgegevens",
        heading: "Bedrijfsgegevens",
        body: "[Bedrijfsnaam] · [KvK-nummer] · [Vestigingsadres] · [Btw-nummer]",
      },
    ],
    termsTitle: "Algemene Voorwaarden — WINDOW",
    termsHeading: "Algemene Voorwaarden",
    termsIntro: "De belangrijkste afspraken tussen jou en WINDOW, in gewone taal.",
    termsSections: [
      {
        heading: "Wat je koopt",
        body: "Eén Idea Book: een persoonlijk PDF-document met mogelijkheden, samengesteld op basis van je eigen antwoorden. Geen abonnement, geen vervolgaankopen.",
      },
      {
        heading: "Prijs en betaling",
        body: "Eén Idea Book kost {price}, eenmalig, in euro's — veilig te betalen via Stripe.",
      },
      {
        heading: "Levering",
        body: "Je Idea Book wordt direct na betaling digitaal getoond, en we mailen je ook meteen een kopie.",
      },
      {
        heading: "Herroepingsrecht",
        body: "Omdat je Idea Book direct digitaal wordt geleverd, vervalt je wettelijke bedenktijd van 14 dagen zodra je betaalt en hiermee instemt — dit bevestig je ook expliciet vóór het afronden van de betaling.",
      },
      {
        heading: "Aansprakelijkheid",
        body: "De mogelijkheden in je Idea Book zijn suggesties, geen garanties op resultaat en geen medisch, therapeutisch, financieel of juridisch advies.",
      },
      {
        heading: "Klachten",
        body: "Niet tevreden, of iets onduidelijk? Mail naar hello@windowinto.nl — we reageren zo snel mogelijk.",
      },
    ],
    withdrawalTitle: "Herroepingsrecht — WINDOW",
    withdrawalHeading: "Herroepingsrecht",
    withdrawalIntro:
      "Bij online aankopen hebben consumenten in beginsel een wettelijke bedenktijd van 14 dagen.",
    withdrawalSections: [
      {
        heading: "Wanneer vervalt dit recht bij WindowInto",
        body: "Voor digitale inhoud die niet op een materiële drager wordt geleverd — zoals je WindowInto PDF — kan het herroepingsrecht vervallen wanneer je vóór de levering: (1) uitdrukkelijk instemt met onmiddellijke levering, (2) erkent dat je herroepingsrecht daardoor vervalt, en (3) de levering vervolgens daadwerkelijk start.",
      },
      {
        heading: "Hoe WindowInto dit vastlegt",
        body: "WindowInto vraagt deze toestemming expliciet tijdens het bestelproces, via een aparte checkbox die je zelf moet aanvinken — nooit vooraf aangevinkt. We leggen vast wanneer je dit hebt gedaan en onder welke versie van deze informatie, gekoppeld aan je specifieke bestelling.",
      },
      {
        heading: "Wettelijke grondslag",
        body: "Deze uitzondering is gebaseerd op artikel 6:230p van het Burgerlijk Wetboek, de Nederlandse implementatie van artikel 16 onder m van de Europese Richtlijn Consumentenrechten (2011/83/EU). Twijfel je over jouw situatie, of wil je een klacht indienen? Neem contact op via hello@windowinto.nl.",
      },
    ],
  },
  checkout: {
    pageTitle: "Maak het echt — WINDOW",
    heading: "Jouw Idea Book",
    priceCaption: "eenmalig, inclusief btw",
    subcopy:
      "Een handvol mogelijkheden, gevormd naar wat je ons hebt verteld — plus eentje die we eigenlijk niet zouden moeten voorstellen, maar toch doen.",
    stepsHeading: "Wat er nu gebeurt",
    steps: [
      "Je betaalt eenmalig {price} via Stripe — met het e-mailadres waar we ook je Idea Book naartoe sturen.",
      "Binnen een minuut stellen we jouw Idea Book samen.",
      "Je ziet 'm meteen hier, en we mailen 'm ook naar je.",
    ],
    disclaimer:
      "WINDOW biedt mogelijkheden om te verkennen — geen medisch, therapeutisch, financieel of juridisch advies. Gebruik je eigen inzicht en raadpleeg een professional waar dat nodig is.",
    digitalDeliveryHeading: "Digitale levering",
    digitalDeliveryBody:
      "Je persoonlijke WindowInto PDF wordt na betaling digitaal gegenereerd en beschikbaar gesteld.",
    withdrawalNoticeHeading: "Let op: directe levering van digitale inhoud",
    withdrawalNoticeBody:
      "Je koopt een gepersonaliseerd digitaal product dat direct na betaling wordt gegenereerd en beschikbaar gesteld.",
    digitalDeliveryConsentLabel:
      "Ik verzoek WindowInto om mijn digitale product direct na betaling te leveren. Ik begrijp dat ik hiermee uitdrukkelijk instem met de onmiddellijke levering van de digitale inhoud en erken dat ik mijn wettelijke herroepingsrecht verlies zodra de levering begint.",
    termsAcceptanceLabelPrefix: "Ik heb de",
    termsAcceptanceLinkText: "Algemene voorwaarden",
    termsAcceptanceLabelSuffix: "gelezen en accepteer deze.",
    legalLinksIntro: "Meer weten voordat je betaalt?",
    legalLinks: {
      terms: "Algemene voorwaarden",
      withdrawal: "Herroepingsrecht",
      privacy: "Privacybeleid",
      contact: "Contact",
    },
    giftToggleLabel: "Dit is een cadeau — stuur het naar iemand anders",
    giftEmailLabel: "E-mailadres van de ontvanger",
    giftEmailPlaceholder: "naam@voorbeeld.nl",
    ctaIdle: "Betalen en mijn PDF ontvangen — {price}",
    ctaPending: "Checkout wordt geopend…",
    errorGeneric: "Er ging iets mis bij het openen van de checkout. Probeer het opnieuw.",
    errorTermsRequired: "Accepteer de Algemene voorwaarden om verder te gaan.",
    errorConsentRequired:
      "Vink aan dat je instemt met directe levering van het digitale product voordat je verdergaat.",
    errorPaymentFailed: "Je betaling kon niet worden verwerkt. Je PDF is nog niet geleverd.",
    testModeLabel: "Alleen testmodus",
    testModeHelper: "Sla de betaling over en genereer het Idea Book direct, voor testdoeleinden.",
    testModeCta: "Betaling overslaan (test)",
    testModePending: "Bezig met genereren…",
    errorTest: "Er ging iets mis bij het overslaan van de betaling. Probeer het opnieuw.",
  },
  plan: {
    pageTitle: "Jouw Idea Book — WINDOW",
    errorHeading: "Jouw Idea Book",
    refreshLink: "Vernieuwen",
    errorNoPayment:
      "Geen betalingsreferentie gevonden. Heb je net betaald? Gebruik dan de link uit je bevestigingsmail.",
    errorGeneric: "Er ging iets mis bij het samenstellen van je Idea Book.",
    errorPdfGenerationFailed:
      "Je betaling is ontvangen, maar je PDF kon nog niet worden gegenereerd. We werken dit automatisch af en sturen je een bericht zodra je PDF beschikbaar is.",
    errorFallback: "Er ging iets mis.",
    generating: {
      heading: "Je Idea Book wordt samengesteld…",
      messages: [
        "Je situatie wordt gelezen…",
        "Zes mogelijkheden worden bedacht…",
        "Je wildcard krijgt een laatste check…",
        "Je Idea Book wordt opgemaakt…",
      ],
      autoRefreshNote: "Dit duurt meestal minder dan een minuut. Deze pagina ververst zichzelf.",
    },
    eyebrow: "Jouw Idea Book",
    possibilitiesHeading: "Jouw mogelijkheden",
    wildcardFallback: "De wildcard",
    downloadPdf: "Download PDF",
    emailedCopy: "We hebben ook een kopie gemaild.",
    shareButtonLabel: "Deel je Idea Book",
    shareCopiedLabel: "Link gekopieerd!",
    book: {
      back: "Terug",
      next: "Verder",
      wildcardLabel: "Het wilde idee",
      doneHeading: "Dat was 'm — jouw Idea Book",
      doneSub: "Bewaar 'm, deel 'm, of begin gewoon met de eerste stap.",
      statsIdeasLabel: "Ideeën",
      statsWildcardLabel: "Wildcard",
      mapEyebrow: "Vier deuren, telkens een stapje verder",
      mapHeading: "Jouw mogelijkheden in kaart",
      mapIntro:
        "Elk idee hoort bij een deur — hoe verder je gaat, hoe verder van je comfortzone. Begin waar je wilt.",
      mapViewLabel: "Bekijk",
      oneThingBadge: "Als je er maar één kiest",
      oneThingCaption: "Dit past het best bij je situatie én is meteen te doen.",
      viewAsPdfLabel: "Bekijk als PDF-pagina",
      doors: {
        natural: {
          label: "Vertrouwd",
          description: "Dicht bij wat je al doet — maar dan net iets beter uitgewerkt.",
        },
        discovery: {
          label: "Ontdekking",
          description: "Iets wat aansluit bij wat je leuk vindt, maar dat je nog niet had geprobeerd.",
        },
        unexpected: {
          label: "Onverwacht",
          description: "Verrast je in eerste instantie — tot je leest waarom het toch bij je past.",
        },
        stretch: {
          label: "Uitdaging",
          description: "Net buiten je comfortzone. Groter, spannender, nog steeds haalbaar.",
        },
      },
      doneReturnCta: "Kom later terug voor een nieuw venster",
    },
  },
  shared: {
    pageTitle: "Gedeeld Idea Book — WINDOW",
    eyebrow: "Gedeeld Idea Book",
    intro: "Iemand deelde dit Idea Book met je — gemaakt door WINDOW, op basis van hun eigen antwoorden.",
    ctaLabel: "Open zelf een venster",
    notFoundHeading: "Dit Idea Book bestaat niet (meer)",
    notFoundBody: "De link klopt niet, of dit Idea Book is niet meer beschikbaar.",
    bannerHeading: "Idee uit een WINDOW Idea Book",
    bannerSub: "Wil jij ook jouw persoonlijke ideeën?",
    bannerCta: "Maak er een",
  },
  email: {
    subjectSuffix: "je mogelijkheden zijn klaar",
    heading: "Jouw mogelijkheden",
    viewOnline: "Bekijk je Idea Book online",
    orderNumberLabel: "Ordernummer",
    priceLabel: "Prijs",
    dateLabel: "Datum",
    digitalDeliveryNote:
      "Digitale levering: je Idea Book is direct na betaling gegenereerd en beschikbaar gesteld.",
    consentConfirmation:
      "Je hebt tijdens het bestelproces uitdrukkelijk ingestemd met directe levering van de digitale inhoud en erkend dat je wettelijke herroepingsrecht verloren gaat zodra de levering begint.",
    termsVersionLabel: "Algemene voorwaarden (versie {termsVersion})",
    termsLinkText: "Bekijk de Algemene voorwaarden",
    legalInfoLinkText: "Juridische informatie",
    companyInfo: "[Bedrijfsnaam] · [KvK-nummer] · [Vestigingsadres] · [Btw-nummer]",
    reminder: {
      subject: "Heb je je eerste stap al gezet?",
      heading: "Nog even dit",
      intro: "Een paar dagen geleden kreeg je je Idea Book. Eén van de ideeën was {title} — {action}",
      ctaLabel: "Bekijk je Idea Book",
    },
  },
  pdfChrome: {
    coverEyebrow: "JOUW WINDOW IDEA BOOK",
    coverTagline: "Een handvol mogelijkheden, gevormd naar wat je ons vertelde.",
    profileEyebrow: "JOUW PROFIEL",
    mustHaves: "VEREISTEN",
    preferences: "VOORKEUREN",
    possibilityEyebrow: "MOGELIJKHEID",
    wildcardFallbackHeading: "DE WILDCARD",
    whyItFitsFallback: "Waarom dit bij jou past",
    stepsFallback: "Stappen",
    firstActionFallback: "Dit kunt u nu doen",
    practicalFallback: "Praktisch",
    locationFallback: "Locatie",
    requirementsFallback: "Wat heeft u nodig",
    mapLinkLabel: "bekijk op kaart",
    footerWordmark: "WINDOW  ·  Jouw Idea Book",
  },
  intake: {
    pageTitle: "Open een Venster — WINDOW",
    stepWord: "Stap",
    ofWord: "van",
    back: "Terug",
    continueLabel: "Verder",
    opening: "Wordt geopend…",
    makeThisReal: "Maak het echt",
    errorGeneric: "Er ging iets mis. Probeer het opnieuw.",
    pages: {
      situation: {
        heading: "Jouw situatie",
        subheading: "Het startpunt — wat er speelt, en waar je eigenlijk naar op zoek bent.",
      },
      about: {
        heading: "Over jou",
        subheading: "Zo stemmen we mogelijkheden af die echt bij je leven passen.",
      },
      dials: {
        heading: "Jouw stijl",
        subheading:
          "Zet ze zoals het vandaag voelt — elke schuif start in het midden totdat je 'm aanraakt.",
      },
      openness: {
        heading: "Waar je voor openstaat",
        subheading:
          "De vorm van de mogelijkheden, en alles wat we moeten weten voordat we beginnen.",
      },
      final: {
        heading: "Laatste stap",
        subheading: "Bijna klaar.",
      },
    },
    situation: {
      label: "Wat speelt er?",
      sub: "Een gevoel, een moment, een dinsdag die wel een reddingsactie kan gebruiken. Kies een start, of typ je eigen verhaal.",
      placeholder: "Een zware week, een verjaardag zonder plan, een beetje rusteloosheid…",
      suggestions: [
        "Ik verveel me al weken",
        "Ik heb een dagje voor mezelf nodig",
        "Het is een gekke week geweest",
        "Ik weet het eigenlijk niet precies",
      ],
      optionalHint: "Dat mag ook. We werken dan met wat je hierna nog vertelt.",
    },
    purpose: {
      label: "Waar ben je eigenlijk naar op zoek?",
      options: [
        { value: "self", label: "Iets te doen, alleen voor mezelf" },
        { value: "gift", label: "Een cadeau of verrassing voor iemand anders" },
        { value: "problem", label: "Een specifiek probleem oplossen" },
        { value: "curious", label: "Gewoon nieuwsgierig wat er allemaal mogelijk is" },
      ],
    },
    purposeFollowUp: {
      self: {
        label: "Wat voor ervaring heb je in gedachten?",
        sub: "Schets ons een ruw beeld — de rest vullen wij aan. Twee zinnen is genoeg, we hebben geen essay nodig.",
        placeholder: "Iets waardoor ik het huis uit kom en mijn telefoon wegleg…",
        suggestions: [
          "Iets waar ik met plezier aan terugdenk",
          "Iets heel anders dan mijn dagelijkse routine",
          "Gewoon iets leuks, maak me verrast",
        ],
      },
      gift: {
        label: "Vertel ons over diegene.",
        sub: "Wie is het, en waar houdt diegene van? Twee zinnen is genoeg, we hebben geen essay nodig.",
        placeholder: "Mijn zus, die geobsedeerd is door planten en vreselijke woordgrappen…",
        suggestions: [
          "Mijn partner, die van lekker eten en verrassingen houdt",
          "Een vriend(in) die alles al lijkt te hebben",
          "Een collega die wel een oppepper kan gebruiken",
        ],
      },
      problem: {
        label: "Wat is het probleem precies?",
        sub: "Hoe specifieker, hoe beter we ermee aan de slag kunnen. Twee zinnen is genoeg, we hebben geen essay nodig.",
        placeholder: "Ik zeg steeds ja tegen dingen die ik eigenlijk niet wil doen…",
        suggestions: [
          "Ik kom nooit toe aan iets voor mezelf",
          "Ik zie mijn vrienden veel te weinig",
          "Ik weet niet meer wat ik leuk vind",
        ],
      },
      curious: {
        label: "Wat prikkelt je nieuwsgierigheid?",
        sub: "Een thema, een gevoel, een konijnenhol waar je al lang in wilde vallen. Twee zinnen is genoeg, we hebben geen essay nodig.",
        placeholder: "Ik vraag me af hoe mijn weekenden er ook uit zouden kunnen zien…",
        suggestions: [
          "Ik wil gewoon eens iets nieuws proberen",
          "Ik ben benieuwd wat ik nog niet ken in mijn eigen stad",
          "Geen idee — verras me maar",
        ],
      },
    },
    ageCategory: {
      label: "Leeftijdscategorie",
      options: [
        { value: "under18", label: "Onder 18" },
        { value: "18-24", label: "18–24" },
        { value: "25-34", label: "25–34" },
        { value: "35-44", label: "35–44" },
        { value: "45-54", label: "45–54" },
        { value: "55-64", label: "55–64" },
        { value: "65plus", label: "65+" },
      ],
    },
    location: {
      label: "Waar woon je?",
      sub: "Stad of regio is genoeg.",
      placeholder: "Rotterdam, of ergens in de buurt…",
    },
    searchDistance: {
      label: "Hoe ver mogen we zoeken?",
      options: [
        { value: "nearby", label: "Alleen dichtbij" },
        { value: "city", label: "Binnen mijn stad" },
        { value: "hour", label: "Binnen een uur" },
        { value: "anywhere", label: "Overal" },
      ],
    },
    freeTimePattern: {
      label: "Een vrije zaterdag doemt op. Wat doe je?",
      sub: "Niet wat je zou moeten doen — wat je écht doet.",
      options: [
        { value: "familiar", label: "Iets plannen dat ik al ken en vertrouw" },
        { value: "search", label: "Op zoek gaan naar iets interessants" },
        { value: "ask", label: "Iemand anders vragen wat die wil doen" },
        { value: "spontaneous", label: "Gewoon spontaan beslissen, ter plekke" },
        { value: "stayhome", label: "Thuisblijven en kijken wat er gebeurt" },
      ],
    },
    practicalToWild: {
      label: "Hou je het liever veilig, of mag het verrassen?",
      options: [
        { value: "grounded", label: "Hou het voorspelbaar en vertrouwd" },
        { value: "practical", label: "Vooral praktisch, weinig verrassing" },
        { value: "either", label: "Sta open voor beide" },
        { value: "unexpected", label: "Verras me gerust af en toe" },
        { value: "wild", label: "Verras me volledig, neem me mee naar iets wilds" },
      ],
    },
    timeAvailable: {
      label: "Hoeveel tijd heb je?",
      options: [
        { value: "hour", label: "Een uur of twee" },
        { value: "halfday", label: "Een halve dag" },
        { value: "fullday", label: "Een hele dag" },
        { value: "weekend", label: "Een heel weekend" },
      ],
    },
    budget: {
      label: "Jouw budget",
      options: [
        { value: "free", label: "Hou het gratis" },
        { value: "25", label: "Tot €25" },
        { value: "100", label: "Tot €100" },
        { value: "allin", label: "Ga all-in" },
      ],
    },
    effort: {
      label: "Hoeveel moeite wil je erin steken?",
      options: [
        { value: "minimal", label: "Zo min mogelijk" },
        { value: "some", label: "Een beetje moeite is prima" },
        { value: "committed", label: "Ik ga er volledig voor" },
      ],
    },
    solutionTypes: {
      label: "Voor welk soort mogelijkheden sta je open?",
      sub: "Kies er zoveel als goed voelen.",
      options: [
        { value: "activity", label: "Een activiteit of uitje" },
        { value: "gift", label: "Een cadeau" },
        { value: "recipe", label: "Een recept of maaltijd" },
        { value: "habit", label: "Een gewoonte of ritueel" },
        { value: "conversation", label: "Een gesprek" },
        { value: "creative", label: "Een creatief project" },
      ],
    },
    opennessIntro:
      "Twee soorten wensen: dingen die écht niet mogen (een harde grens), en dingen die fijn zouden zijn maar niet cruciaal (een voorkeur). Twijfel je? Zet het bij voorkeuren — we filteren dan soepeler.",
    mustHaves: {
      label: "Wat mag absoluut niet ontbreken — of moet juist wegblijven?",
      sub: "Alleen harde eisen, denk: allergieën, een dier dat mee moet, een tijdstip dat niet kan.",
      placeholder: "Moet hondvriendelijk zijn, moet buiten zijn, geen vis of schaaldieren…",
      suggestions: ["Moet met de hond kunnen", "Geen alcohol", "Rolstoeltoegankelijk"],
      optionalHint: "Niks hards? Sla gerust over.",
    },
    preferences: {
      label: "En wat zou fijn zijn, maar is geen dealbreaker?",
      sub: "Kleine duwtjes in een richting — we wijken hier soepel van af als het net beter past.",
      placeholder: "Ik zou iets creatiefs geweldig vinden, het liefst buiten…",
      suggestions: ["Het liefst buiten", "Iets creatiefs", "Niet te druk"],
      optionalHint: "Geen voorkeur? Ook prima.",
    },
    personalReflection: {
      label: "Wat zou je stiekem wel vaker willen doen?",
      sub: "Het antwoord waar je normaal niet naar wordt gevraagd — dit telt zwaar mee.",
      placeholder: "Ik zou best vaker…",
      suggestions: [
        "Iets maken met mijn handen",
        "Er in mijn eentje op uit gaan",
        "Meer tijd in de natuur doorbrengen",
      ],
      optionalHint: "Mag ook leeg — dan laten we het aan de rest van je antwoorden over.",
    },
    company: {
      label: "Voor wie is dit venster?",
      sub: {
        self: "Wie er eventueel bij is.",
        // "Purpose" already told us who the *gift* is for — this question
        // is really about who joins in, so it needs to say that
        // explicitly, or it reads as contradicting the earlier answer.
        gift: "Dit gaat over wie er evt. bij is als het moment zelf plaatsvindt — niet over wie het cadeau ontvangt.",
        problem: "Wie er eventueel bij is.",
        curious: "Wie er eventueel bij is.",
      },
      options: [
        { value: "alone", label: "Alleen ik" },
        { value: "partner", label: "Een partner" },
        { value: "friends", label: "Vrienden" },
        { value: "family", label: "Familie" },
        { value: "colleagues", label: "Collega's" },
      ],
    },
  },
};

const en: Dictionary = {
  header: {
    switchLanguage: "Switch language",
    navHowItWorks: "How it works",
    navExamples: "Examples",
    navAbout: "About",
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    withdrawal: "Right of withdrawal",
    cookies: "Cookies",
    contact: "Contact",
    companyInfo: "Company details",
    priceFaqLabel: "What does it cost?",
    priceFaqAnswer: "One Idea Book costs {price}, a single payment. No subscription, no hidden fees.",
    tagline: "Personal ideas for people who feel stuck or ready for something new.",
    productHeading: "Product",
    legalHeading: "Legal",
    navHowItWorks: "How it works",
    navExamples: "Examples",
  },
  consent: {
    message: "We only use analytics to understand how WINDOW is used — and only after you say it's okay.",
    accept: "Sounds good",
    decline: "No thanks",
  },
  landing: {
    badgeLabel: "Generated by AI · Personal to you",
    headlineLine1: "Discover what's",
    headlineEmphasis: "possible",
    headlineLine2: "for you.",
    subcopy:
      "Tell us who you are and what moves you. In a few minutes you'll get a personal Idea Book — six concrete ideas plus one wildcard, fully worked out.",
    cta: "Make my Idea Book",
    secondaryCta: "See an example",
    ctaCaption: "No account needed · from {price}",
    heroAlt: "A window opening onto four different possibilities",
    whatYouGetHeading: "What you get",
    whatYouGetSubcopy:
      "No generic tips. No long questionnaires with nothing to show for it. Concrete ideas, made entirely for you.",
    whatYouGetItems: [
      {
        title: "Six possibilities, made for you",
        body: "No generic tips. Every suggestion is built on what you told us — your situation, your budget, your time.",
      },
      {
        title: "One wildcard",
        body: "The idea we probably shouldn't suggest. But do anyway.",
      },
      {
        title: "An Idea Book worth keeping",
        body: "A beautifully designed PDF, not a loose list. We'll email you a copy too.",
      },
    ],
    testimonialsHeading: "What others say",
    testimonials: [
      {
        quote:
          "I'd been stuck for months. The Idea Book gave me three ideas I actually found doable — I'm really doing one of them now.",
        name: "Marieke V.",
        role: "Marketer, 34",
      },
      {
        quote:
          "The wildcard left me speechless. I'd never have thought of it myself, but it fit perfectly.",
        name: "Thomas K.",
        role: "Teacher, 41",
      },
      {
        quote:
          "Finally something that doesn't just say 'meditate more'. The ideas were specific, doable, and genuinely fit me.",
        name: "Sofie D.",
        role: "Freelancer, 29",
      },
    ],
    ctaBannerHeading: "Ready to open a window?",
    ctaBannerBody: "The intake takes just a few minutes to answer. Your Idea Book is ready right after payment.",
    ctaBannerCta: "Start the intake",
  },
  legal: {
    privacyTitle: "Privacy Policy — WINDOW",
    privacyHeading: "Privacy Policy",
    privacyIntro:
      "Short and concrete: here's what happens to your data when you request an Idea Book from WINDOW.",
    privacySections: [
      {
        id: "wie-zijn-we",
        heading: "Who we are",
        body: "WINDOW is a small product still in its testing phase. Questions or requests about your data? Email hello@windowinto.nl.",
      },
      {
        id: "gegevens",
        heading: "What data we collect",
        body: "Your intake answers (your situation, age, location and preferences) and, if you pay, the email address you enter with Stripe. For a paid order we also record that you accepted the Terms of Service and consented to immediate digital delivery — including the time, version, and (for that one consent) your IP address and browser — as evidence in case of a dispute. WINDOW never stores card or payment details itself — that runs entirely through Stripe.",
      },
      {
        id: "gebruik",
        heading: "What we use it for",
        body: "Solely to put together and send your Idea Book, and to be able to show under what conditions a paid order was placed. We never sell or share your data with third parties.",
      },
      {
        id: "bewaartermijn",
        heading: "How long we keep it",
        body: "Your intake answers stay linked to an anonymous session, not to your name or email. Only once you pay do we link your email address to that session, so we can send your Idea Book. Order and consent records are kept for as long as needed to keep an order demonstrable.",
      },
      {
        id: "rechten",
        heading: "Your rights",
        body: "You can request access to or deletion of your data at any time. Email hello@windowinto.nl.",
      },
      {
        id: "cookies",
        heading: "Cookies and analytics",
        body: "We use PostHog to understand how WINDOW is used. Where required by law, we ask for your consent first.",
      },
      {
        id: "contact",
        heading: "Contact",
        body: "Questions about your data, your order, or anything else? Email hello@windowinto.nl.",
      },
      {
        id: "bedrijfsgegevens",
        heading: "Company details",
        body: "[Company name] · [Chamber of Commerce number] · [Registered address] · [VAT number]",
      },
    ],
    termsTitle: "Terms of Service — WINDOW",
    termsHeading: "Terms of Service",
    termsIntro: "The key agreements between you and WINDOW, in plain language.",
    termsSections: [
      {
        heading: "What you're buying",
        body: "One Idea Book: a personal PDF of possibilities, put together from your own answers. No subscription, no follow-up purchases.",
      },
      {
        heading: "Price and payment",
        body: "One Idea Book costs {price}, a single payment, in euros — paid securely via Stripe.",
      },
      {
        heading: "Delivery",
        body: "Your Idea Book is shown digitally right after payment, and we also email you a copy straight away.",
      },
      {
        heading: "Right of withdrawal",
        body: "Because your Idea Book is delivered digitally and immediately, your statutory 14-day right of withdrawal ends as soon as you pay and agree to this — you also confirm this explicitly before completing payment.",
      },
      {
        heading: "Liability",
        body: "The possibilities in your Idea Book are suggestions, not guarantees of outcome, and not medical, therapeutic, financial, or legal advice.",
      },
      {
        heading: "Complaints",
        body: "Not happy, or something unclear? Email hello@windowinto.nl — we'll get back to you as soon as we can.",
      },
    ],
    withdrawalTitle: "Right of withdrawal — WINDOW",
    withdrawalHeading: "Right of withdrawal",
    withdrawalIntro:
      "For online purchases, consumers generally have a statutory 14-day cooling-off period.",
    withdrawalSections: [
      {
        heading: "When this right no longer applies at WindowInto",
        body: "For digital content not supplied on a tangible medium — such as your WindowInto PDF — the right of withdrawal can be lost when, before delivery, you: (1) expressly consent to immediate delivery, (2) acknowledge that this means you lose your right of withdrawal, and (3) delivery then actually begins.",
      },
      {
        heading: "How WindowInto records this",
        body: "WindowInto asks for this consent explicitly during checkout, through a separate checkbox you have to check yourself — never pre-checked. We record when you did this and under which version of this information, tied to your specific order.",
      },
      {
        heading: "Legal basis",
        body: "This exception is based on article 6:230p of the Dutch Civil Code, the Dutch implementation of article 16(m) of the EU Consumer Rights Directive (2011/83/EU). Unsure about your situation, or want to file a complaint? Contact us at hello@windowinto.nl.",
      },
    ],
  },
  checkout: {
    pageTitle: "Make this real — WINDOW",
    heading: "Your Idea Book",
    priceCaption: "one-time, VAT included",
    subcopy:
      "A handful of possibilities, shaped around what you told us — plus one we probably shouldn't suggest, but will anyway.",
    stepsHeading: "What happens next",
    steps: [
      "You pay {price} once via Stripe — using the email address we'll also send your Idea Book to.",
      "Within a minute, we put your Idea Book together.",
      "You'll see it right here, and we'll email you a copy too.",
    ],
    disclaimer:
      "WINDOW offers possibilities to explore — not medical, therapeutic, financial, or legal advice. Use your own judgment, and consult a professional where it matters.",
    digitalDeliveryHeading: "Digital delivery",
    digitalDeliveryBody:
      "Your personal WindowInto PDF is generated and made available digitally right after payment.",
    withdrawalNoticeHeading: "Please note: immediate delivery of digital content",
    withdrawalNoticeBody:
      "You're buying a personalised digital product that is generated and made available immediately after payment.",
    digitalDeliveryConsentLabel:
      "I request that WindowInto deliver my digital product immediately after payment. I understand that by doing so I expressly consent to the immediate delivery of the digital content, and I acknowledge that I lose my statutory right of withdrawal once delivery begins.",
    termsAcceptanceLabelPrefix: "I have read and accept the",
    termsAcceptanceLinkText: "Terms of Service",
    termsAcceptanceLabelSuffix: ".",
    legalLinksIntro: "Want to know more before you pay?",
    legalLinks: {
      terms: "Terms of Service",
      withdrawal: "Right of withdrawal",
      privacy: "Privacy Policy",
      contact: "Contact",
    },
    giftToggleLabel: "This is a gift — send it to someone else",
    giftEmailLabel: "Recipient's email address",
    giftEmailPlaceholder: "name@example.com",
    ctaIdle: "Pay and get my PDF — {price}",
    ctaPending: "Opening checkout…",
    errorGeneric: "Something went wrong opening checkout. Please try again.",
    errorTermsRequired: "Accept the Terms of Service to continue.",
    errorConsentRequired:
      "Check the box confirming immediate delivery of the digital product before continuing.",
    errorPaymentFailed: "Your payment could not be processed. Your PDF has not been delivered.",
    testModeLabel: "Test mode only",
    testModeHelper: "Skip payment and generate the Idea Book directly, for testing.",
    testModeCta: "Skip payment (test)",
    testModePending: "Generating…",
    errorTest: "Something went wrong skipping payment. Please try again.",
  },
  plan: {
    pageTitle: "Your Idea Book — WINDOW",
    errorHeading: "Your Idea Book",
    refreshLink: "Refresh",
    errorNoPayment:
      "No payment reference was found. If you just paid, use the link from your confirmation email.",
    errorGeneric: "Something went wrong while putting your Idea Book together.",
    errorPdfGenerationFailed:
      "Your payment has been received, but your PDF could not be generated yet. We're automatically retrying and will let you know as soon as your PDF is available.",
    errorFallback: "Something went wrong.",
    generating: {
      heading: "Putting your Idea Book together…",
      messages: [
        "Reading through your situation…",
        "Coming up with six possibilities…",
        "Giving your wildcard one last check…",
        "Laying out your Idea Book…",
      ],
      autoRefreshNote: "This usually takes under a minute. This page refreshes itself.",
    },
    eyebrow: "Your Idea Book",
    possibilitiesHeading: "Your possibilities",
    wildcardFallback: "The wildcard",
    downloadPdf: "Download PDF",
    emailedCopy: "We've also emailed a copy.",
    shareButtonLabel: "Share your Idea Book",
    shareCopiedLabel: "Link copied!",
    book: {
      back: "Back",
      next: "Next",
      wildcardLabel: "The wild idea",
      doneHeading: "That's it — your Idea Book",
      doneSub: "Save it, share it, or just start with the first step.",
      statsIdeasLabel: "Ideas",
      statsWildcardLabel: "Wildcard",
      mapEyebrow: "Four doors, each one a bit further",
      mapHeading: "Your possibilities, mapped out",
      mapIntro:
        "Every idea belongs to a door — the further along, the further from your comfort zone. Start wherever you like.",
      mapViewLabel: "View",
      oneThingBadge: "If you only do one thing",
      oneThingCaption: "This fits your situation best, and you can start today.",
      viewAsPdfLabel: "View as PDF page",
      doors: {
        natural: {
          label: "Familiar",
          description: "Close to what you already do — just worked out a little better.",
        },
        discovery: {
          label: "Discovery",
          description: "Something that fits what you enjoy, that you just haven't tried yet.",
        },
        unexpected: {
          label: "Unexpected",
          description: "Surprises you at first — until you read why it actually fits.",
        },
        stretch: {
          label: "Stretch",
          description: "Just outside your comfort zone. Bigger, more exciting, still doable.",
        },
      },
      doneReturnCta: "Come back later for a new window",
    },
  },
  shared: {
    pageTitle: "Shared Idea Book — WINDOW",
    eyebrow: "Shared Idea Book",
    intro: "Someone shared this Idea Book with you — made by WINDOW, from their own answers.",
    ctaLabel: "Open your own window",
    notFoundHeading: "This Idea Book doesn't exist (anymore)",
    notFoundBody: "The link is wrong, or this Idea Book is no longer available.",
    bannerHeading: "An idea from a WINDOW Idea Book",
    bannerSub: "Want your own personal ideas?",
    bannerCta: "Make one",
  },
  email: {
    subjectSuffix: "your possibilities are ready",
    heading: "Your possibilities",
    viewOnline: "View your Idea Book online",
    orderNumberLabel: "Order number",
    priceLabel: "Price",
    dateLabel: "Date",
    digitalDeliveryNote:
      "Digital delivery: your Idea Book was generated and made available right after payment.",
    consentConfirmation:
      "During checkout, you expressly consented to immediate delivery of the digital content and acknowledged that your statutory right of withdrawal is lost once delivery begins.",
    termsVersionLabel: "Terms of Service (version {termsVersion})",
    termsLinkText: "View the Terms of Service",
    legalInfoLinkText: "Legal information",
    companyInfo: "[Company name] · [Chamber of Commerce number] · [Registered address] · [VAT number]",
    reminder: {
      subject: "Have you taken your first step yet?",
      heading: "Just a nudge",
      intro: "A few days ago you got your Idea Book. One of the ideas was {title} — {action}",
      ctaLabel: "View your Idea Book",
    },
  },
  pdfChrome: {
    coverEyebrow: "YOUR WINDOW IDEA BOOK",
    coverTagline: "A handful of possibilities, shaped around what you told us.",
    profileEyebrow: "YOUR PROFILE",
    mustHaves: "MUST-HAVES",
    preferences: "PREFERENCES",
    possibilityEyebrow: "POSSIBILITY",
    wildcardFallbackHeading: "THE WILDCARD",
    whyItFitsFallback: "Why this fits you",
    stepsFallback: "Steps",
    firstActionFallback: "You can do this now",
    practicalFallback: "Practical",
    locationFallback: "Location",
    requirementsFallback: "What you'll need",
    mapLinkLabel: "view on map",
    footerWordmark: "WINDOW  ·  Your Idea Book",
  },
  intake: {
    pageTitle: "Open a Window — WINDOW",
    stepWord: "Step",
    ofWord: "of",
    back: "Back",
    continueLabel: "Continue",
    opening: "Opening…",
    makeThisReal: "Make this real",
    errorGeneric: "Something went wrong. Please try again.",
    pages: {
      situation: {
        heading: "Your situation",
        subheading: "The starting point — what's going on, and what you're really after.",
      },
      about: {
        heading: "About you",
        subheading: "Helps us pitch possibilities that actually fit your life.",
      },
      dials: {
        heading: "Your style",
        subheading:
          "Set these however feels right for today — every one defaults to the middle until you touch it.",
      },
      openness: {
        heading: "What you're open to",
        subheading:
          "The shape of the possibilities, and anything we should know before we start.",
      },
      final: {
        heading: "Final touches",
        subheading: "Almost there.",
      },
    },
    situation: {
      label: "What's going on?",
      sub: "A mood, a moment, a Tuesday that needs rescuing. Pick a starting point, or write your own.",
      placeholder: "A tough week, a birthday with no plan yet, a bit of restlessness…",
      suggestions: [
        "I've been bored for weeks",
        "I need a day to myself",
        "It's been a strange week",
        "Honestly, I'm not sure",
      ],
      optionalHint: "That's fine too — we'll work with whatever you tell us next.",
    },
    purpose: {
      label: "What are you really after?",
      options: [
        { value: "self", label: "Something to do, just for me" },
        { value: "gift", label: "A gift or surprise for someone else" },
        { value: "problem", label: "A specific problem to solve" },
        { value: "curious", label: "Just curious what's out there" },
      ],
    },
    purposeFollowUp: {
      self: {
        label: "What kind of experience are you imagining?",
        sub: "Paint us a rough picture — we'll fill in the rest. Two sentences is plenty, no essay needed.",
        placeholder: "Something that gets me out of the house and off my phone…",
        suggestions: [
          "Something I'll look back on fondly",
          "Something totally different from my routine",
          "Just something fun, surprise me",
        ],
      },
      gift: {
        label: "Tell us about them.",
        sub: "Who are they, and what do they love? Two sentences is plenty, no essay needed.",
        placeholder: "My sister, who's obsessed with plants and terrible puns…",
        suggestions: [
          "My partner, who loves good food and surprises",
          "A friend who seems to already have everything",
          "A coworker who could use a pick-me-up",
        ],
      },
      problem: {
        label: "What's the problem, exactly?",
        sub: "The more specific, the better we can work with it. Two sentences is plenty, no essay needed.",
        placeholder: "I keep saying yes to things I don't actually want to do…",
        suggestions: [
          "I never get around to doing something for myself",
          "I barely see my friends anymore",
          "I've lost track of what I actually enjoy",
        ],
      },
      curious: {
        label: "What's sparking your curiosity?",
        sub: "A theme, a feeling, a rabbit hole you've been meaning to fall into. Two sentences is plenty, no essay needed.",
        placeholder: "I've been wondering what else my weekends could look like…",
        suggestions: [
          "I just want to try something new",
          "I'm curious what I haven't discovered in my own city yet",
          "No idea — surprise me",
        ],
      },
    },
    ageCategory: {
      label: "Age bracket",
      options: [
        { value: "under18", label: "Under 18" },
        { value: "18-24", label: "18–24" },
        { value: "25-34", label: "25–34" },
        { value: "35-44", label: "35–44" },
        { value: "45-54", label: "45–54" },
        { value: "55-64", label: "55–64" },
        { value: "65plus", label: "65+" },
      ],
    },
    location: {
      label: "Where are you based?",
      sub: "City or region is plenty.",
      placeholder: "Rotterdam, or somewhere nearby…",
    },
    searchDistance: {
      label: "How far should we look?",
      options: [
        { value: "nearby", label: "Just nearby" },
        { value: "city", label: "Within my city" },
        { value: "hour", label: "Within an hour" },
        { value: "anywhere", label: "Anywhere at all" },
      ],
    },
    freeTimePattern: {
      label: "A free Saturday suddenly opens up. What do you do?",
      sub: "Not what you'd feel you should do — what you'd actually do.",
      options: [
        { value: "familiar", label: "Plan something I already know and trust" },
        { value: "search", label: "Go looking for something interesting" },
        { value: "ask", label: "Ask someone else what they want to do" },
        { value: "spontaneous", label: "Just decide on the spot, spontaneously" },
        { value: "stayhome", label: "Stay home and see what happens" },
      ],
    },
    practicalToWild: {
      label: "Keep it safe, or let it surprise you?",
      options: [
        { value: "grounded", label: "Keep it predictable and familiar" },
        { value: "practical", label: "Mostly practical, little surprise" },
        { value: "either", label: "Open to either" },
        { value: "unexpected", label: "Surprise me now and then" },
        { value: "wild", label: "Surprise me completely, take me somewhere wild" },
      ],
    },
    timeAvailable: {
      label: "How much time do you have?",
      options: [
        { value: "hour", label: "An hour or two" },
        { value: "halfday", label: "Half a day" },
        { value: "fullday", label: "A full day" },
        { value: "weekend", label: "A whole weekend" },
      ],
    },
    budget: {
      label: "Your budget",
      options: [
        { value: "free", label: "Keep it free" },
        { value: "25", label: "Up to €25" },
        { value: "100", label: "Up to €100" },
        { value: "allin", label: "Go all in" },
      ],
    },
    effort: {
      label: "How much effort do you want to put in?",
      options: [
        { value: "minimal", label: "As little as possible" },
        { value: "some", label: "A bit of effort is fine" },
        { value: "committed", label: "I'm ready to commit" },
      ],
    },
    solutionTypes: {
      label: "What kind of possibilities are you open to?",
      sub: "Pick as many as feel right.",
      options: [
        { value: "activity", label: "An activity or outing" },
        { value: "gift", label: "A gift" },
        { value: "recipe", label: "A recipe or meal" },
        { value: "habit", label: "A habit or ritual" },
        { value: "conversation", label: "A conversation" },
        { value: "creative", label: "A creative project" },
      ],
    },
    opennessIntro:
      "Two kinds of wishes: things that really can't happen (a hard limit), and things that would be nice but aren't essential (a preference). Not sure? Put it under preferences — we'll filter more loosely there.",
    mustHaves: {
      label: "What absolutely can't be missing — or has to stay away?",
      sub: "Hard requirements only — think allergies, a pet that has to come along, a time that just doesn't work.",
      placeholder: "Needs to be dog-friendly, must be outdoors, no seafood…",
      suggestions: ["Needs to work with a dog", "No alcohol", "Wheelchair accessible"],
      optionalHint: "Nothing hard? Feel free to skip.",
    },
    preferences: {
      label: "And what would be nice, but isn't a dealbreaker?",
      sub: "Small nudges in a direction — we'll happily bend these if something else fits better.",
      placeholder: "I'd love something creative, ideally outdoors…",
      suggestions: ["Ideally outdoors", "Something creative", "Not too busy"],
      optionalHint: "No preference? That's fine too.",
    },
    personalReflection: {
      label: "What would you secretly love to do more of?",
      sub: "The question you don't usually get asked — this one weighs heavily.",
      placeholder: "I'd love to…",
      suggestions: [
        "Make something with my hands",
        "Go out and explore on my own",
        "Spend more time outdoors",
      ],
      optionalHint: "Fine to leave blank — we'll lean on the rest of your answers instead.",
    },
    company: {
      label: "Who's this window for?",
      sub: {
        self: "Who's coming along, if anyone.",
        gift: "This is about who's there when the moment itself happens — not about who receives the gift.",
        problem: "Who's coming along, if anyone.",
        curious: "Who's coming along, if anyone.",
      },
      options: [
        { value: "alone", label: "Just me" },
        { value: "partner", label: "A partner" },
        { value: "friends", label: "Friends" },
        { value: "family", label: "Family" },
        { value: "colleagues", label: "Colleagues" },
      ],
    },
  },
};

const dictionaries: Record<Locale, Dictionary> = { nl, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
