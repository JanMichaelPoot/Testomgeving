import { doorRange } from "@/lib/productStructure";
// Copy of the image intake and its window ("Het venster", WindowInto/WINDOW_Bouwopdracht_Venster_Fase0-8.md).
// Kept in its own file because dictionaries.ts is already very long; it is part of the same
// Dictionary (dict.venster) and follows the same rules: nl and en, same tone (warm, curious,
// a little mischievous). "{name}" is the first name of the person the search is for, or a neutral
// fallback (see fill() in AssociationWizard).

export interface VensterDictionary {
  landing: {
    selfCta: string;
    heroCta: string; // the big button in the hero (the banner at the bottom keeps selfCta)
    heroCtaNote: string; // the line under it
    badge: string; // {price}
    headline: string;
    headlineEmphasis: string; // the italic part, shown after headline
    subcopy: string;
    heroAlt: string;
    chapters: { title: string; body: string }[];
    /** The share icons under the hero button. */
    share: {
      heading: string;
      nativeLabel: string;
      whatsapp: string;
      instagram: string;
      facebook: string;
      x: string;
      linkedin: string;
      email: string;
      copiedForInstagram: string;
      text: string;
      emailSubject: string;
    };
  };
  chapters: { images: string; situation: string; extra: string };
  recipientFallback: string;
  recipientLabel: string;
  recipientPlaceholder: string;
  testLimit: { title: string; body: string; back: string };
  errors: { notFoundTitle: string; notFoundBody: string; home: string; errorTitle: string; errorBody: string; retry: string; bookLanguage: string };
  worlds: { heading: string; headingGift: string; sub: string; surprise: string; surpriseSub: string; chosen: string; more: string };
  // The image intake in two pages (docs/fase4-opzet.md): page 1 images, page 2 concrete activities.
  twoPages: {
    // Profile screen: a chosen activity that a limit from the situation screen rules out.
    dropped: {
      title: string;
      body: string;
      reasons: Record<"season" | "audience" | "kids" | "young_kids" | "access" | "calm" | "no_alcohol" | "quiet" | "meet" | "no_dutch" | "hunt_fish" | "animals" | "budget" | "effort" | "supervised" | "setting" | "format" | "groups", string>;
      editSituation: string;
      editChoices: string;
    };
    steps: { images: string; concrete: string };
    /** The small "first wide, then sharp" indicator above both pages (divergent, then convergent thinking). */
    flow: { label: string; diverge: { title: string; sub: string }; converge: { title: string; sub: string } };
    /** The Back button names where it goes (visible text on the screens that have room for it). */
    backTo: { start: string; images: string; concrete: string };
    /** Going through the sets of images or activities that were shown: nothing chosen is lost by going back. */
    sets: { prev: string; next: string; counter: string };
    images: { kicker: string; heading: string; headingGift: string; sub: string; subGift: string; chosen: string; min: string; max: string; more: string; moreSub: string; noMore: string };
    concrete: {
      kicker: string;
      heading: string;
      headingGift: string;
      sub: string;
      subGift: string;
      chosen: string;
      /** "Choose as many as you like, up to {max}." */
      multi: string;
      min: string;
      max: string;
      more: string;
      moreSub: string;
      noMore: string;
      chooseForMe: string;
      chooseForMeSub: string;
      chooseForMeSubGift: string;
      maybe: string;
    };
  };
  rounds: Record<
    "places" | "moments" | "senses",
    { kicker: string; heading: string; headingGift: string; sub: string }
  >;
  roundUi: {
    grid: string;
    swipe: string;
    swipeHint: string;
    yes: string;
    no: string;
    roundDone: string;
    roundDoneBody: string; // {n}
    seeAll: string;
    chosen: string; // {n}
    max: string;
    skip: string;
    of: string; // {i}, {n}
  };
  // The last screen of the image intake: "Dit zagen we in jouw keuzes" (R2.1). Fixed sentence
  // parts only, assembled in src/lib/discovery/profileStory.ts; nothing here is generated.
  profile: {
    kicker: string;
    heading: string;
    headingGift: string; // {name}
    // The portrait: one headline line and two to four sentences of reading (not a list of what was chosen:
    // the thumbnails and the sill already show that). Every sentence is fixed text, picked by rules.
    and: string;
    headline: string; // {a} {b}: motifs
    headlineGift: string; // {name} {a} {b}
    headlineOne: string; // {a}
    headlineOneGift: string; // {name} {a}
    headlineNone: string;
    headlineNoneGift: string;
    /** A noun phrase per tag that can be read from the images: it follows "Je zoekt". */
    motifs: Record<string, string>;
    /** One sentence for a pair of tags that were both read from the images. */
    reads: { tags: [string, string]; text: string }[];
    /** One sentence per tag: what it is to want that. The fallback when no pair of tags has a sentence of its own. */
    tagLines: Record<string, string>;
    /** What the choices say next to who comes along. */
    aloneButTogether: string;
    quietTogether: string;
    leanLines: {
      inside: string;
      outside: string;
      calm: string;
      active: string;
      alone: string;
      together: string;
      familiar: string;
      fresh: string;
    };
    leanNeutral: string;
    /** Two-page intake: the activities they chose themselves; {list} {name}. */
    picksLine: string;
    picksLineGift: string;
    openHeadline: string;
    openHeadlineGift: string;
    openStory: string;
    openStoryGift: string; // {name}
    tension: Record<"social" | "energy" | "setting" | "novelty", string>;
    tensionGift: Record<"social" | "energy" | "setting" | "novelty", string>; // {name}
    strong: Record<"social" | "energy" | "setting" | "novelty", { low: string; high: string }>;
    strongGift: Record<"social" | "energy" | "setting" | "novelty", { low: string; high: string }>;
    balanced: string;
    balancedGift: string;
    open: string;
    openGift: string; // {name}
    /** Titles and fixed sentences of the short personal reading. */
    interpret: { threadTitle: string; directionTitle: string; chosenLabel: string };
    axes: Record<"social" | "energy" | "setting" | "novelty", { label: string; low: string; high: string }>;
    seekLines: {
      formats: Record<string, string>;
      outdoor: string;
      indoor: string;
      effortMinimal: string;
      effortCommitted: string;
      budget: Record<string, string>;
      time: Record<string, string>;
      distance: Record<string, string>;
    };
    omitLines: {
      noGroups: string;
      needsInside: string;
      needsOutside: string;
      formats: string;
      supervised: string;
      effortMinimal: string;
      effortSome: string;
      costFree: string;
      costMid: string;
      costLow: string;
    };
    missTitle: string;
    missTitleGift: string; // {name}
    missSub: string;
    missPlaceholder: string;
    suggestions: Record<string, string>;
    combos: { tags: [string, string]; text: string }[];
  };
  /** The central start page of the two-page intake: who we search for, where, and the few limits (all optional except the place). */
  start: {
    kicker: string;
    heading: string;
    sub: string;
    sections: { who: string; where: string; limits: string };
    /** The line under the heading: only the place is needed, the rest is optional. */
    optionalNote: string;
    /** The marker behind a required field, read out by a screen reader. */
    required: string;
    who: {
      label: string;
      labelGift: string;
      sub: string;
      /** "For myself" and "For someone else" are the two big choices; for someone else the kind of person follows. */
      options: Record<"self" | "child" | "adult" | "group", { label: string; sub: string }>;
      otherCard: { label: string; sub: string };
      otherPrompt: string;
      /** The small pill that stays on the screens after the start page: who the search is for. {name} is the first name. */
      pill: { self: string; other: string; named: string; group: string };
      nameLabel: string;
    };
    /** The country and the place, pre-filled from the connection as an indication. */
    country: { label: string; geoNote: string };
    /** The two sliders under the place: how far to travel, and what it may cost per person. */
    distance: { label: string; hint: string; upTo: string; over100: string; tickOver100: string };
    budget: { label: string; hint: string; unset: string; clear: string; upTo: string; any: string };
    limits: {
      sub: string;
      timeLabelOther: string;
      chipsLabel: string;
      chipsSub: string;
      /** The line under the chips: nothing ticked is fine. */
      chipsSkip: string;
      /** The heading of the grouped chips ("Tik aan wat voor jou belangrijk is"). */
      chipsTitle: string;
      optional: string;
      /** The chips of who.limitChips, grouped under a heading each (every chip appears in exactly one group). */
      groups: { title: string; chips: string[] }[];
    };
  };
  /** The merged "Jouw situatie" screen (place, time, budget, company; the rest behind "more"). */
  situation: { heading: string; headingGift: string };
  room: {
    locationLabel: string;
    locationLabelGift: string;
    locationSub: string;
    locationPlaceholder: string;
    distanceLabel: string;
    distanceOptions: { value: string; label: string }[];
    timeLabel: string;
    budgetLabel: string;
  };
  who: {
    limitChips: string[];
  };
  nav: {
    back: string;
    next: string;
    submit: string;
    submitting: string;
    windowOpen: string;
    windowClose: string;
    windowTitle: string;
    /** On the last screen: the line that says the order block is below, and the bar button that jumps to it. */
    scrollCue: string;
    toOrder: string;
    windowDownload: string;
    /** Why "Next" is greyed out, one line above the bar. {n} and {list} are filled in. */
    hint: { images: string; concrete: string; worlds: string; round: string; missing: string; place: string; time: string; budget: string };
  };
  panes: { worlds: string; places: string; moments: string; senses: string; surprise: string };
  sill: { empty: string; with: string };
  checkout: {
    heading: string;
    headingGift: string;
    whatYouGet: string[];
    freeNote: string; // what stays free, so the one price is clearly for the write-up
  };
  reveal: {
    chose: string; // {list}
    choseGift: string; // {list}
    wrote: string; // {text}
    because: string; // {image}
    becauseGift: string; // {image}
    placeLabel: string;
    mapLink: string;
  };
  // The thread per door: image -> what we read in it -> the door -> the real place (R2.2).
  thread: {
    heading: string;
    imageCaption: string;
    tagsCaption: string;
    doorCaption: string;
    /** Two-page intake: the door is an activity the person chose themselves. */
    ownDoorCaption: string;
    placeCaption: string;
    pdfBoth: string; // {image} {tags}
    pdfImage: string; // {image}
    pdfTags: string; // {tags}
    pdfOwn: string;
    // B5 / V2, only shown with KNOWLEDGE_ENGINE_V2: the activities between the image and the door, derived by us.
    pathCaption: string;
    pdfPath: string; // {path}
  };
  // More body per door (R2.3): feels like, three sizes, real places, related, what next.
  more: {
    heading: string;
    feelsHeading: string;
    sizesHeading: string;
    /** taste, do, deepen */
    sizeNames: [string, string, string];
    /** A small line under each size name: roughly how big it is. */
    sizeHints: [string, string, string];
    placesHeading: string;
    placesNote: string;
    /** "{score}" on a 0-5 scale, "{source}" where it was read, "{reviews}" the count (the part in [] is left out when unknown). */
    ratingLine: string;
    ratingReviews: string;
    /** The decimal separator of the language, for the score. */
    ratingDecimal: string;
    mapLink: string;
    siteLink: string;
    relatedHeading: string;
    nextHeading: string;
    /** The PDF's extra page: its small heading and the line above the idea's title. */
    pdfEyebrow: string;
  };
  // The general invitation card people can share (not personal): the page /delen and the button on /plan.
  invite: {
    button: string;
    heading: string;
    sub: string;
    formatStory: string;
    formatSquare: string;
    formatLabel: string;
    share: string;
    download: string;
    whatsapp: string;
    copyLink: string;
    copied: string;
    previewAlt: string;
    /** The text that goes with the picture and the link. */
    shareText: string;
    /** On the card itself. */
    cardHeadline: string;
    cardSub: string;
    cardCta: string;
  };
  feedback: {
    heading: string;
    sub: string;
    scoreLabel: string;
    scoreOptions: string[];
    /** R2.4: understood by the profile screen / got why these doors; both 1-5. */
    profileLabel: string;
    doorsLabel: string;
    agreeOptions: string[];
    pickLabel: string;
    pickNone: string;
    /** Did the places and providers in the book fit the tester's surroundings (1-5, the agree scale). */
    placesLabel: string;
    /** Did the e-mail with the book arrive. */
    mailLabel: string;
    mailOptions: { value: "inbox" | "spam" | "missing"; label: string }[];
    payLabel: string; // {price}
    payOptions: { value: "yes" | "maybe" | "no"; label: string }[];
    doubtLabel: string;
    doubtPlaceholder: string;
    submit: string;
    thanks: string;
    error: string;
  };
  pdf: { coverTitle: string; coverTitleGift: string; coverTitleGroup: string }; // {name}
  testBanner: string;
  errorGeneric: string;
}

