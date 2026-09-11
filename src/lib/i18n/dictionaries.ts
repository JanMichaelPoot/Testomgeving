import type { Locale } from "@/lib/locale";

export interface Option {
  value: string;
  label: string;
}

interface FollowUpCopy {
  label: string;
  sub: string;
  placeholder: string;
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
    privacySections: { heading: string; body: string }[];
    termsTitle: string;
    termsHeading: string;
    termsIntro: string;
    termsSections: { heading: string; body: string }[];
  };
  checkout: {
    pageTitle: string;
    heading: string;
    priceCaption: string;
    subcopy: string;
    stepsHeading: string;
    steps: string[];
    disclaimer: string;
    waiverLabel: string;
    giftToggleLabel: string;
    giftEmailLabel: string;
    giftEmailPlaceholder: string;
    ctaIdle: string;
    ctaPending: string;
    errorGeneric: string;
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
    errorFallback: string;
    generating: {
      heading: string;
      messages: string[];
      autoRefreshNote: string;
    };
    eyebrow: string;
    mustHaves: string;
    preferences: string;
    possibilitiesHeading: string;
    wildcardFallback: string;
    downloadPdf: string;
    emailedCopy: string;
    shareButtonLabel: string;
    shareCopiedLabel: string;
    book: {
      profileEyebrow: string;
      preferencesEyebrow: string;
      viewIdeas: string;
      back: string;
      next: string;
      ideaLabel: string;
      ofWord: string;
      wildcardLabel: string;
      wildcardIntro: string;
      wildcardYes: string;
      wildcardNo: string;
      doneHeading: string;
      doneSub: string;
      statsIdeasLabel: string;
      statsActionsLabel: string;
      statsWildcardLabel: string;
      statsWildcardValue: string;
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
    practicalToWild: { label: string; options: Option[] };
    surpriseLevel: { label: string; options: Option[] };
    timeAvailable: { label: string; options: Option[] };
    budget: { label: string; options: Option[] };
    effort: { label: string; options: Option[] };
    solutionTypes: { label: string; sub: string; options: Option[] };
    opennessIntro: string;
    mustHaves: { label: string; sub: string; placeholder: string; suggestions: string[] };
    preferences: { label: string; sub: string; placeholder: string; suggestions: string[] };
    company: { label: string; sub: string; options: Option[] };
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
    ctaCaption: "Geen account nodig · vanaf {price} · herroepingsrecht van 14 dagen",
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
        heading: "Wie zijn we",
        body: "WINDOW is een klein product in de testfase. Vragen of verzoeken over je gegevens? Mail naar hello@windowinto.nl.",
      },
      {
        heading: "Welke gegevens we verzamelen",
        body: "Je intake-antwoorden (je situatie, leeftijd, locatie en voorkeuren) en, als je betaalt, het e-mailadres dat je bij Stripe invult. WINDOW slaat zelf nooit kaart- of betaalgegevens op — dat verloopt volledig via Stripe.",
      },
      {
        heading: "Waarvoor we het gebruiken",
        body: "Uitsluitend om jouw Idea Book samen te stellen en te versturen. We verkopen of delen je gegevens nooit aan derden.",
      },
      {
        heading: "Hoe lang we het bewaren",
        body: "Je intake-antwoorden blijven gekoppeld aan een anonieme sessie, niet aan je naam of e-mailadres. Pas zodra je betaalt, koppelen we je e-mailadres aan die sessie om je Idea Book te kunnen versturen.",
      },
      {
        heading: "Jouw rechten",
        body: "Je kunt op elk moment inzage of verwijdering van je gegevens aanvragen. Mail daarvoor naar hello@windowinto.nl.",
      },
      {
        heading: "Cookies en analytics",
        body: "We gebruiken PostHog om te begrijpen hoe WINDOW gebruikt wordt. Waar dat wettelijk verplicht is, vragen we eerst je toestemming.",
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
  },
  checkout: {
    pageTitle: "Maak het echt — WINDOW",
    heading: "Jouw Idea Book",
    priceCaption: "eenmalig, inclusief btw",
    subcopy:
      "Een handvol mogelijkheden, gevormd naar wat je ons hebt verteld — plus eentje die we eigenlijk niet zouden moeten voorstellen, maar toch doen.",
    stepsHeading: "Wat er nu gebeurt",
    steps: [
      "Je betaalt eenmalig {price} — veilig via Stripe.",
      "Binnen een minuut stellen we jouw Idea Book samen.",
      "Je ziet 'm meteen hier, en we mailen 'm ook naar je.",
    ],
    disclaimer:
      "WINDOW biedt mogelijkheden om te verkennen — geen medisch, therapeutisch, financieel of juridisch advies. Gebruik je eigen inzicht en raadpleeg een professional waar dat nodig is.",
    waiverLabel:
      "Ik begrijp dat mijn Idea Book digitaal en direct wordt geleverd, waardoor mijn wettelijke bedenktijd van 14 dagen vervalt zodra de betaling is voltooid.",
    giftToggleLabel: "Dit is een cadeau — stuur het naar iemand anders",
    giftEmailLabel: "E-mailadres van de ontvanger",
    giftEmailPlaceholder: "naam@voorbeeld.nl",
    ctaIdle: "Maak het echt",
    ctaPending: "Checkout wordt geopend…",
    errorGeneric: "Er ging iets mis bij het openen van de checkout. Probeer het opnieuw.",
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
    mustHaves: "Vereisten",
    preferences: "Voorkeuren",
    possibilitiesHeading: "Jouw mogelijkheden",
    wildcardFallback: "De wildcard",
    downloadPdf: "Download PDF",
    emailedCopy: "We hebben ook een kopie gemaild.",
    shareButtonLabel: "Deel je Idea Book",
    shareCopiedLabel: "Link gekopieerd!",
    book: {
      profileEyebrow: "Dit hebben we over je ontdekt",
      preferencesEyebrow: "Waar we rekening mee hielden",
      viewIdeas: "Bekijk de ideeën",
      back: "Terug",
      next: "Verder",
      ideaLabel: "Idee",
      ofWord: "van",
      wildcardLabel: "Het wilde idee",
      wildcardIntro: "Dit stellen we normaal niet zomaar voor — maar bij jou past het toch.",
      wildcardYes: "Ik durf het aan",
      wildcardNo: "Nee, laat maar",
      doneHeading: "Dat was 'm — jouw Idea Book",
      doneSub: "Bewaar 'm, deel 'm, of begin gewoon met de eerste stap.",
      statsIdeasLabel: "Ideeën",
      statsActionsLabel: "Stappen",
      statsWildcardLabel: "Wildcard",
      statsWildcardValue: "1",
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
        heading: "Jouw dials",
        subheading: "Zet ze zoals het vandaag voelt — elke dial start in het midden.",
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
      },
      gift: {
        label: "Vertel ons over diegene.",
        sub: "Wie is het, en waar houdt diegene van? Twee zinnen is genoeg, we hebben geen essay nodig.",
        placeholder: "Mijn zus, die geobsedeerd is door planten en vreselijke woordgrappen…",
      },
      problem: {
        label: "Wat is het probleem precies?",
        sub: "Hoe specifieker, hoe beter we ermee aan de slag kunnen. Twee zinnen is genoeg, we hebben geen essay nodig.",
        placeholder: "Ik zeg steeds ja tegen dingen die ik eigenlijk niet wil doen…",
      },
      curious: {
        label: "Wat prikkelt je nieuwsgierigheid?",
        sub: "Een thema, een gevoel, een konijnenhol waar je al lang in wilde vallen. Twee zinnen is genoeg, we hebben geen essay nodig.",
        placeholder: "Ik vraag me af hoe mijn weekenden er ook uit zouden kunnen zien…",
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
    practicalToWild: {
      label: "Met beide benen op de grond, of een beetje wild?",
      options: [
        { value: "grounded", label: "Hou het bij de grond" },
        { value: "practical", label: "Vooral praktisch" },
        { value: "either", label: "Sta open voor beide" },
        { value: "unexpected", label: "Neig naar onverwacht" },
        { value: "wild", label: "Neem me mee naar iets wilds" },
      ],
    },
    surpriseLevel: {
      label: "Hoeveel mogen we je verrassen?",
      options: [
        { value: "barely", label: "Nauwelijks" },
        { value: "little", label: "Een beetje onverwacht" },
        { value: "weird", label: "Aangenaam vreemd" },
        { value: "complete", label: "Verras me volledig" },
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
        { value: "activity", label: "Een activiteit" },
        { value: "gift", label: "Een cadeau" },
        { value: "trip", label: "Een uitje" },
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
      sub: "Optioneel. Alleen harde eisen, denk: allergieën, een dier dat mee moet, een tijdstip dat niet kan.",
      placeholder: "Moet hondvriendelijk zijn, moet buiten zijn, geen vis of schaaldieren…",
      suggestions: ["Moet met de hond kunnen", "Geen alcohol", "Rolstoeltoegankelijk"],
    },
    preferences: {
      label: "En wat zou fijn zijn, maar is geen dealbreaker?",
      sub: "Optioneel. Kleine duwtjes in een richting — we wijken hier soepel van af als het net beter past.",
      placeholder: "Ik zou iets creatiefs geweldig vinden, het liefst buiten…",
      suggestions: ["Het liefst buiten", "Iets creatiefs", "Niet te druk"],
    },
    company: {
      label: "Voor wie is dit venster?",
      sub: "Wie er eventueel bij is.",
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
    ctaCaption: "No account needed · from {price} · 14-day right of withdrawal",
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
        heading: "Who we are",
        body: "WINDOW is a small product still in its testing phase. Questions or requests about your data? Email hello@windowinto.nl.",
      },
      {
        heading: "What data we collect",
        body: "Your intake answers (your situation, age, location and preferences) and, if you pay, the email address you enter with Stripe. WINDOW never stores card or payment details itself — that runs entirely through Stripe.",
      },
      {
        heading: "What we use it for",
        body: "Solely to put together and send your Idea Book. We never sell or share your data with third parties.",
      },
      {
        heading: "How long we keep it",
        body: "Your intake answers stay linked to an anonymous session, not to your name or email. Only once you pay do we link your email address to that session, so we can send your Idea Book.",
      },
      {
        heading: "Your rights",
        body: "You can request access to or deletion of your data at any time. Email hello@windowinto.nl.",
      },
      {
        heading: "Cookies and analytics",
        body: "We use PostHog to understand how WINDOW is used. Where required by law, we ask for your consent first.",
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
  },
  checkout: {
    pageTitle: "Make this real — WINDOW",
    heading: "Your Idea Book",
    priceCaption: "one-time, VAT included",
    subcopy:
      "A handful of possibilities, shaped around what you told us — plus one we probably shouldn't suggest, but will anyway.",
    stepsHeading: "What happens next",
    steps: [
      "You pay {price} once — securely via Stripe.",
      "Within a minute, we put your Idea Book together.",
      "You'll see it right here, and we'll email you a copy too.",
    ],
    disclaimer:
      "WINDOW offers possibilities to explore — not medical, therapeutic, financial, or legal advice. Use your own judgment, and consult a professional where it matters.",
    waiverLabel:
      "I understand that my Idea Book is delivered digitally and immediately, so my statutory 14-day right of withdrawal no longer applies once payment completes.",
    giftToggleLabel: "This is a gift — send it to someone else",
    giftEmailLabel: "Recipient's email address",
    giftEmailPlaceholder: "name@example.com",
    ctaIdle: "Make this real",
    ctaPending: "Opening checkout…",
    errorGeneric: "Something went wrong opening checkout. Please try again.",
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
    mustHaves: "Must-haves",
    preferences: "Preferences",
    possibilitiesHeading: "Your possibilities",
    wildcardFallback: "The wildcard",
    downloadPdf: "Download PDF",
    emailedCopy: "We've also emailed a copy.",
    shareButtonLabel: "Share your Idea Book",
    shareCopiedLabel: "Link copied!",
    book: {
      profileEyebrow: "Here's what we picked up about you",
      preferencesEyebrow: "What we kept in mind",
      viewIdeas: "See the ideas",
      back: "Back",
      next: "Next",
      ideaLabel: "Idea",
      ofWord: "of",
      wildcardLabel: "The wild idea",
      wildcardIntro: "We wouldn't normally suggest this — but for you, it actually fits.",
      wildcardYes: "I'm in",
      wildcardNo: "No, skip this one",
      doneHeading: "That's it — your Idea Book",
      doneSub: "Save it, share it, or just start with the first step.",
      statsIdeasLabel: "Ideas",
      statsActionsLabel: "Steps",
      statsWildcardLabel: "Wildcard",
      statsWildcardValue: "1",
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
        heading: "Your dials",
        subheading: "Set these however feels right for today — every one defaults to the middle.",
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
      },
      gift: {
        label: "Tell us about them.",
        sub: "Who are they, and what do they love? Two sentences is plenty, no essay needed.",
        placeholder: "My sister, who's obsessed with plants and terrible puns…",
      },
      problem: {
        label: "What's the problem, exactly?",
        sub: "The more specific, the better we can work with it. Two sentences is plenty, no essay needed.",
        placeholder: "I keep saying yes to things I don't actually want to do…",
      },
      curious: {
        label: "What's sparking your curiosity?",
        sub: "A theme, a feeling, a rabbit hole you've been meaning to fall into. Two sentences is plenty, no essay needed.",
        placeholder: "I've been wondering what else my weekends could look like…",
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
    practicalToWild: {
      label: "Grounded, or a little wild?",
      options: [
        { value: "grounded", label: "Keep it grounded" },
        { value: "practical", label: "Mostly practical" },
        { value: "either", label: "Open to either" },
        { value: "unexpected", label: "Lean unexpected" },
        { value: "wild", label: "Take me somewhere wild" },
      ],
    },
    surpriseLevel: {
      label: "How much should we surprise you?",
      options: [
        { value: "barely", label: "Barely at all" },
        { value: "little", label: "A little unexpected" },
        { value: "weird", label: "Pleasantly weird" },
        { value: "complete", label: "Surprise me completely" },
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
        { value: "activity", label: "An activity" },
        { value: "gift", label: "A gift" },
        { value: "trip", label: "A trip" },
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
      sub: "Optional. Hard requirements only — think allergies, a pet that has to come along, a time that just doesn't work.",
      placeholder: "Needs to be dog-friendly, must be outdoors, no seafood…",
      suggestions: ["Needs to work with a dog", "No alcohol", "Wheelchair accessible"],
    },
    preferences: {
      label: "And what would be nice, but isn't a dealbreaker?",
      sub: "Optional. Small nudges in a direction — we'll happily bend these if something else fits better.",
      placeholder: "I'd love something creative, ideally outdoors…",
      suggestions: ["Ideally outdoors", "Something creative", "Not too busy"],
    },
    company: {
      label: "Who's this window for?",
      sub: "Who's coming along, if anyone.",
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
