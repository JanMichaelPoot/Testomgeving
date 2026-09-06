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
  header: { switchLanguage: string };
  footer: { privacy: string; terms: string };
  landing: {
    headlineLine1: string;
    headlineLine2: string;
    subcopy: string;
    cta: string;
    heroAlt: string;
  };
  legal: {
    privacyTitle: string;
    privacyHeading: string;
    privacyBody: string;
    termsTitle: string;
    termsHeading: string;
    termsBody: string;
  };
  checkout: {
    pageTitle: string;
    heading: string;
    subcopy: string;
    disclaimer: string;
    waiverLabel: string;
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
    eyebrow: string;
    mustHaves: string;
    preferences: string;
    possibilitiesHeading: string;
    wildcardFallback: string;
    downloadPdf: string;
    emailedCopy: string;
  };
  email: { subjectSuffix: string; heading: string; viewOnline: string };
  pdfChrome: {
    coverEyebrow: string;
    coverTagline: string;
    profileEyebrow: string;
    mustHaves: string;
    preferences: string;
    possibilityEyebrow: string;
    wildcardFallbackHeading: string;
    stepsFallback: string;
    firstActionFallback: string;
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
    situation: { label: string; sub: string; placeholder: string };
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
    mustHaves: { label: string; sub: string; placeholder: string };
    preferences: { label: string; sub: string; placeholder: string };
    company: { label: string; sub: string; options: Option[] };
  };
}