export const vensterNl: VensterDictionary = {
  landing: {
    selfCta: "Open je venster",
    heroCta: "Kijk door het venster",
    heroCtaNote: "Kost 2 minuten · geen account nodig",
    badge: "Nieuw · {price} · geen account, klaar in minuten",
    headline: "Wat als je iets ontdekt waarvan je",
    headlineEmphasis: "nog niet wist dat het bij je past?",
    subcopy:
      "Kies een paar beelden waar je blij van wordt. Wij zoeken de activiteiten die daarbij horen: dingen waar je zelf misschien nooit aan dacht, met echte plekken bij jou in de buurt. Het begint met één blik door het venster.",
    heroAlt: "Een klassiek schuifraam met acht ruiten, elk met een ander beeld",
    share: {
      heading: "Deel WindowInto",
      nativeLabel: "Deel via je telefoon of computer",
      whatsapp: "Deel via WhatsApp",
      instagram: "Deel via Instagram",
      facebook: "Deel via Facebook",
      x: "Deel via X",
      linkedin: "Deel via LinkedIn",
      email: "Deel per e-mail",
      copiedForInstagram: "Link gekopieerd. Plak hem in Instagram.",
      text: "Ontdek wat er mogelijk is, voor jou. Open een venster op WindowInto:",
      emailSubject: "Ontdek wat er mogelijk is, met WindowInto",
    },
    chapters: [
      { title: "Jouw situatie", body: "Voor wie, waar en wat moet kloppen: de basis voor echte plekken in de buurt." },
      { title: "Jouw beelden", body: "Kies beelden en activiteiten die je aantrekken. Geen vragenlijst: klaar in ±3 minuten." },
      { title: "Jouw venster", body: "Lees hoe wij jou lezen en open je boek." },
    ],
  },
  chapters: { images: "Jouw beelden", situation: "Jouw situatie", extra: "Jouw venster" },
  // Used when the giver leaves the first name empty: a plain noun, so "Waar zou de ontvanger nu willen zijn?" reads naturally.
  recipientFallback: "de ontvanger",
  recipientLabel: "Voor wie is dit venster?",
  recipientPlaceholder: "Voornaam (mag leeg blijven)",
  testLimit: {
    title: "Je testboeken zijn op",
    body: "Tijdens de test kun je met één internetverbinding twee boeken maken, en dat zijn er al twee. Dank je wel voor het testen! Je gemaakte boeken blijven te openen via de link in je mail. Wil je er toch nog een maken? Stuur dan een berichtje naar degene die je uitnodigde.",
    back: "Naar de voorpagina",
  },
  errors: {
    notFoundTitle: "Deze pagina bestaat niet",
    notFoundBody: "Misschien is de link verlopen of verkeerd overgetypt. Vanaf het begin kom je er zo weer in.",
    home: "Naar het begin",
    errorTitle: "Er ging iets mis",
    errorBody: "Probeer het nog eens. Blijft het misgaan, kom dan straks even terug: je antwoorden gaan niet verloren.",
    retry: "Opnieuw proberen",
    bookLanguage: "Dit Idea Book is in het {language} geschreven, de taal waarin je het venster opende. Een nieuw venster openen in een andere taal kan altijd.",
  },
  worlds: {
    heading: "Waar gaat je nieuwsgierigheid naartoe?",
    headingGift: "Waar gaat de nieuwsgierigheid van {name} naartoe?",
    sub: "Kies één tot vier richtingen. Of laat ons kiezen.",
    surprise: "Verras me",
    surpriseSub: "We kiezen de richtingen voor je",
    chosen: "{n} gekozen",
    more: "Andere richtingen tonen",
  },
  twoPages: {
    dropped: {
      title: "Dit kon niet mee",
      body: "Je koos deze activiteiten, maar een grens die je daarna gaf, sluit ze uit. Je kunt de grens aanpassen of een andere keuze maken.",
      reasons: {
        season: "past niet bij de tijd van het jaar",
        audience: "past niet bij voor wie je zoekt",
        kids: "is niet voor kinderen",
        young_kids: "is niet geschikt voor jonge kinderen",
        access: "is niet te doen met een rolstoel",
        calm: "past niet bij een rustig tempo",
        no_alcohol: "draait om alcohol",
        quiet: "is druk, luid of onvoorspelbaar",
        meet: "biedt geen manier om mensen te ontmoeten",
        no_dutch: "wordt in het Nederlands gedaan",
        hunt_fish: "gaat over jagen of vissen",
        animals: "draait om dieren",
        budget: "past niet bij je budget",
        effort: "vraagt meer inspanning dan je aangaf",
        supervised: "vraagt begeleiding en past niet bij je voorkeur voor het vertrouwde",
        setting: "past niet bij je wens voor binnen of buiten",
        format: "kan niet op de manier waarop je wilt meedoen",
        groups: "is een groepsactiviteit",
      },
      editSituation: "Pas je situatie aan",
      editChoices: "Kies anders",
    },
    steps: { images: "Beelden", concrete: "Keuzes" },
    flow: {
      label: "Zo werkt het: eerst breed, dan scherp",
      diverge: { title: "Breed ontdekken", sub: "Kies intuïtief wat aanspreekt" },
      converge: { title: "Richting bepalen", sub: "Je keuzes worden activiteiten" },
    },
    backTo: { start: "Terug naar het begin", images: "Terug naar de beelden", concrete: "Terug naar de activiteiten" },
    sets: { prev: "Vorige set", next: "Volgende set", counter: "Set {i} van {n}" },
    images: {
      kicker: "Jouw beelden · 1 van 2",
      heading: "Welke beelden maken jou nieuwsgierig?",
      headingGift: "Welke beelden maken {name} nieuwsgierig? ‖ Welke beelden wekken nieuwsgierigheid? ‖ Welke beelden maken jullie nieuwsgierig?",
      sub: "Laat je verleiden door wat je ziet. Tik de beelden aan die je een goed gevoel geven: een plek, een geur, een moment om naar uit te kijken. Er is geen goed of fout. Vijf tot acht is mooi.",
      subGift: "Laat je verleiden door wat je ziet. Tik de beelden aan die {name} een goed gevoel zouden geven: een plek, een geur, een moment om naar uit te kijken. Er is geen goed of fout. Vijf tot acht is mooi. ‖ Laat je verleiden door wat je ziet. Tik de beelden aan die een goed gevoel zouden geven: een plek, een geur, een moment om naar uit te kijken. Er is geen goed of fout. Vijf tot acht is mooi. ‖ Laat je verleiden door wat je ziet. Tik de beelden aan die jullie een goed gevoel geven: een plek, een geur, een moment om naar uit te kijken. Er is geen goed of fout. Vijf tot acht is mooi.",
      chosen: "{n} gekozen",
      min: "Kies minimaal {n} beelden om verder te gaan.",
      max: "Dat zijn er acht. Haal er één weg om een ander te kiezen.",
      more: "Andere beelden",
      moreSub: "Wat je koos blijft staan.",
      noMore: "Meer nieuwe beelden hebben we niet. Wat je koos blijft staan.",
    },
    concrete: {
      kicker: "Jouw beelden · 2 van 2",
      heading: "Van jouw associaties naar nieuwe mogelijkheden",
      headingGift: "Van de associaties van {name} naar nieuwe mogelijkheden ‖ Van de gekozen associaties naar nieuwe mogelijkheden ‖ Van jullie associaties naar nieuwe mogelijkheden",
      sub: "Op basis van jouw keuzes hebben we activiteiten samengesteld die aansluiten bij jouw interesses. Sommige herkenbaar, andere misschien verrassend nieuw.",
      subGift: "Op basis van de gekozen beelden hebben we activiteiten samengesteld die aansluiten bij de interesses van {name}. Sommige herkenbaar, andere misschien verrassend nieuw. ‖ Op basis van de gekozen beelden hebben we activiteiten samengesteld die aansluiten bij de interesses. Sommige herkenbaar, andere misschien verrassend nieuw. ‖ Op basis van jullie keuzes hebben we activiteiten samengesteld die aansluiten bij jullie interesses. Sommige herkenbaar, andere misschien verrassend nieuw.",
      chosen: "{n} gekozen",
      multi: "Kies er zoveel als je wilt, tot {max}. Tik nogmaals om een keuze weg te halen.",
      min: "Tik er minstens één aan, of laat ons verrassen.",
      max: "Dat zijn er {max}. Haal er één weg om een ander te kiezen.",
      more: "Andere activiteiten",
      moreSub: "Wat je koos blijft staan.",
      noMore: "Meer nieuwe activiteiten hebben we niet. Wat je koos blijft staan.",
      chooseForMe: "Verras me",
      chooseForMeSub: "We kiezen iets passends bij je beelden",
      chooseForMeSubGift: "We kiezen iets passends bij de beelden",
      maybe: "Misschien ook leuk?",
    },
  },
  rounds: {
    places: {
      kicker: "Ronde 1 van 3 · plekken",
      heading: "Waar zou je nu willen zijn?",
      headingGift: "Waar zou {name} nu willen zijn?",
      sub: "Kies wat je aantrekt, ook als je niet weet waarom. Eén tot vijf.",
    },
    moments: {
      kicker: "Ronde 2 van 3 · momenten",
      heading: "Welk moment zou je vaker willen beleven?",
      headingGift: "Welk moment zou {name} vaker willen beleven?",
      sub: "Niet wat je gaat doen, maar hoe het voelt.",
    },
    senses: {
      kicker: "Ronde 3 van 3 · zintuigen · mag je overslaan",
      heading: "Wat raakt je zintuigen?",
      headingGift: "Wat raakt de zintuigen van {name}?",
      sub: "Een laatste laag. Kies wat er bij je opkomt.",
    },
  },
  roundUi: {
    grid: "Alles zien",
    swipe: "Swipen",
    swipeHint: "Veeg naar rechts als het je trekt, naar links als het niets doet.",
    yes: "Ja, dit trekt",
    no: "Niet voor mij",
    roundDone: "Ronde klaar",
    roundDoneBody: "Je koos {n}. Ze staan in je venster.",
    seeAll: "Bekijk alles nog eens",
    chosen: "{n} gekozen",
    max: "Vijf is genoeg. Haal er eerst een weg.",
    skip: "Overslaan",
    of: "{i} van {n}",
  },
  profile: {
    kicker: "Jouw venster",
    heading: "Wat jouw keuzes ons vertellen",
    headingGift: "Wat de keuzes voor {name} ons vertellen ‖ Wat deze keuzes ons vertellen ‖ Wat jullie keuzes ons vertellen",
    and: "en",
    headline: "Je houdt van {a}, en van {b}.",
    headlineGift: "{name} houdt van {a}, en van {b}. ‖ Wat opvalt: {a}, en {b}.",
    headlineOne: "Je houdt van {a}.",
    headlineOneGift: "{name} houdt van {a}. ‖ Wat opvalt: {a}.",
    headlineNone: "Wat je koos wijst meerdere kanten op.",
    headlineNoneGift: "Wat er gekozen is wijst meerdere kanten op.",
    motifs: {
      performance: "een moment in het licht, voor publiek",
      depths: "wat diep en verborgen ligt",
      fire: "de warmte en het geknetter van vuur",
      chance: "de spanning van wat de kaarten brengen",
      precision: "het gevoel dat iets precies klopt",
      story: "plekken met een verhaal erachter",
      history: "sporen van vroeger",
      outdoors: "de buitenlucht",
      animals: "dieren dichtbij",
      teamwork: "iets dat samen lukt",
      strategy: "de stille voldoening van een slim plan",
      making: "plekken waar handen iets te doen hebben",
      rhythm: "een ritme dat meeneemt",
      sound: "klank die iets losmaakt",
      movement: "beweging die het hoofd leegmaakt",
      focus: "iets om helemaal in op te gaan",
      stillness: "stilte die niets vraagt",
      discovery: "iets nieuws om te ontdekken",
      craft: "het geduld van een echt vak",
      technique: "het plezier van uitzoeken hoe iets werkt",
      nature: "ruimte, groen en weer",
      collecting: "de rust van ordenen en bewaren",
      miniature: "alles op handformaat",
      roleplay: "even iemand anders mogen zijn",
      competition: "een eerlijk gevecht met een knipoog",
      learning: "iets nieuws dat blijft hangen",
      caring: "iets of iemand om voor te zorgen",
      food: "wat er op tafel komt, en hoe het smaakt",
      water: "water dat de tijd vertraagt",
      height: "uitzicht van boven",
      challenge: "een uitdaging die net te doen is",
      retro: "de charme van toen",
      speed: "het gevoel van snelheid",
      style: "een stijl die helemaal klopt",
      color: "kleur die blij maakt",
      language: "woorden die ergens heen gaan",
      stars: "een hemel vol sterren",
      puzzling: "de klik als alles op zijn plek valt",
      growing: "iets dat groeit onder de handen",
      conviviality: "gezelligheid zonder poespas",
      balance: "een moment van evenwicht",
      play: "spel zonder reden",
      suspense: "een tikkeltje spanning",
    },
    reads: [
      { tags: ["making", "conviviality"], text: "Iets maken terwijl er gepraat en gelachen wordt: daar zit het." },
      { tags: ["making", "craft"], text: "Het gaat niet om snel resultaat, maar om handen die langzaam beter worden." },
      { tags: ["nature", "stillness"], text: "Buiten zijn zonder iets te hoeven: alleen lucht, licht en tijd." },
      { tags: ["nature", "story"], text: "Een landschap met een verhaal erin, een pad dat ergens vandaan komt." },
      { tags: ["history", "story"], text: "Het verleden als verhaal: plekken waar je bijna kunt horen wat er ooit gebeurde." },
      { tags: ["movement", "water"], text: "In beweging bij het water, waar wat zwaar was ineens lichter wordt." },
      { tags: ["challenge", "outdoors"], text: "Buiten iets aangaan dat je een beetje spannend vindt, en er daarna trots op terugkijken." },
      { tags: ["food", "conviviality"], text: "Een lange tafel, iets lekkers en geen haast: eten als reden om samen te zijn." },
      { tags: ["craft", "history"], text: "Oude vakken, nieuwe handen: leren van wat generaties eerder al wisten." },
      { tags: ["learning", "focus"], text: "Ergens in kunnen verdiepen, tot alles buiten even verdwijnt." },
      { tags: ["suspense", "teamwork"], text: "Samen onder druk, met een raadsel of een klok: spanning die verbindt." },
      { tags: ["play", "competition"], text: "Spelen om te winnen, en lachen als het niet lukt." },
      { tags: ["stillness", "focus"], text: "Een stilte waarin gedachten eindelijk de tijd krijgen om te landen." },
      { tags: ["puzzling", "strategy"], text: "Hersenkrakers waarbij de klik zelf de beloning is." },
      { tags: ["sound", "rhythm"], text: "Iets wat je voelt voordat je het begrijpt: klank en ritme als eigen taal." },
      { tags: ["color", "making"], text: "Kleur die onder je handen ontstaat, en de verrassing van wat het wordt." },
    ],
    tagLines: {
      performance: "Even in het licht staan: op een podium, met alle ogen op je gericht.",
      depths: "Naar beneden, naar wat verborgen ligt: stiller, donkerder en vol dingen die je nog niet eerder zag.",
      fire: "Vuur trekt: het geknetter, de warmte en het gevoel dat er iets wordt gemaakt of verteld.",
      chance: "Er zit iets lekkers in niet weten hoe het afloopt: een kaart, een dobbelsteen, een kans.",
      precision: "Het gaat om precisie: dat ene moment waarop iets tot op de millimeter klopt.",
      story: "Een plek wordt pas echt als er een verhaal bij hoort.",
      history: "Het verleden trekt, als verhaal, als spoor in een muur, als iets dat nog nazindert.",
      outdoors: "Buiten is waar het hoofd leegloopt en het weer meedoet.",
      animals: "Dieren halen je naar het hier en nu, op een manier waar woorden niet bij kunnen.",
      teamwork: "Samen iets voor elkaar krijgen is mooier dan het alleen redden.",
      strategy: "Een goed plan dat uitkomt geeft een stille, bijna sluwe voldoening.",
      making: "Handen die bezig zijn en iets dat langzaam vorm krijgt.",
      rhythm: "Iets in je beweegt mee voordat je het weet: ritme als uitnodiging.",
      sound: "Klank komt sneller binnen dan woorden: je voelt het eerst en begrijpt het later.",
      movement: "Bewegen maakt ruimte in je hoofd, tot de dag een stuk lichter voelt.",
      focus: "Je wilt ergens in kunnen verdwijnen, zonder dat er iets aan je trekt.",
      stillness: "Stilte is geen leegte maar ruimte: tijd om te horen wat er eigenlijk speelt.",
      discovery: "Het onbekende lokt: de eerste keer dat je iets ziet of doet is niet te herhalen.",
      craft: "Een vak leer je langzaam, en juist dat is de charme.",
      technique: "Uitzoeken hoe iets werkt is een avontuur op zich.",
      nature: "Ruimte, groen en weer: de natuur vraagt niets en geeft veel.",
      collecting: "Dingen een plek geven, ordenen en bewaren, brengt een stille rust.",
      miniature: "Op kleine schaal is alles te overzien, en juist daardoor weer groot.",
      roleplay: "Even iemand anders zijn laat je ontdekken wie je zelf eigenlijk bent.",
      competition: "Een beetje strijd houdt je scherp, zeker als je erom kunt lachen.",
      learning: "Iets nieuws leren geeft het gevoel dat je een stukje groter bent geworden.",
      caring: "Voor iets of iemand zorgen geeft de dag richting.",
      food: "Eten is een reden om samen te zijn en om echt te proeven.",
      water: "Bij water vertraagt de tijd en wordt de lucht zachter.",
      height: "Van boven ziet alles er kleiner en eenvoudiger uit.",
      challenge: "Een uitdaging die net past maakt je trots zonder dat je het hoeft te zeggen.",
      retro: "Wat oud is heeft iets warms dat nieuw niet kan nabootsen.",
      speed: "Snelheid maakt het hoofd leeg: er is alleen nog de volgende bocht.",
      style: "Een eigen stijl laat zien wie je bent, zonder dat je het hoeft uit te leggen.",
      color: "Kleur werkt direct: ze maakt een dag van binnen anders.",
      language: "Woorden kunnen een heel landschap oproepen.",
      stars: "Onder een hemel vol sterren worden zorgen vanzelf kleiner.",
      puzzling: "De klik als alles op zijn plek valt is een klein feestje.",
      growing: "Iets zien groeien leert geduld, en beloont het.",
      conviviality: "Gezelligheid hoeft niet groot te zijn: een tafel, een lamp en mensen die blijven zitten.",
      balance: "Evenwicht vinden is geen stilstaan, maar steeds zacht bijsturen.",
      play: "Spelen mag zonder reden: juist dan is het het mooist.",
      suspense: "Een tikkeltje spanning maakt de rest van de dag scherper.",
    },
    aloneButTogether: "Gezelligheid zonder dat iemand mee hoeft: plekken waar je alleen binnenstapt en er toch bij hoort.",
    quietTogether: "Stilte, maar dan samen: iemand erbij die ook niets hoeft te zeggen.",
    leanLines: {
      inside: "Het gebeurt liefst binnen, waar het warm is en alles binnen handbereik ligt.",
      outside: "Het hoort buiten te gebeuren, met lucht om je heen en een horizon in beeld.",
      calm: "Zonder haast, zodat er tijd is om iets te laten gebeuren.",
      active: "Met wat vaart erin, genoeg om je hart sneller te laten kloppen.",
      alone: "Op eigen tempo, in eigen gezelschap.",
      together: "En het is leuker als er iemand bij is om het mee te delen.",
      familiar: "Liever vertrouwd dan vreemd: iets waar je je meteen thuis voelt.",
      fresh: "Liever iets dat je nog niet kent: de eerste keer is het mooist.",
    },
    leanNeutral: "Er is ruimte voor meerdere kanten, en die laten we zien.",
    picksLine: "Zelf koos je ook {list}: daar beginnen we mee.",
    picksLineGift: "{name} koos zelf ook {list}: daar beginnen we mee. ‖ Zelf gekozen zijn ook {list}: daar beginnen we mee.",
    openHeadline: "Het venster staat nog open.",
    openHeadlineGift: "Het venster staat nog open.",
    openStory: "Geen probleem: dan verrassen we je met een mix die je zelf misschien niet had gekozen.",
    openStoryGift: "Geen probleem: dan verrassen we {name} met een mix die nog niet bedacht was. ‖ Geen probleem: dan zoeken we een verrassende mix.",
    tension: {
      energy: "Je houdt van rust én van spanning. Allebei mag.",
      novelty: "Je houdt van het vertrouwde én van iets nieuws. Allebei mag.",
      social: "Je houdt van gezelschap én van rust. Allebei mag.",
      setting: "Je houdt van binnen én van buiten. Allebei mag.",
    },
    tensionGift: {
      energy: "{name} houdt van rust én van spanning. Allebei mag. ‖ Er zit rust én spanning in deze keuzes. Allebei mag.",
      novelty: "{name} houdt van het vertrouwde én van iets nieuws. Allebei mag. ‖ Er zit vertrouwd én nieuw in deze keuzes. Allebei mag.",
      social: "{name} houdt van gezelschap én van rust. Allebei mag. ‖ Er zit gezelschap én rust in deze keuzes. Allebei mag.",
      setting: "{name} houdt van binnen én van buiten. Allebei mag. ‖ Er zit binnen én buiten in deze keuzes. Allebei mag.",
    },
    strong: {
      energy: { low: "Je keuzes voelen rustig, dus we zoeken niets dat opjaagt.", high: "Je keuzes hebben vaart, dus we zoeken iets met energie." },
      novelty: { low: "Je keuzes voelen vertrouwd, dus eerst herkenning en pas daarna een verrassing.", high: "Je keuzes zoeken iets nieuws, dus liever onbekend dan bekend." },
      social: { low: "Je keuzes vragen om tijd voor jezelf, dus ruimte om ergens helemaal in op te gaan.", high: "Je keuzes vragen om gezelschap, dus iets om samen te doen." },
      setting: { low: "Je keuzes voelen thuis binnen, dus beschut en warm.", high: "Je keuzes voelen thuis buiten, dus met lucht, licht en ruimte." },
    },
    strongGift: {
      energy: { low: "Deze keuzes voelen rustig, dus we zoeken niets dat opjaagt.", high: "Deze keuzes hebben vaart, dus we zoeken iets met energie." },
      novelty: { low: "Deze keuzes voelen vertrouwd, dus eerst herkenning en pas daarna een verrassing.", high: "Deze keuzes zoeken iets nieuws, dus liever onbekend dan bekend." },
      social: { low: "Deze keuzes vragen om tijd voor jezelf, dus ruimte om ergens helemaal in op te gaan.", high: "Deze keuzes vragen om gezelschap, dus iets om samen te doen." },
      setting: { low: "Deze keuzes voelen thuis binnen, dus beschut en warm.", high: "Deze keuzes voelen thuis buiten, dus met lucht, licht en ruimte." },
    },
    balanced: "Je keuzes wijzen niet één kant op. Dat maakt het spannend: we laten je meerdere kanten zien.",
    balancedGift: "Deze keuzes wijzen niet één kant op. Dat maakt het spannend: we laten meerdere kanten zien.",
    open: "Je hebt nog niet veel gekozen. Geen probleem, dan verrassen we je.",
    openGift: "Er is nog niet veel gekozen. Geen probleem, dan verrassen we {name}. ‖ Er is nog niet veel gekozen. Geen probleem, we zoeken iets verrassends.",
    interpret: {
      threadTitle: "De rode draad",
      directionTitle: "Jouw ontdekkingsrichting",
      chosenLabel: "De gekozen beelden",
    },
    axes: {
      social: { label: "Alleen of samen", low: "Alleen", high: "Samen" },
      energy: { label: "Rust of actie", low: "Rust", high: "Actie" },
      setting: { label: "Binnen of buiten", low: "Binnen", high: "Buiten" },
      novelty: { label: "Vertrouwd of nieuw", low: "Vertrouwd", high: "Nieuw" },
    },
    seekLines: {
      formats: {
        solo: "Op je eigen tempo, alleen",
        drop_in_alone: "Alleen komen, samen doen",
        duo: "Met z'n tweeën",
        small_group: "In een klein groepje",
        large_group: "Met een grotere groep",
        with_known: "Met mensen die je al kent",
        online: "Ook online",
      },
      outdoor: "Buiten",
      indoor: "Binnen",
      effortMinimal: "Rustig, zonder zware inspanning",
      effortCommitted: "Mag flinke inspanning kosten",
      budget: { free: "Gratis", "10": "Tot €10 per persoon", "25": "Tot €25 per persoon", "50": "Tot €50 per persoon", "100": "Tot €100 per persoon", "200": "Tot €200 per persoon" },
      time: { hour: "Past in een uur of twee", halfday: "Past in een halve dag", fullday: "Past in een hele dag", weekend: "Ook voor een heel weekend" },
      distance: { city: "In je eigen plaats", hour: "Tot een uur reizen", anywhere: "Heel Nederland" },
    },
    omitLines: {
      noGroups: "Groepsactiviteiten",
      needsInside: "Dingen die binnen moeten",
      needsOutside: "Dingen die buiten moeten",
      formats: "Wat niet past bij hoe je het liefst samen bent",
      supervised: "Activiteiten waarvoor je een instructeur of toezicht nodig hebt",
      effortMinimal: "Zware inspanning, zoals hardlopen of klimmen",
      effortSome: "Extreme inspanning",
      costFree: "Alles met een prijskaartje",
      costMid: "Activiteiten boven de €50",
      costLow: "Activiteiten boven de €15",
    },
    missTitle: "Zijn we iets vergeten?",
    missTitleGift: "Zijn we iets vergeten voor {name}? ‖ Zijn we iets vergeten?",
    missSub: "Eén zin is genoeg en we nemen hem serieus.",
    missPlaceholder: "Bijvoorbeeld: meer tijd in de natuur…",
    suggestions: {
      performance: "Eens op een podium staan",
      depths: "Iets doen onder de grond of onder water",
      animals: "Meer tijd met dieren doorbrengen",
      fire: "Een avond rond een vuur",
      chance: "Een avond met kaarten, dobbelstenen en spanning",
      miniature: "Iets kleins en nauwkeurigs bouwen",
      stillness: "Even helemaal stil zijn",
      outdoors: "Meer tijd buiten doorbrengen",
      nature: "Meer tijd in de natuur",
      focus: "Ergens helemaal in opgaan",
      balance: "Iets doen dat in balans brengt",
      conviviality: "Aan een lange tafel zitten",
      story: "Een verhaal vertellen of horen",
      movement: "Meer bewegen",
      discovery: "Iets ontdekken wat nog onbekend is",
      craft: "Een vak leren van iemand die het kan",
      making: "Iets maken met de handen",
      challenge: "Eens een uitdaging aangaan",
      water: "Bij het water zijn",
      history: "Plekken met een verhaal bezoeken",
      caring: "Voor iets of iemand zorgen",
      suspense: "Iets spannends meemaken",
      technique: "Uitzoeken hoe iets werkt",
      food: "Samen koken of proeven",
      teamwork: "Iets samen voor elkaar krijgen",
      play: "Gewoon weer eens spelen",
      learning: "Iets nieuws leren",
      color: "Met kleur aan de slag",
      language: "Met taal bezig zijn",
      roleplay: "In een rol stappen",
      rhythm: "Iets met ritme doen",
      sound: "Luisteren naar klank, of die zelf maken",
      growing: "Iets laten groeien",
      stars: "Naar de sterren kijken",
      competition: "Een potje strijden",
      puzzling: "Puzzelen tot het klopt",
      strategy: "Iets slims bedenken en uitvoeren",
      precision: "Iets heel precies doen",
      height: "Hoog staan en uitkijken",
      collecting: "Iets verzamelen en ordenen",
      retro: "Iets met vroeger doen",
      speed: "Iets doen waar snelheid bij hoort",
      style: "Aan een eigen stijl werken",
    },
    combos: [
      { tags: ["nature", "story"], text: "Een middag in de natuur met een goed verhaal" },
      { tags: ["nature", "stillness"], text: "Een stille ochtend buiten, zonder agenda" },
      { tags: ["making", "conviviality"], text: "Samen iets maken, met thee erbij" },
      { tags: ["food", "conviviality"], text: "Lang aan tafel, met iets lekkers dat je samen maakt" },
      { tags: ["movement", "water"], text: "In beweging zijn bij het water" },
      { tags: ["craft", "history"], text: "Een oud vak leren van iemand die het kan" },
      { tags: ["challenge", "outdoors"], text: "Buiten iets doen dat een beetje spannend is" },
      { tags: ["learning", "focus"], text: "Een middag ergens echt in verdiepen" },
    ],
  },
  start: {
    kicker: "Fijn dat je er bent",
    heading: "Een ontdekking begint bij jou",
    sub: "Vertel ons voor wie we op zoek gaan en waar. Zo kunnen we iets ontdekken dat echt aansluit.",
    sections: { who: "Voor wie", where: "Waar", limits: "Rekening mee houden" },
    optionalNote: "Alleen je plaats is verplicht (*). Al het andere mag je overslaan; het maakt je boek alleen persoonlijker.",
    required: "verplicht",
    who: {
      label: "Voor wie is deze zoektocht bedoeld?",
      labelGift: "Voor wie is dit venster?",
      sub: "Dit bepaalt waar we naar kijken. Kies je niets, dan zoeken we voor jezelf.",
      options: {
        self: { label: "Voor mezelf", sub: "Iets voor jezelf" },
        child: { label: "Een kind of jongere", sub: "Een kind of een tiener" },
        adult: { label: "Een volwassene", sub: "Partner, vriend, ouder of collega" },
        group: { label: "Een groep", sub: "Gezin, vrienden of een team" },
      },
      otherCard: { label: "Voor iemand anders", sub: "Een cadeau of een uitje voor een ander" },
      otherPrompt: "Wie is het?",
      pill: { self: "Voor mezelf", other: "Voor iemand anders", named: "Voor {name}", group: "Voor een groep" },
      nameLabel: "Hoe heet diegene? Met een naam wordt je boek persoonlijker.",
    },
    country: { label: "Land", geoNote: "We vulden dit in op basis van je verbinding. Klopt het niet? Pas het gerust aan." },
    distance: {
      label: "Hoe ver wil je reizen?",
      hint: "We meten de afstand vanaf je vertrekplaats. Verder dan dit zoeken we niet.",
      upTo: "Tot {km} km",
      over100: "Meer dan 100 km",
      tickOver100: ">100",
    },
    budget: {
      label: "Wat mag deze ervaring ongeveer kosten per persoon?",
      hint: "Dit bepaalt welke activiteiten we je laten zien. Laat je het open, dan houden we geen vast bedrag aan.",
      unset: "Nog niets gekozen: schuif om een bedrag te kiezen",
      clear: "Geen voorkeur",
      upTo: "Tot €{n} per persoon",
      any: "Maakt niet uit",
    },
    limits: {
      sub: "Alleen als het ertoe doet.",
      timeLabelOther: "Hoeveel tijd is er?",
      chipsLabel: "Houden we ergens rekening mee?",
      chipsTitle: "Tik aan wat voor jou belangrijk is",
      chipsSub: "Helemaal optioneel: we zoeken ook zonder. Tik alleen aan wat voor jou echt telt. Je mag er meerdere kiezen.",
      chipsSkip: "Niets bijzonders? Dan ga je gewoon verder.",
      optional: "optioneel",
      groups: [
        { title: "Omgeving", chips: ["Alleen buiten", "Alleen binnen"] },
        { title: "Bereikbaarheid", chips: ["Met de rolstoel bereikbaar", "Zonder auto bereikbaar"] },
        { title: "Gezelschap", chips: ["Niet in een groep", "Met de hond", "Met kinderen", "Met jonge kinderen"] },
        { title: "Tempo en prikkels", chips: ["Rustig tempo", "Rustig en voorspelbaar"] },
        { title: "Hoe wil je meedoen?", chips: ["Mensen ontmoeten", "Met één ander", "Met een groep"] },
        { title: "Eten en drinken", chips: ["Zonder alcohol", "Zonder vis of schaaldieren"] },
        { title: "Taal", chips: ["Zonder Nederlands"] },
        { title: "Dieren", chips: ["Zonder jagen of vissen", "Zonder dieren"] },
        { title: "Wanneer", chips: ["In het weekend", "'s Avonds"] },
      ],
    },
  },
  situation: {
    heading: "Waar, wanneer en met wie?",
    headingGift: "Waar, wanneer en met wie voor {name}?",
  },
  room: {
    locationLabel: "Vanuit welke plaats mogen we op ontdekking gaan?",
    locationLabelGift: "Vanuit welke plaats mogen we op ontdekking gaan voor {name}? ‖ Vanuit welke plaats mogen we op ontdekking gaan?",
    locationSub: "Dit is het vertrekpunt van de zoektocht. Afstanden meten we vanaf deze plaats. Thuis, je werk of ergens anders: jij kiest.",
    locationPlaceholder: "Typ een plaats, bijvoorbeeld Utrecht…",
    distanceLabel: "Hoe ver wil je ervoor reizen?",
    distanceOptions: [
      { value: "city", label: "In deze plaats" },
      { value: "hour", label: "Tot een uur reizen" },
      { value: "anywhere", label: "Heel Nederland" },
    ],
    timeLabel: "Hoeveel tijd heb je?",
    budgetLabel: "Wat mag het ongeveer kosten?",
  },
  who: {
    limitChips: [
      "Alleen buiten",
      "Alleen binnen",
      "Niet in een groep",
      "Met de rolstoel bereikbaar",
      "Met de hond",
      "Zonder alcohol",
      "Zonder vis of schaaldieren",
      "Zonder Nederlands",
      "Zonder jagen of vissen",
      "Zonder dieren",
      "Met kinderen",
      "Met jonge kinderen",
      "Rustig tempo",
      "Rustig en voorspelbaar",
      "Mensen ontmoeten",
      "Met één ander",
      "Met een groep",
      "Zonder auto bereikbaar",
      "In het weekend",
      "'s Avonds",
    ],
  },
  nav: {
    back: "Terug",
    next: "Verder",
    submit: "Naar je Idea Book",
    submitting: "Je venster wordt gesloten…",
    windowOpen: "Bekijk je venster",
    windowClose: "Sluiten",
    windowTitle: "Jouw venster",
    scrollCue: "Ga verder om jouw ontdekkingsboek te bestellen",
    toOrder: "Naar je bestelling",
    windowDownload: "Download je venster als afbeelding",
    hint: {
      images: "Kies er nog even {n} of meer om verder te gaan.",
      concrete: "Tik er minstens één aan, of laat ons verrassen.",
      worlds: "Kies minstens één richting, of laat ons kiezen.",
      round: "Kies minstens één beeld om door te gaan.",
      missing: "Vul nog even in: {list}.",
      place: "je plaats",
      time: "tijd",
      budget: "budget",
    },
  },
  panes: { worlds: "Richting", places: "Plek", moments: "Moment", senses: "Zintuig", surprise: "Verras me" },
  sill: { empty: "Elke keuze krijgt een plek in je venster.", with: "met" },
  checkout: {
    heading: "Je venster is vol.",
    headingGift: "Het venster voor {name} is vol. ‖ Het venster is vol.",
    whatYouGet: [
      `Zes ideeën en één verzegelde wildcard, van ${doorRange("nl")}`,
      "Per idee: waarom het bij je past, drie maten (proeven, doen, doorpakken) en een eerste stap",
      "Echte plekken in jouw buurt waar we ze vonden, met kaartlink",
      "Een PDF met jouw venster op de cover, ook in je mail",
    ],
    freeNote: "Je venster en je profielportret zijn gratis. Je betaalt één keer voor de uitwerking.",
  },
  reveal: {
    chose: "Je koos {list}.",
    choseGift: "Voor jou gekozen: {list}.",
    wrote: "Je schreef: ‘{text}’.",
    because: "Omdat je {image} koos",
    becauseGift: "Gekozen met {image} in gedachten",
    placeLabel: "Waar",
    mapLink: "Op de kaart",
  },
  thread: {
    heading: "Zo kwamen we hierop",
    imageCaption: "Jouw beeld",
    tagsCaption: "Wat we erin lazen",
    doorCaption: "De deur die daarbij past",
    ownDoorCaption: "Door jou gekozen",
    placeCaption: "Echte plek, uit ons onderzoek",
    pdfBoth: "Bij deze deur hoort het beeld ‘{image}’: daarin lazen we {tags}.",
    pdfImage: "Bij deze deur hoort het beeld ‘{image}’.",
    pdfTags: "In de gekozen beelden lazen we {tags}.",
    pdfOwn: "Dit koos je zelf.",
    pathCaption: "Waar je beelden naartoe wezen: door ons afgeleid, niet door jou gekozen",
    pdfPath: "Onderweg kwamen we langs {path}: dat leiden wij uit je beelden af, het is niet iets dat je zelf koos.",
  },
  more: {
    heading: "Meer over deze deur",
    feelsHeading: "Hoe het voelt",
    sizesHeading: "Drie maten",
    sizeNames: ["Proeven", "Doen", "Doorpakken"],
    sizeHints: ["± 1 uur", "Een halve dag", "Een weekend of een cursus"],
    placesHeading: "Echte plekken",
    placesNote: "Uit ons onderzoek. Controleer openingstijden en prijzen zelf.",
    ratingLine: "Beoordeeld met {score}/5 op {source}{reviews}",
    ratingReviews: " ({n} beoordelingen)",
    ratingDecimal: ",",
    mapLink: "Op de kaart",
    siteLink: "Website",
    relatedHeading: "Ook in deze richting",
    nextHeading: "Daarna",
    pdfEyebrow: "Meer over deze deur",
  },
  invite: {
    button: "Deel een uitnodiging",
    heading: "Nodig iemand uit om een venster te openen",
    sub: "Een afbeelding voor je verhaal of chat. Er staat niets persoonlijks op: alleen de uitnodiging.",
    formatStory: "Verhaal",
    formatSquare: "Vierkant",
    formatLabel: "Formaat",
    share: "Deel de afbeelding",
    download: "Download afbeelding",
    whatsapp: "Open WhatsApp met de link",
    copyLink: "Kopieer link",
    copied: "Link gekopieerd",
    previewAlt: "Voorbeeld van de uitnodiging",
    shareText: "Ontdek wat er mogelijk is, voor jou. Open een venster:",
    cardHeadline: "Ontdek wat er mogelijk is voor jou.",
    cardSub: "Kies een paar beelden. Krijg zeven deuren, alleen voor jou.",
    cardCta: "Open je venster",
  },
  feedback: {
    heading: "Je helpt ons enorm",
    sub: "Dit is een testversie. Acht korte vragen, het kost ongeveer twee minuten. Alles mag je overslaan.",
    scoreLabel: "Hoe voelde het om je venster te vullen?",
    scoreOptions: ["Taai", "Matig", "Prima", "Fijn", "Heerlijk"],
    profileLabel: "Voelde je je begrepen door \u201CWat jouw keuzes ons vertellen\u201D?",
    doorsLabel: "Snapte je waarom je deze deuren kreeg?",
    agreeOptions: ["Helemaal niet", "Niet echt", "Half", "Vrij goed", "Helemaal"],
    pickLabel: "Welke deur zou je echt gaan doen?",
    pickNone: "Geen van deze",
    placesLabel: "Klopten de plekken en aanbieders in je boek met jouw omgeving? (Bestaan ze, liggen ze echt bij jou in de buurt, kon je er iets mee?)",
    mailLabel: "Is de mail met je boek aangekomen?",
    mailOptions: [
      { value: "inbox", label: "Ja, in mijn inbox" },
      { value: "spam", label: "Ja, maar in de spam" },
      { value: "missing", label: "Nog niet" },
    ],
    payLabel: "Zou je {price} betalen voor dit boek?",
    payOptions: [
      { value: "yes", label: "Ja" },
      { value: "maybe", label: "Misschien" },
      { value: "no", label: "Nee" },
    ],
    doubtLabel: "Waar twijfelde je, of haakte je bijna af?",
    doubtPlaceholder: "Mag kort. Of leeg.",
    submit: "Versturen",
    thanks: "Dank je wel. Dit helpt echt.",
    error: "Versturen lukte niet. Probeer het later nog eens.",
  },
  pdf: { coverTitle: "Een venster voor jou", coverTitleGift: "Een venster voor {name}", coverTitleGroup: "Een venster voor jullie" },
  testBanner: "Testversie · betaal met testkaart 4242 4242 4242 4242, er wordt niets afgeschreven.",
  errorGeneric: "Er ging iets mis bij het opslaan van je keuzes. Ververs de pagina en probeer het opnieuw: je keuzes blijven bewaard.",
};

export const vensterEn: VensterDictionary = {
  landing: {
    selfCta: "Open your window",
    heroCta: "Look through the window",
    heroCtaNote: "Takes 2 minutes · no account needed",
    badge: "New · {price} · no account, ready in minutes",
    headline: "What if you discover something",
    headlineEmphasis: "you didn't know suited you?",
    subcopy:
      "Pick a few images that make you smile. We find the activities that go with them: things you might never have thought of, with real places near you. It all starts with one look through the window.",
    heroAlt: "A classic sash window with eight panes, each showing a different image",
    share: {
      heading: "Share WindowInto",
      nativeLabel: "Share from your phone or computer",
      whatsapp: "Share on WhatsApp",
      instagram: "Share on Instagram",
      facebook: "Share on Facebook",
      x: "Share on X",
      linkedin: "Share on LinkedIn",
      email: "Share by e-mail",
      copiedForInstagram: "Link copied. Paste it in Instagram.",
      text: "Discover what's possible, for you. Open a window on WindowInto:",
      emailSubject: "Discover what's possible with WindowInto",
    },
    chapters: [
      { title: "Your situation", body: "For whom, where and what has to fit: the basis for real places nearby." },
      { title: "Your images", body: "Pick images and activities that pull you in. No questionnaire: ready in about 3 minutes." },
      { title: "Your window", body: "Read how we read you, and open your book." },
    ],
  },
  chapters: { images: "Your images", situation: "Your situation", extra: "Your window" },
  recipientFallback: "the recipient",
  recipientLabel: "Who is this window for?",
  recipientPlaceholder: "First name (optional)",
  testLimit: {
    title: "You've used your test books",
    body: "During the test you can make two books from one internet connection, and that makes two already. Thank you for testing! The books you made stay available through the link in your e-mail. Would you like one more? Send a quick message to whoever invited you.",
    back: "Back to the front page",
  },
  errors: {
    notFoundTitle: "This page doesn't exist",
    notFoundBody: "The link may have expired or been mistyped. You can start again from the beginning.",
    home: "Back to the start",
    errorTitle: "Something went wrong",
    errorBody: "Please try again. If it keeps going wrong, come back in a little while: your answers are not lost.",
    retry: "Try again",
    bookLanguage: "This Idea Book was written in {language}, the language you opened the window in. You can always open a new window in another language.",
  },
  worlds: {
    heading: "Where does your curiosity go?",
    headingGift: "Where does {name}'s curiosity go?",
    sub: "Pick one to four. Or let us surprise you.",
    surprise: "Surprise me",
    surpriseSub: "We'll pick the directions for you",
    chosen: "{n} chosen",
    more: "Show other directions",
  },
  twoPages: {
    dropped: {
      title: "These could not come along",
      body: "You chose these activities, but a limit you gave afterwards rules them out. You can change the limit or choose something else.",
      reasons: {
        season: "does not fit the time of year",
        audience: "does not suit who you are searching for",
        kids: "is not for children",
        young_kids: "does not suit young children",
        access: "cannot be done from a wheelchair",
        calm: "does not fit a calm pace",
        no_alcohol: "is about alcohol",
        quiet: "is busy, loud or unpredictable",
        meet: "offers no way to meet people",
        no_dutch: "is done in Dutch",
        hunt_fish: "is about hunting or fishing",
        animals: "is about animals",
        budget: "does not fit your budget",
        effort: "takes more effort than you said",
        supervised: "needs guidance and does not fit your preference for the familiar",
        setting: "does not fit your wish for indoors or outdoors",
        format: "cannot be done the way you want to take part",
        groups: "is a group activity",
      },
      editSituation: "Change your situation",
      editChoices: "Choose differently",
    },
    steps: { images: "Images", concrete: "Choices" },
    flow: {
      label: "How it works: first wide, then sharp",
      diverge: { title: "Explore widely", sub: "Pick by instinct what appeals" },
      converge: { title: "Find a direction", sub: "Your choices become activities" },
    },
    backTo: { start: "Back to the start", images: "Back to the images", concrete: "Back to the activities" },
    sets: { prev: "Previous set", next: "Next set", counter: "Set {i} of {n}" },
    images: {
      kicker: "Your images · 1 of 2",
      heading: "Which images make you curious?",
      headingGift: "Which images make {name} curious? ‖ Which images spark curiosity? ‖ Which images make you all curious?",
      sub: "Let what you see tempt you. Tap the images that give you a good feeling: a place, a scent, a moment to look forward to. There is no right or wrong. Five to eight is lovely.",
      subGift: "Let what you see tempt you. Tap the images that would give {name} a good feeling: a place, a scent, a moment to look forward to. There is no right or wrong. Five to eight is lovely. ‖ Let what you see tempt you. Tap the images that would give a good feeling: a place, a scent, a moment to look forward to. There is no right or wrong. Five to eight is lovely. ‖ Let what you see tempt you. Tap the images that give you all a good feeling: a place, a scent, a moment to look forward to. There is no right or wrong. Five to eight is lovely.",
      chosen: "{n} chosen",
      min: "Pick at least {n} images to carry on.",
      max: "That is eight. Remove one to choose another.",
      more: "Other images",
      moreSub: "What you chose stays.",
      noMore: "There are no more new images. What you chose stays.",
    },
    concrete: {
      kicker: "Your images · 2 of 2",
      heading: "From your associations to new possibilities",
      headingGift: "From {name}'s associations to new possibilities ‖ From the chosen associations to new possibilities ‖ From your associations to new possibilities",
      sub: "Based on your choices, we have put together activities that connect to your interests. Some familiar, others perhaps surprisingly new.",
      subGift: "Based on the chosen images, we have put together activities that connect to {name}'s interests. Some familiar, others perhaps surprisingly new. ‖ Based on the chosen images, we have put together activities that connect to those interests. Some familiar, others perhaps surprisingly new. ‖ Based on your choices, we have put together activities that connect to your interests. Some familiar, others perhaps surprisingly new.",
      chosen: "{n} chosen",
      multi: "Choose as many as you like, up to {max}. Tap again to remove one.",
      min: "Tap at least one, or let us surprise you.",
      max: "That is {max}. Remove one to choose another.",
      more: "Other activities",
      moreSub: "What you chose stays.",
      noMore: "There are no more new activities. What you chose stays.",
      chooseForMe: "Surprise me",
      chooseForMeSub: "We'll pick something that fits your images",
      chooseForMeSubGift: "We'll pick something that fits the images",
      maybe: "Maybe fun too?",
    },
  },
  rounds: {
    places: {
      kicker: "Round 1 of 3 · places",
      heading: "Where would you like to be right now?",
      headingGift: "Where would {name} like to be right now?",
      sub: "Pick what pulls you in, even if you don't know why. One to five.",
    },
    moments: {
      kicker: "Round 2 of 3 · moments",
      heading: "Which moment would you like to experience more often?",
      headingGift: "Which moment would {name} like to experience more often?",
      sub: "Not what you'll do, but how it feels.",
    },
    senses: {
      kicker: "Round 3 of 3 · senses · feel free to skip",
      heading: "What touches your senses?",
      headingGift: "What touches {name}'s senses?",
      sub: "One last layer. Pick whatever comes up.",
    },
  },
  roundUi: {
    grid: "See all",
    swipe: "Swipe",
    swipeHint: "Swipe right if it pulls you in, left if it does nothing.",
    yes: "Yes, this one",
    no: "Not for me",
    roundDone: "Round done",
    roundDoneBody: "You picked {n}. They're in your window.",
    seeAll: "See them all again",
    chosen: "{n} chosen",
    max: "Five is plenty. Remove one first.",
    skip: "Skip",
    of: "{i} of {n}",
  },
  profile: {
    kicker: "Your window",
    heading: "What your choices tell us",
    headingGift: "What the choices for {name} tell us ‖ What these choices tell us ‖ What your choices tell us",
    and: "and",
    headline: "You enjoy {a}, and {b}.",
    headlineGift: "{name} enjoys {a}, and {b}. ‖ What stands out: {a}, and {b}.",
    headlineOne: "You enjoy {a}.",
    headlineOneGift: "{name} enjoys {a}. ‖ What stands out: {a}.",
    headlineNone: "What you chose points in several directions.",
    headlineNoneGift: "What was chosen points in several directions.",
    motifs: {
      performance: "a moment in the light, in front of an audience",
      depths: "what lies deep and hidden",
      fire: "the warmth and crackle of fire",
      chance: "the thrill of what the cards will bring",
      precision: "the feeling of something fitting exactly",
      story: "places with a story behind them",
      history: "traces of the past",
      outdoors: "the open air",
      animals: "animals close by",
      teamwork: "something pulled off together",
      strategy: "the quiet satisfaction of a clever plan",
      making: "places where hands have something to do",
      rhythm: "a rhythm that carries along",
      sound: "sound that loosens something",
      movement: "movement that clears the head",
      focus: "something to get completely absorbed in",
      stillness: "a stillness that asks nothing",
      discovery: "something new to discover",
      craft: "the patience of a real craft",
      technique: "the joy of working out how something works",
      nature: "space, green and weather",
      collecting: "the calm of sorting and keeping",
      miniature: "everything hand-sized",
      roleplay: "a chance to be someone else for a while",
      competition: "a fair fight with a wink",
      learning: "something new that sticks",
      caring: "something or someone to look after",
      food: "what's on the table and how it tastes",
      water: "water that slows time down",
      height: "a view from above",
      challenge: "a challenge that is just doable",
      retro: "the charm of back then",
      speed: "the feeling of speed",
      style: "a style that feels exactly right",
      color: "colour that brings joy",
      language: "words that are going somewhere",
      stars: "a sky full of stars",
      puzzling: "the click when everything falls into place",
      growing: "something growing under the hands",
      conviviality: "togetherness without fuss",
      balance: "a moment of balance",
      play: "play without a reason",
      suspense: "a touch of suspense",
    },
    reads: [
      { tags: ["making", "conviviality"], text: "Making something while people talk and laugh: that's where it lives." },
      { tags: ["making", "craft"], text: "It isn't about quick results, but about hands slowly getting better." },
      { tags: ["nature", "stillness"], text: "Being outside with nothing to do: just air, light and time." },
      { tags: ["nature", "story"], text: "A landscape with a story in it, a path that comes from somewhere." },
      { tags: ["history", "story"], text: "The past as a story: places where you can almost hear what once happened." },
      { tags: ["movement", "water"], text: "Moving by the water, where what felt heavy suddenly gets lighter." },
      { tags: ["challenge", "outdoors"], text: "Taking on something outside that feels a little scary, and looking back on it with pride." },
      { tags: ["food", "conviviality"], text: "A long table, something delicious and no hurry: food as a reason to be together." },
      { tags: ["craft", "history"], text: "Old crafts, new hands: learning what generations before already knew." },
      { tags: ["learning", "focus"], text: "Being able to dive into something until everything outside disappears for a while." },
      { tags: ["suspense", "teamwork"], text: "Under pressure together, with a riddle or a clock: suspense that binds." },
      { tags: ["play", "competition"], text: "Playing to win, and laughing when it doesn't work out." },
      { tags: ["stillness", "focus"], text: "A stillness where thoughts finally get time to land." },
      { tags: ["puzzling", "strategy"], text: "Brain-teasers where the click itself is the reward." },
      { tags: ["sound", "rhythm"], text: "Something you feel before you understand it: sound and rhythm as a language of their own." },
      { tags: ["color", "making"], text: "Colour that appears under your hands, and the surprise of what it becomes." },
    ],
    tagLines: {
      performance: "To stand in the light for a moment: on a stage, with every eye on you.",
      depths: "Down towards what lies hidden: quieter, darker and full of things you had not seen before.",
      fire: "Fire pulls: the crackle, the warmth and the feeling that something is being made or told.",
      chance: "There is something good in not knowing how it ends: a card, a die, a chance.",
      precision: "It is about precision, the one moment when something fits to the millimetre.",
      story: "A place only becomes real when it has a story.",
      history: "The past pulls, as a story, as a trace in a wall, as something that still lingers.",
      outdoors: "Outdoors is where the head empties and the weather joins in.",
      animals: "Animals give back what words cannot: attention for the here and now.",
      teamwork: "It is better when you pull it off together than when you manage alone.",
      strategy: "A good plan that works out gives a quiet, almost sly satisfaction.",
      making: "Hands that are busy and something slowly taking shape.",
      rhythm: "Something in you moves along before you know it: rhythm as an invitation.",
      sound: "Sound gets in faster than words: you feel it first and understand it later.",
      movement: "Moving makes room in your head, until the day feels a lot lighter.",
      focus: "You want to be able to disappear into something, without anything tugging at you.",
      stillness: "Stillness is not emptiness but space: time to hear what is actually going on.",
      discovery: "The unknown lures: the first time you see or do something cannot be repeated.",
      craft: "A craft is learned slowly, and that is exactly its charm.",
      technique: "Working out how something works is an adventure of its own.",
      nature: "Space, green and weather: nature asks for nothing and gives a lot.",
      collecting: "Giving things a place, sorting and keeping them, brings a quiet calm.",
      miniature: "On a small scale everything can be taken in, and that makes it big again.",
      roleplay: "Being someone else for a while lets you find out who you are.",
      competition: "A bit of rivalry keeps you sharp, especially if you can laugh about it.",
      learning: "Learning something new makes you feel a little bigger.",
      caring: "Looking after something or someone gives the day direction.",
      food: "Food is a reason to be together and to really taste.",
      water: "By the water time turns over: everything slows down and the air softens.",
      height: "From above everything looks smaller and simpler.",
      challenge: "A challenge that fits just right makes you proud without having to say so.",
      retro: "What is old has a warmth that new things cannot imitate.",
      speed: "Speed clears the head: there is only the next bend left.",
      style: "A style of your own shows who you are, without having to explain it.",
      color: "Colour works directly: it changes a day from the inside.",
      language: "Words can conjure up an entire landscape.",
      stars: "Under a sky full of stars worries shrink on their own.",
      puzzling: "The click when everything falls into place is a small celebration.",
      growing: "Watching something grow teaches patience, and rewards it.",
      conviviality: "Togetherness does not have to be big: a table, a lamp and people who stay seated.",
      balance: "Finding balance is less standing still than shifting gently.",
      play: "Play needs no reason: that is exactly when it is best.",
      suspense: "A touch of suspense makes the rest of the day sharper.",
    },
    aloneButTogether: "Togetherness without anyone having to come along: places where you walk in alone and still belong.",
    quietTogether: "Stillness, but together: someone beside you who doesn't need to say anything either.",
    leanLines: {
      inside: "It happens best indoors, where it's warm and everything is within reach.",
      outside: "It belongs outdoors, with air around you and a horizon in view.",
      calm: "Without hurry, so there's time to let something happen.",
      active: "With some pace in it, enough to make your heart beat faster.",
      alone: "At your own pace, in your own company.",
      together: "And it's better when someone is there to share it with.",
      familiar: "Familiar rather than strange: something that feels like home straight away.",
      fresh: "Something you don't know yet: the first time is the best.",
    },
    leanNeutral: "There's room for more than one side, and we'll show you those.",
    picksLine: "You also chose {list} yourself: that's where we start.",
    picksLineGift: "{name} also chose {list}: that's where we start. ‖ {list} were also chosen: that's where we start.",
    openHeadline: "Your window is still open.",
    openHeadlineGift: "The window is still open.",
    openStory: "No problem: we'll surprise you with a mix you might not have chosen yourself.",
    openStoryGift: "No problem: we'll surprise {name} with a mix that may not have been thought of yet. ‖ No problem: we'll look for a surprising mix.",
    tension: {
      energy: "You like calm and excitement. Both are welcome.",
      novelty: "You like the familiar and something new. Both are welcome.",
      social: "You like company and quiet. Both are welcome.",
      setting: "You like indoors and outdoors. Both are welcome.",
    },
    tensionGift: {
      energy: "{name} likes calm and excitement. Both are welcome. ‖ These choices hold calm and excitement. Both are welcome.",
      novelty: "{name} likes the familiar and something new. Both are welcome. ‖ These choices hold the familiar and something new. Both are welcome.",
      social: "{name} likes company and quiet. Both are welcome. ‖ These choices hold company and quiet. Both are welcome.",
      setting: "{name} likes indoors and outdoors. Both are welcome. ‖ These choices hold indoors and outdoors. Both are welcome.",
    },
    strong: {
      energy: { low: "Your choices feel calm, so we won't look for anything hectic.", high: "Your choices have pace, so we'll look for something with energy." },
      novelty: { low: "Your choices feel familiar, so recognition first and a surprise after.", high: "Your choices want something new, so unknown rather than known." },
      social: { low: "Your choices ask for time to yourself, so room to get absorbed on your own.", high: "Your choices ask for company, so something to do together." },
      setting: { low: "Your choices feel at home indoors, so sheltered and warm.", high: "Your choices feel at home outdoors, so with air, light and space." },
    },
    strongGift: {
      energy: { low: "These choices feel calm, so we won't look for anything hectic.", high: "These choices have pace, so we'll look for something with energy." },
      novelty: { low: "These choices feel familiar, so recognition first and a surprise after.", high: "These choices want something new, so unknown rather than known." },
      social: { low: "These choices ask for time alone, so room to get absorbed on one's own.", high: "These choices ask for company, so something to do together." },
      setting: { low: "These choices feel at home indoors, so sheltered and warm.", high: "These choices feel at home outdoors, so with air, light and space." },
    },
    balanced: "Your choices don't point one way. That makes it exciting: we'll show you several sides.",
    balancedGift: "These choices don't point one way. That makes it exciting: we'll show several sides.",
    open: "You haven't chosen much yet. No problem, we'll surprise you.",
    openGift: "Not much has been chosen yet. No problem, we'll surprise {name}. ‖ Not much has been chosen yet. No problem, we'll look for something surprising.",
    interpret: {
      threadTitle: "The red thread",
      directionTitle: "Your direction of discovery",
      chosenLabel: "The images chosen",
    },
    axes: {
      social: { label: "Alone or together", low: "Alone", high: "Together" },
      energy: { label: "Calm or action", low: "Calm", high: "Action" },
      setting: { label: "Indoors or outdoors", low: "Indoors", high: "Outdoors" },
      novelty: { label: "Familiar or new", low: "Familiar", high: "New" },
    },
    seekLines: {
      formats: {
        solo: "At your own pace, alone",
        drop_in_alone: "Come alone, do it together",
        duo: "Just the two of you",
        small_group: "In a small group",
        large_group: "With a bigger group",
        with_known: "With people you already know",
        online: "Online too",
      },
      outdoor: "Outdoors",
      indoor: "Indoors",
      effortMinimal: "Calm, without heavy effort",
      effortCommitted: "May take real effort",
      budget: { free: "Free", "10": "Up to €10 per person", "25": "Up to €25 per person", "50": "Up to €50 per person", "100": "Up to €100 per person", "200": "Up to €200 per person" },
      time: { hour: "Fits in an hour or two", halfday: "Fits in half a day", fullday: "Fits in a full day", weekend: "Also for a whole weekend" },
      distance: { city: "In your own town", hour: "Up to an hour's travel", anywhere: "All of the Netherlands" },
    },
    omitLines: {
      noGroups: "Group activities",
      needsInside: "Things that have to be indoors",
      needsOutside: "Things that have to be outdoors",
      formats: "What doesn't fit how you like to be together",
      supervised: "Activities that need an instructor or supervision",
      effortMinimal: "Heavy effort, like running or climbing",
      effortSome: "Extreme effort",
      costFree: "Anything with a price tag",
      costMid: "Activities over €50",
      costLow: "Activities over €15",
    },
    missTitle: "Did we miss anything?",
    missTitleGift: "Did we miss anything for {name}? ‖ Did we miss anything?",
    missSub: "One sentence is enough and we take it seriously.",
    missPlaceholder: "For example: more time in nature…",
    suggestions: {
      performance: "Standing on a stage once",
      depths: "Doing something underground or underwater",
      animals: "Spending more time with animals",
      fire: "An evening around a fire",
      chance: "An evening of cards, dice and suspense",
      miniature: "Building something small and precise",
      stillness: "Be completely still for a while",
      outdoors: "Spend more time outdoors",
      nature: "Spend more time in nature",
      focus: "Lose yourself in something",
      balance: "Do something that brings balance",
      conviviality: "Sit at a long table",
      story: "Tell or hear a story",
      movement: "Move more",
      discovery: "Discover something still unknown",
      craft: "Learn a craft from someone who knows it",
      making: "Make something with your hands",
      challenge: "Take on a challenge",
      water: "Be by the water",
      history: "Visit places with a story",
      caring: "Look after something or someone",
      suspense: "Live through something exciting",
      technique: "Find out how something works",
      food: "Cook or taste together",
      teamwork: "Get something done together",
      play: "Just play again",
      learning: "Learn something new",
      color: "Work with colour",
      language: "Work with language",
      roleplay: "Step into a role",
      rhythm: "Do something with rhythm",
      sound: "Listen to sound, or make it yourself",
      growing: "Make something grow",
      stars: "Look at the stars",
      competition: "Have a go at a contest",
      puzzling: "Puzzle until it fits",
      strategy: "Think up something clever and carry it out",
      precision: "Do something very precisely",
      height: "Stand high and look out",
      collecting: "Collect and arrange something",
      retro: "Do something from the old days",
      speed: "Do something where speed is part of it",
      style: "Work on a style of your own",
    },
    combos: [
      { tags: ["nature", "story"], text: "An afternoon in nature with a good story" },
      { tags: ["nature", "stillness"], text: "A quiet morning outdoors, with no agenda" },
      { tags: ["making", "conviviality"], text: "Make something together, with tea" },
      { tags: ["food", "conviviality"], text: "A long time at the table, with something tasty you made together" },
      { tags: ["movement", "water"], text: "Be on the move by the water" },
      { tags: ["craft", "history"], text: "Learn an old craft from someone who knows it" },
      { tags: ["challenge", "outdoors"], text: "Do something outdoors that is a little scary" },
      { tags: ["learning", "focus"], text: "Dive properly into something for an afternoon" },
    ],
  },
  start: {
    kicker: "Good to have you here",
    heading: "A discovery starts with you",
    sub: "Tell us who we are searching for and where, so we can find something that really fits.",
    sections: { who: "For whom", where: "Where", limits: "Keep in mind" },
    optionalNote: "Only your place is required (*). Everything else you can skip; it just makes your book more personal.",
    required: "required",
    who: {
      label: "Who is this search for?",
      labelGift: "Who is this window for?",
      sub: "This decides what we look at. Choose nothing and we search for you.",
      options: {
        self: { label: "For myself", sub: "Something for you" },
        child: { label: "A child or young person", sub: "A child or a teenager" },
        adult: { label: "An adult", sub: "Partner, friend, parent or colleague" },
        group: { label: "A group", sub: "Family, friends or a team" },
      },
      otherCard: { label: "For someone else", sub: "A gift or an outing for somebody else" },
      otherPrompt: "Who is it?",
      pill: { self: "For myself", other: "For someone else", named: "For {name}", group: "For a group" },
      nameLabel: "What's their name? A name makes your book more personal.",
    },
    country: { label: "Country", geoNote: "We filled this in from your connection. Not right? Change it freely." },
    distance: {
      label: "How far would you travel?",
      hint: "We measure the distance from your starting place. We don't look further than this.",
      upTo: "Up to {km} km",
      over100: "More than 100 km",
      tickOver100: ">100",
    },
    budget: {
      label: "Roughly what may this experience cost per person?",
      hint: "This decides which activities we show you. Leave it open and we won't hold to a fixed amount.",
      unset: "Nothing chosen yet: slide to choose an amount",
      clear: "No preference",
      upTo: "Up to €{n} per person",
      any: "Doesn't matter",
    },
    limits: {
      sub: "Only if it matters.",
      timeLabelOther: "How much time is there?",
      chipsLabel: "Anything we should keep in mind?",
      chipsTitle: "Tap what matters to you",
      chipsSub: "Entirely optional: we search just fine without. Only tap what really matters to you. You can pick several.",
      chipsSkip: "Nothing in particular? Just carry on.",
      optional: "optional",
      groups: [
        { title: "Setting", chips: ["Only outdoors", "Only indoors"] },
        { title: "Access", chips: ["Wheelchair accessible", "Reachable without a car"] },
        { title: "Company", chips: ["Not in a group", "With a dog", "With children", "With young children"] },
        { title: "Pace and stimulation", chips: ["Calm pace", "Quiet and predictable"] },
        { title: "How do you want to take part?", chips: ["Meet people", "With one other person", "With a group"] },
        { title: "Food and drink", chips: ["No alcohol", "No fish or shellfish"] },
        { title: "Language", chips: ["No Dutch needed"] },
        { title: "Animals", chips: ["No hunting or fishing", "No animals"] },
        { title: "When", chips: ["On weekends", "In the evening"] },
      ],
    },
  },
  situation: {
    heading: "Where, when and with whom?",
    headingGift: "Where, when and with whom for {name}?",
  },
  room: {
    locationLabel: "From which place may we set out on a discovery?",
    locationLabelGift: "From which place may we set out on a discovery for {name}? ‖ From which place may we set out on a discovery?",
    locationSub: "This is the starting point of the search. We measure distances from this place. Home, work or somewhere else: you choose.",
    locationPlaceholder: "Type a place, for example Utrecht…",
    distanceLabel: "How far would you travel?",
    distanceOptions: [
      { value: "city", label: "In this place" },
      { value: "hour", label: "Up to an hour away" },
      { value: "anywhere", label: "Anywhere in the Netherlands" },
    ],
    timeLabel: "How much time do you have?",
    budgetLabel: "Roughly what can it cost?",
  },
  who: {
    limitChips: [
      "Only outdoors",
      "Only indoors",
      "Not in a group",
      "Wheelchair accessible",
      "With a dog",
      "No alcohol",
      "No fish or shellfish",
      "No Dutch needed",
      "No hunting or fishing",
      "No animals",
      "With children",
      "With young children",
      "Calm pace",
      "Quiet and predictable",
      "Meet people",
      "With one other person",
      "With a group",
      "Reachable without a car",
      "On weekends",
      "In the evening",
    ],
  },
  nav: {
    back: "Back",
    next: "Continue",
    submit: "On to your Idea Book",
    submitting: "Closing your window…",
    windowOpen: "See your window",
    windowClose: "Close",
    windowTitle: "Your window",
    scrollCue: "Keep going to order your discovery book",
    toOrder: "To your order",
    windowDownload: "Download your window as a picture",
    hint: {
      images: "Pick {n} or more to carry on.",
      concrete: "Tap at least one, or let us surprise you.",
      worlds: "Pick at least one direction, or let us choose.",
      round: "Pick at least one image to continue.",
      missing: "Please add: {list}.",
      place: "your place",
      time: "time",
      budget: "budget",
    },
  },
  panes: { worlds: "Direction", places: "Place", moments: "Moment", senses: "Sense", surprise: "Surprise me" },
  sill: { empty: "Every choice finds a place in your window.", with: "with" },
  checkout: {
    heading: "Your window is full.",
    headingGift: "{name}'s window is full. ‖ The window is full.",
    whatYouGet: [
      `Six ideas and one sealed wildcard, from ${doorRange("en")}`,
      "For each idea: why it fits you, three sizes (taste, do, go deeper) and a first step",
      "Real places near you where we found them, with a map link",
      "A PDF with your window on the cover, also in your inbox",
    ],
    freeNote: "Your window and your profile portrait are free. You pay once for the write-up.",
  },
  reveal: {
    chose: "You chose {list}.",
    choseGift: "Chosen for you: {list}.",
    wrote: "You wrote: ‘{text}’.",
    because: "Because you chose {image}",
    becauseGift: "Chosen with {image} in mind",
    placeLabel: "Where",
    mapLink: "On the map",
  },
  thread: {
    heading: "How we got here",
    imageCaption: "Your image",
    tagsCaption: "What we read in it",
    doorCaption: "The door that fits",
    ownDoorCaption: "Chosen by you",
    placeCaption: "A real place, from our research",
    pdfBoth: "This door follows from the image ‘{image}’, in which we read {tags}.",
    pdfImage: "This door follows from the image ‘{image}’.",
    pdfTags: "In the chosen images we read {tags}.",
    pdfOwn: "You chose this yourself.",
    pathCaption: "Where your images pointed: derived by us, not chosen by you",
    pdfPath: "On the way we passed {path}: we derive that from your images, it is not something you picked.",
  },
  more: {
    heading: "More about this door",
    feelsHeading: "How it feels",
    sizesHeading: "Three sizes",
    sizeNames: ["Taste", "Do", "Go further"],
    sizeHints: ["About 1 hour", "Half a day", "A weekend or a course"],
    placesHeading: "Real places",
    placesNote: "From our research. Check opening times and prices yourself.",
    ratingLine: "Rated {score}/5 on {source}{reviews}",
    ratingReviews: " ({n} reviews)",
    ratingDecimal: ".",
    mapLink: "On the map",
    siteLink: "Website",
    relatedHeading: "Also in this direction",
    nextHeading: "Next",
    pdfEyebrow: "More about this door",
  },
  invite: {
    button: "Share an invitation",
    heading: "Invite someone to open a window",
    sub: "A picture for your story or chat. Nothing personal on it, just the invitation.",
    formatStory: "Story",
    formatSquare: "Square",
    formatLabel: "Format",
    share: "Share the picture",
    download: "Download picture",
    whatsapp: "Open WhatsApp with the link",
    copyLink: "Copy link",
    copied: "Link copied",
    previewAlt: "Preview of the invitation",
    shareText: "Discover what's possible, for you. Open a window:",
    cardHeadline: "Discover what's possible for you.",
    cardSub: "Pick a few images. Get seven doors, just for you.",
    cardCta: "Open your window",
  },
  feedback: {
    heading: "You're helping us a lot",
    sub: "This is a test version. Eight short questions, about two minutes. You can skip anything.",
    scoreLabel: "How did it feel to fill your window?",
    scoreOptions: ["Tough", "So-so", "Fine", "Nice", "Lovely"],
    profileLabel: "Did you feel understood by \u201CWhat your choices tell us\u201D?",
    doorsLabel: "Did you get why you received these doors?",
    agreeOptions: ["Not at all", "Not really", "Half", "Fairly well", "Completely"],
    pickLabel: "Which door would you really do?",
    pickNone: "None of these",
    placesLabel: "Did the places and providers in your book fit your surroundings? (Do they exist, are they really near you, could you do something with them?)",
    mailLabel: "Did the e-mail with your book arrive?",
    mailOptions: [
      { value: "inbox", label: "Yes, in my inbox" },
      { value: "spam", label: "Yes, but in spam" },
      { value: "missing", label: "Not yet" },
    ],
    payLabel: "Would you pay {price} for this book?",
    payOptions: [
      { value: "yes", label: "Yes" },
      { value: "maybe", label: "Maybe" },
      { value: "no", label: "No" },
    ],
    doubtLabel: "Where did you hesitate, or almost give up?",
    doubtPlaceholder: "Short is fine. Or empty.",
    submit: "Send",
    thanks: "Thank you. This really helps.",
    error: "Sending didn't work. Please try again later.",
  },
  pdf: { coverTitle: "A window for you", coverTitleGift: "A window for {name}", coverTitleGroup: "A window for all of you" },
  testBanner: "Test version · pay with test card 4242 4242 4242 4242, nothing is charged.",
  errorGeneric: "Something went wrong while saving your choices. Refresh the page and try again: your choices are kept.",
};