const nl: Dictionary = {
  header: { switchLanguage: "Taal wisselen" },
  footer: { privacy: "Privacy", terms: "Voorwaarden" },
  landing: {
    headlineLine1: "Een Venster Naar",
    headlineLine2: "Wat Zou Kunnen Zijn",
    subcopy:
      "Je hebt niet nog een antwoord nodig. Soms moet je gewoon een andere mogelijkheid zien.",
    cta: "Open een Venster",
    heroAlt: "Een venster dat opengaat naar een warm verlichte, onverwachte mogelijkheid",
  },
  legal: {
    privacyTitle: "Privacybeleid — WINDOW",
    privacyHeading: "Privacybeleid",
    privacyBody:
      "Placeholder — deze pagina bevat nog geen definitief privacybeleid. De uiteindelijke tekst volgt vóór de publieke lancering.",
    termsTitle: "Algemene Voorwaarden — WINDOW",
    termsHeading: "Algemene Voorwaarden",
    termsBody:
      "Placeholder — deze pagina bevat nog geen definitieve algemene voorwaarden. De uiteindelijke tekst volgt vóór de publieke lancering.",
  },
  checkout: {
    pageTitle: "Maak het echt — WINDOW",
    heading: "Jouw Idea Book is klaar om samengesteld te worden",
    subcopy:
      "Een handvol mogelijkheden, gevormd naar wat je ons hebt verteld — plus eentje die we eigenlijk niet zouden moeten voorstellen, maar toch doen.",
    disclaimer:
      "WINDOW biedt mogelijkheden om te verkennen — geen medisch, therapeutisch, financieel of juridisch advies. Gebruik je eigen inzicht en raadpleeg een professional waar dat nodig is.",
    waiverLabel:
      "Ik begrijp dat mijn Idea Book digitaal en direct wordt geleverd, waardoor mijn wettelijke bedenktijd van 14 dagen vervalt zodra de betaling is voltooid.",
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
    eyebrow: "Jouw Idea Book",
    mustHaves: "Vereisten",
    preferences: "Voorkeuren",
    possibilitiesHeading: "Jouw mogelijkheden",
    wildcardFallback: "De wildcard",
    downloadPdf: "Download PDF",
    emailedCopy: "We hebben je ook een kopie gemaild.",
  },
  email: {
    subjectSuffix: "je mogelijkheden zijn klaar",
    heading: "Jouw mogelijkheden",
    viewOnline: "Bekijk je Idea Book online",
  },
  pdfChrome: {
    coverEyebrow: "JOUW WINDOW IDEA BOOK",
    coverTagline: "Een handvol mogelijkheden, gevormd naar wat je ons vertelde.",
    profileEyebrow: "JOUW PROFIEL",
    mustHaves: "VEREISTEN",
    preferences: "VOORKEUREN",
    possibilityEyebrow: "MOGELIJKHEID",
    wildcardFallbackHeading: "DE WILDCARD",
    stepsFallback: "Stappen",
    firstActionFallback: "Praktische info",
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
      sub: "Een gevoel, een moment, een dinsdag die wel een reddingsactie kan gebruiken.",
      placeholder: "Een zware week, een verjaardag zonder plan, een beetje rusteloosheid…",
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
        sub: "Schets ons een ruw beeld — de rest vullen wij aan.",
        placeholder: "Iets waardoor ik het huis uit kom en mijn telefoon wegleg…",
      },
      gift: {
        label: "Vertel ons over diegene.",
        sub: "Wie is het, en waar houdt diegene van?",
        placeholder: "Mijn zus, die geobsedeerd is door planten en vreselijke woordgrappen…",
      },
      problem: {
        label: "Wat is het probleem precies?",
        sub: "Hoe specifieker, hoe beter we ermee aan de slag kunnen.",
        placeholder: "Ik zeg steeds ja tegen dingen die ik eigenlijk niet wil doen…",
      },
      curious: {
        label: "Wat prikkelt je nieuwsgierigheid?",
        sub: "Een thema, een gevoel, een konijnenhol waar je al lang in wilde vallen.",
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
    mustHaves: {
      label: "Iets wat niet onderhandelbaar is?",
      sub: "Optioneel — harde eisen waar we nooit van mogen afwijken.",
      placeholder: "Moet hondvriendelijk zijn, moet buiten zijn, geen vis of schaaldieren…",
    },
    preferences: {
      label: "Iets wat je liever hebt, maar geen dealbreaker is?",
      sub: "Optioneel — duwtjes in een richting, geen regels.",
      placeholder: "Ik zou iets creatiefs geweldig vinden, het liefst buiten…",
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
  header: { switchLanguage: "Switch language" },
  footer: { privacy: "Privacy", terms: "Terms" },
  landing: {
    headlineLine1: "A Window Into",
    headlineLine2: "What Could Be",
    subcopy:
      "You don't need another answer. Sometimes you need to see another possibility.",
    cta: "Open a Window",
    heroAlt: "A window opening onto a warmly lit, unexpected possibility",
  },
  legal: {
    privacyTitle: "Privacy Policy — WINDOW",
    privacyHeading: "Privacy Policy",
    privacyBody:
      "Placeholder — this page does not yet contain a reviewed privacy policy. Final copy to follow before public launch.",
    termsTitle: "Terms of Service — WINDOW",
    termsHeading: "Terms of Service",
    termsBody:
      "Placeholder — this page does not yet contain reviewed terms of service. Final copy to follow before public launch.",
  },
  checkout: {
    pageTitle: "Make this real — WINDOW",
    heading: "Your Idea Book is ready to be put together",
    subcopy:
      "A handful of possibilities, shaped around what you told us — plus one we probably shouldn't suggest, but will anyway.",
    disclaimer:
      "WINDOW offers possibilities to explore — not medical, therapeutic, financial, or legal advice. Use your own judgment, and consult a professional where it matters.",
    waiverLabel:
      "I understand that my Idea Book is delivered digitally and immediately, so my statutory 14-day right of withdrawal no longer applies once payment completes.",
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
    eyebrow: "Your Idea Book",
    mustHaves: "Must-haves",
    preferences: "Preferences",
    possibilitiesHeading: "Your possibilities",
    wildcardFallback: "The wildcard",
    downloadPdf: "Download PDF",
    emailedCopy: "We've also emailed you a copy.",
  },
  email: {
    subjectSuffix: "your possibilities are ready",
    heading: "Your possibilities",
    viewOnline: "View your Idea Book online",
  },
  pdfChrome: {
    coverEyebrow: "YOUR WINDOW IDEA BOOK",
    coverTagline: "A handful of possibilities, shaped around what you told us.",
    profileEyebrow: "YOUR PROFILE",
    mustHaves: "MUST-HAVES",
    preferences: "PREFERENCES",
    possibilityEyebrow: "POSSIBILITY",
    wildcardFallbackHeading: "THE WILDCARD",
    stepsFallback: "Steps",
    firstActionFallback: "Practical info",
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
      sub: "A mood, a moment, a Tuesday that needs rescuing.",
      placeholder: "A tough week, a birthday with no plan yet, a bit of restlessness…",
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
        sub: "Paint us a rough picture — we'll fill in the rest.",
        placeholder: "Something that gets me out of the house and off my phone…",
      },
      gift: {
        label: "Tell us about them.",
        sub: "Who are they, and what do they love?",
        placeholder: "My sister, who's obsessed with plants and terrible puns…",
      },
      problem: {
        label: "What's the problem, exactly?",
        sub: "The more specific, the better we can work with it.",
        placeholder: "I keep saying yes to things I don't actually want to do…",
      },
      curious: {
        label: "What's sparking your curiosity?",
        sub: "A theme, a feeling, a rabbit hole you've been meaning to fall into.",
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
    mustHaves: {
      label: "Anything that's non-negotiable?",
      sub: "Optional — hard requirements we should never violate.",
      placeholder: "Needs to be dog-friendly, must be outdoors, no seafood…",
    },
    preferences: {
      label: "Anything you'd prefer, but isn't a dealbreaker?",
      sub: "Optional — nudges rather than rules.",
      placeholder: "I'd love something creative, ideally outdoors…",
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
