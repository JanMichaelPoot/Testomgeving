// Copy of the image intake and its window ("Het venster", WindowInto/WINDOW_Bouwopdracht_Venster_Fase0-8.md).
// Kept in its own file because dictionaries.ts is already very long; it is part of the same
// Dictionary (dict.venster) and follows the same rules: nl and en, same tone (warm, curious,
// a little mischievous). "{name}" is the recipient's first name in gift mode, or a neutral
// fallback (see fill() in AssociationWizard).

export interface VensterDictionary {
  landing: {
    selfCta: string;
    giftCta: string;
    badge: string; // {price}
    headline: string;
    headlineEmphasis: string; // the italic part, shown after headline
    subcopy: string;
    heroAlt: string;
    chapters: { title: string; body: string }[];
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
      reasons: Record<"season" | "budget" | "effort" | "supervised" | "setting" | "format" | "groups", string>;
      editSituation: string;
      editChoices: string;
    };
    steps: { images: string; concrete: string };
    images: { kicker: string; heading: string; headingGift: string; sub: string; subGift: string; chosen: string; min: string; max: string; more: string; moreSub: string; noMore: string };
    concrete: {
      kicker: string;
      heading: string;
      headingGift: string;
      sub: string;
      subGift: string;
      chosen: string;
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
  // The last screen of the image intake: "Zo kijken wij door jouw venster" (R2.1). Fixed sentence
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
    tensionLabel: string;
    axesTitle: string;
    axes: Record<"social" | "energy" | "setting" | "novelty", { label: string; low: string; high: string }>;
    seekTitle: string;
    omitTitle: string;
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
    };
    missTitle: string;
    missTitleGift: string; // {name}
    missSub: string;
    missPlaceholder: string;
    suggestions: Record<string, string>;
    combos: { tags: [string, string]; text: string }[];
    teaser: string;
    adjust: string;
    adjustDone: string;
    fixPrompt: string;
    moreTitle: string;
  };
  /** The merged "Jouw situatie" screen (place, time, budget, company; the rest behind "more"). */
  situation: { heading: string; headingGift: string; moreLabel: string; moreSub: string };
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
    companyLabel: string;
    companyLabelGift: string;
    howLabel: string;
    howOptions: Record<string, { value: string; label: string }[]>;
    anyLabel: string;
    ageLabel: string;
    ageLabelGift: string;
    ageSub: string;
    limitsLabel: string;
    limitsSub: string;
    limitChips: string[];
    limitsPlaceholder: string;
  };
  nav: { back: string; next: string; submit: string; submitting: string; windowOpen: string; windowClose: string; windowTitle: string; windowDownload: string };
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
    payLabel: string; // {price}
    payOptions: { value: "yes" | "maybe" | "no"; label: string }[];
    doubtLabel: string;
    doubtPlaceholder: string;
    submit: string;
    thanks: string;
    error: string;
  };
  pdf: { coverTitle: string; coverTitleGift: string }; // {name}
  testBanner: string;
  errorGeneric: string;
}

export const vensterNl: VensterDictionary = {
  landing: {
    selfCta: "Open je venster",
    giftCta: "Geef een venster cadeau",
    badge: "Nieuw · {price} · geen account",
    headline: "Ontdek wat er mogelijk is",
    headlineEmphasis: "voor jou.",
    subcopy:
      "Kies een handvol beelden die je aantrekken. Wij maken er een Idea Book van, met echte plekken bij jou in de buurt.",
    heroAlt: "Een open raam met zacht licht en een uitzicht naar buiten",
    chapters: [
      { title: "Jouw beelden", body: "Kies beelden die je aantrekken. Geen vragenlijst." },
      { title: "Praktisch", body: "Plaats, tijd en budget, voor echte adressen." },
      { title: "Met wie", body: "En je harde grenzen. Dan is je venster vol." },
    ],
  },
  chapters: { images: "Jouw beelden", situation: "Jouw situatie", extra: "Jouw venster" },
  recipientFallback: "diegene",
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
    images: {
      kicker: "Jouw beelden · 1 van 2",
      heading: "Wat trekt je aan?",
      headingGift: "Wat zou {name} aantrekken?",
      sub: "Kies wat je aantrekt, zonder na te denken. Vijf tot acht beelden werkt het best.",
      subGift: "Kies wat {name} zou aantrekken, zonder lang na te denken. Vijf tot acht beelden werkt het best.",
      chosen: "{n} gekozen",
      min: "Kies er minstens {n} om door te gaan.",
      max: "Dat zijn er acht. Haal er één weg om een ander te kiezen.",
      more: "Andere beelden",
      moreSub: "Wat je koos blijft staan.",
      noMore: "Meer nieuwe beelden hebben we niet. Wat je koos blijft staan.",
    },
    concrete: {
      kicker: "Jouw beelden · 2 van 2",
      heading: "Waar wijzen je beelden naartoe?",
      headingGift: "Waar wijzen de beelden van {name} naartoe?",
      sub: "Dit zijn bezigheden die bij je beelden passen. Kies er een paar waar je nieuwsgierig naar bent: drie tot zes is genoeg.",
      subGift: "Dit zijn bezigheden die bij de beelden passen. Kies er een paar waar {name} nieuwsgierig naar zou zijn: drie tot zes is genoeg.",
      chosen: "{n} gekozen",
      min: "Kies er minstens één, of laat ons kiezen.",
      max: "Dat zijn er zes. Haal er één weg om een ander te kiezen.",
      more: "Andere activiteiten",
      moreSub: "Wat je koos blijft staan.",
      noMore: "Meer nieuwe activiteiten hebben we niet. Wat je koos blijft staan.",
      chooseForMe: "Kies voor mij",
      chooseForMeSub: "We kiezen op basis van je beelden",
      chooseForMeSubGift: "We kiezen op basis van de beelden",
      maybe: "Misschien ook?",
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
    heading: "Zo kijken wij door jouw venster",
    headingGift: "Zo kijken wij door het venster van {name}",
    and: "en",
    headline: "Je zoekt {a}, en {b}.",
    headlineGift: "{name} zoekt {a}, en {b}.",
    headlineOne: "Je zoekt {a}.",
    headlineOneGift: "{name} zoekt {a}.",
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
      animals: "dieren om je heen",
      teamwork: "iets dat je samen voor elkaar krijgt",
      strategy: "de stille voldoening van een slim plan",
      making: "plekken waar handen iets te doen hebben",
      rhythm: "een ritme dat je meeneemt",
      sound: "klank die iets in je losmaakt",
      movement: "beweging die je hoofd leegmaakt",
      focus: "iets waarin je helemaal kunt opgaan",
      stillness: "stilte die niets van je vraagt",
      discovery: "iets dat je nog niet kende",
      craft: "het geduld van een echt vak",
      technique: "het plezier van uitzoeken hoe iets werkt",
      nature: "ruimte, groen en weer",
      collecting: "de rust van ordenen en bewaren",
      miniature: "alles op de maat van je hand",
      roleplay: "even iemand anders mogen zijn",
      competition: "een eerlijk gevecht met een knipoog",
      learning: "iets nieuws dat blijft hangen",
      caring: "iets of iemand om voor te zorgen",
      food: "wat er op tafel komt, en hoe het smaakt",
      water: "water dat de tijd vertraagt",
      height: "uitzicht van boven",
      challenge: "een uitdaging die je net aankunt",
      retro: "de charme van toen",
      style: "een stijl die helemaal bij jou past",
      color: "kleur die je blij maakt",
      language: "woorden die ergens heen gaan",
      stars: "een hemel vol sterren",
      puzzling: "de klik als alles op zijn plek valt",
      growing: "iets dat groeit onder je handen",
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
      precision: "Het gaat om precies, om dat ene moment waarop iets klopt tot op de millimeter.",
      story: "Een plek wordt pas echt als er een verhaal bij hoort.",
      history: "Het verleden trekt, als verhaal, als spoor in een muur, als iets dat nog nazindert.",
      outdoors: "Buiten is waar het hoofd leegloopt en het weer meedoet.",
      animals: "Dieren brengen terug wat woorden niet kunnen: aandacht voor het hier en nu.",
      teamwork: "Het is mooier als je het samen voor elkaar krijgt dan als je het alleen redt.",
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
      water: "Bij water slaat de tijd om: alles vertraagt en de lucht wordt zachter.",
      height: "Van boven ziet alles er kleiner en eenvoudiger uit.",
      challenge: "Een uitdaging die net past maakt je trots zonder dat je het hoeft te zeggen.",
      retro: "Wat oud is heeft iets warms dat nieuw niet kan nabootsen.",
      style: "Een eigen stijl laat zien wie je bent, zonder dat je het hoeft uit te leggen.",
      color: "Kleur werkt direct: ze maakt een dag van binnen anders.",
      language: "Woorden kunnen een heel landschap oproepen.",
      stars: "Onder een hemel vol sterren worden zorgen vanzelf kleiner.",
      puzzling: "De klik als alles op zijn plek valt is een klein feestje.",
      growing: "Iets zien groeien leert geduld, en beloont het.",
      conviviality: "Gezelligheid hoeft niet groot te zijn: een tafel, een lamp en mensen die blijven zitten.",
      balance: "Evenwicht vinden is minder stilstaan dan zacht schakelen.",
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
    picksLine: "Zelf koos je ook {list}: dat nemen we als vertrekpunt.",
    picksLineGift: "{name} koos zelf ook {list}: dat nemen we als vertrekpunt.",
    openHeadline: "Het venster staat nog open.",
    openHeadlineGift: "Het venster staat nog open.",
    openStory: "Geen probleem: dan verrassen we je met een mix die je zelf misschien niet had gekozen.",
    openStoryGift: "Geen probleem: dan verrassen we {name} met een mix die misschien nog niet bedacht was.",
    tension: {
      energy: "Je koos rust én spanning. Dat is geen tegenspraak: je zoekt iets waar je helemaal in kunt opgaan.",
      novelty: "Je koos vertrouwd én onbekend. Dat is geen tegenspraak: je zoekt herkenning met een verrassing erin.",
      social: "Je koos samen én alleen. Dat is geen tegenspraak: je zoekt een plek om erbij te horen én om even apart te zijn.",
      setting: "Je koos binnen én buiten. Dat is geen tegenspraak: voor jou telt de sfeer, niet de plek.",
    },
    tensionGift: {
      energy: "Er zit rust én spanning in deze keuze. Dat is geen tegenspraak: {name} zoekt iets om helemaal in op te gaan.",
      novelty: "Er zit vertrouwd én onbekend in deze keuze. Dat is geen tegenspraak: {name} zoekt herkenning met een verrassing erin.",
      social: "Er zit samen én alleen in deze keuze. Dat is geen tegenspraak: {name} zoekt een plek om erbij te horen én om even apart te zijn.",
      setting: "Er zit binnen én buiten in deze keuze. Dat is geen tegenspraak: voor {name} telt de sfeer, niet de plek.",
    },
    strong: {
      energy: { low: "Je beelden ademen rust. Dat nemen we serieus: niets dat jaagt.", high: "Je beelden hebben vaart. Dat nemen we serieus: iets met energie." },
      novelty: { low: "Je beelden voelen vertrouwd. Dat nemen we serieus: eerst herkenning, dan pas een verrassing.", high: "Je beelden willen iets nieuws. Dat nemen we serieus: liever onbekend dan bekend." },
      social: { low: "Je beelden vragen om tijd alleen. Dat nemen we serieus: ruimte om in je eentje op te gaan in iets.", high: "Je beelden vragen om gezelschap. Dat nemen we serieus: iets om samen te doen." },
      setting: { low: "Je beelden zijn thuis binnen. Dat nemen we serieus: beschut en warm.", high: "Je beelden zijn buiten thuis. Dat nemen we serieus: lucht, licht en ruimte." },
    },
    strongGift: {
      energy: { low: "Deze beelden ademen rust. Dat nemen we serieus: niets dat jaagt.", high: "Deze beelden hebben vaart. Dat nemen we serieus: iets met energie." },
      novelty: { low: "Deze beelden voelen vertrouwd. Dat nemen we serieus: eerst herkenning, dan pas een verrassing.", high: "Deze beelden willen iets nieuws. Dat nemen we serieus: liever onbekend dan bekend." },
      social: { low: "Deze beelden vragen om tijd alleen. Dat nemen we serieus: ruimte om in je eentje op te gaan in iets.", high: "Deze beelden vragen om gezelschap. Dat nemen we serieus: iets om samen te doen." },
      setting: { low: "Deze beelden zijn thuis binnen. Dat nemen we serieus: beschut en warm.", high: "Deze beelden zijn buiten thuis. Dat nemen we serieus: lucht, licht en ruimte." },
    },
    balanced: "Je beelden wijzen niet één kant op. Dat maakt het spannend: we laten je meerdere kanten zien.",
    balancedGift: "Deze beelden wijzen niet één kant op. Dat maakt het spannend: we laten meerdere kanten zien.",
    open: "Je venster staat nog open. Geen probleem: dan verrassen we je.",
    openGift: "Het venster staat nog open. Geen probleem: dan verrassen we {name}.",
    tensionLabel: "Wat opvalt",
    axesTitle: "Stuur zelf bij",
    axes: {
      social: { label: "Alleen of samen", low: "Alleen", high: "Samen" },
      energy: { label: "Rust of actie", low: "Rust", high: "Actie" },
      setting: { label: "Binnen of buiten", low: "Binnen", high: "Buiten" },
      novelty: { label: "Vertrouwd of nieuw", low: "Vertrouwd", high: "Nieuw" },
    },
    seekTitle: "Dit zoeken we",
    omitTitle: "Dit laten we weg",
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
      budget: { free: "Gratis", "25": "Tot €25", "100": "Tot €100" },
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
    },
    missTitle: "Wat missen we nog?",
    missTitleGift: "Wat missen we nog voor {name}?",
    missSub: "Optioneel. Eén zin is genoeg, en het telt zwaar mee.",
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
    teaser: "Eén van je zeven deuren zal je verrassen.",
    adjust: "Bijsturen",
    adjustDone: "Klaar met bijsturen",
    fixPrompt: "Wat zoek je meer? Kies er tot drie.",
    moreTitle: "Bekijk en stuur bij",
  },
  situation: {
    heading: "Waar, wanneer en met wie?",
    headingGift: "Waar, wanneer en met wie voor {name}?",
    moreLabel: "Meer opgeven",
    moreSub: "Optioneel: leeftijd, hoe je het liefst doet en harde grenzen.",
  },
  room: {
    locationLabel: "Vanaf welke plaats zoek je?",
    locationLabelGift: "Vanaf welke plaats zoeken we voor {name}?",
    locationSub: "We zoeken echte activiteiten rond deze plaats in Nederland. Thuis, je werk of ergens anders: jij kiest.",
    locationPlaceholder: "Typ een plaats, bijvoorbeeld Utrecht…",
    distanceLabel: "Hoe ver mag het zijn?",
    distanceOptions: [
      { value: "city", label: "In deze plaats" },
      { value: "hour", label: "Tot een uur reizen" },
      { value: "anywhere", label: "Heel Nederland" },
    ],
    timeLabel: "Hoeveel tijd heb je?",
    budgetLabel: "Wat mag het kosten?",
  },
  who: {
    companyLabel: "Wie gaat er mee?",
    companyLabelGift: "Met wie zou {name} gaan?",
    howLabel: "En hoe het liefst?",
    howOptions: {
      alone: [
        { value: "solo", label: "In mijn eigen tempo, alleen" },
        { value: "drop_in_alone", label: "Alleen komen, samen doen" },
      ],
      partner: [
        { value: "duo", label: "Met z'n tweeën" },
        { value: "small_group", label: "Met een paar anderen erbij" },
      ],
      friends: [
        { value: "small_group", label: "Met een klein groepje" },
        { value: "large_group", label: "Met een grote groep" },
      ],
      family: [
        { value: "with_known", label: "Met de familie erbij" },
        { value: "small_group", label: "In een klein gezelschap" },
      ],
      colleagues: [
        { value: "with_known", label: "Met de collega's samen" },
        { value: "large_group", label: "Als hele groep" },
      ],
    },
    anyLabel: "Maakt niet uit",
    ageLabel: "Hoe oud ben je?",
    ageLabelGift: "Hoe oud is {name}?",
    ageSub: "Dit telt mee in welke ideeën je krijgt. Mag je overslaan.",
    limitsLabel: "Harde grenzen",
    limitsSub: "Alleen wat écht niet kan of juist moet. Mag leeg blijven.",
    limitChips: [
      "Moet buiten zijn",
      "Moet binnen kunnen",
      "Geen groepen",
      "Rolstoeltoegankelijk",
      "Moet met de hond kunnen",
      "Geen alcohol",
      "Geen vis of schaaldieren",
      "Met kinderen",
    ],
    limitsPlaceholder: "Nog iets anders dat écht niet kan?",
  },
  nav: {
    back: "Terug",
    next: "Verder",
    submit: "Naar je Idea Book",
    submitting: "Je venster wordt gesloten…",
    windowOpen: "Bekijk je venster",
    windowClose: "Sluiten",
    windowTitle: "Jouw venster",
    windowDownload: "Download je venster als afbeelding",
  },
  panes: { worlds: "Richting", places: "Plek", moments: "Moment", senses: "Zintuig", surprise: "Verras me" },
  sill: { empty: "Elke keuze krijgt een plek in je venster.", with: "met" },
  checkout: {
    heading: "Je venster is vol.",
    headingGift: "Het venster voor {name} is vol.",
    whatYouGet: [
      "Zeven mogelijkheden in zeven niveaus, van vertrouwd tot onontdekt, de laatste als verzegelde wildcard",
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
    sub: "Dit is een testversie. Zes korte vragen, het kost ongeveer een minuut. Alles mag je overslaan.",
    scoreLabel: "Hoe voelde het om je venster te vullen?",
    scoreOptions: ["Taai", "Matig", "Prima", "Fijn", "Heerlijk"],
    profileLabel: "Voelde je je begrepen door \u201CZo kijken wij door jouw venster\u201D?",
    doorsLabel: "Snapte je waarom je deze deuren kreeg?",
    agreeOptions: ["Helemaal niet", "Niet echt", "Half", "Vrij goed", "Helemaal"],
    pickLabel: "Welke deur zou je echt gaan doen?",
    pickNone: "Geen van deze",
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
  pdf: { coverTitle: "Een venster voor jou", coverTitleGift: "Een venster voor {name}" },
  testBanner: "Testversie · betaal met testkaart 4242 4242 4242 4242, er wordt niets afgeschreven.",
  errorGeneric: "Er ging iets mis. Probeer het opnieuw.",
};

export const vensterEn: VensterDictionary = {
  landing: {
    selfCta: "Open your window",
    giftCta: "Give a window as a gift",
    badge: "New · {price} · no account",
    headline: "Discover what's possible",
    headlineEmphasis: "for you.",
    subcopy: "Pick a handful of images that pull you in. We turn them into an Idea Book, with real places near you.",
    heroAlt: "An open window with soft light and a view outside",
    chapters: [
      { title: "Your images", body: "Pick images that pull you in. No questionnaire." },
      { title: "Practical", body: "Place, time and budget, for real addresses." },
      { title: "With whom", body: "And your hard limits. Then your window is full." },
    ],
  },
  chapters: { images: "Your images", situation: "Your situation", extra: "Your window" },
  recipientFallback: "them",
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
    images: {
      kicker: "Your images · 1 of 2",
      heading: "What draws you in?",
      headingGift: "What would draw {name} in?",
      sub: "Choose what draws you in, without thinking too hard. Five to eight images works best.",
      subGift: "Choose what would draw {name} in, without thinking too hard. Five to eight images works best.",
      chosen: "{n} chosen",
      min: "Choose at least {n} to continue.",
      max: "That is eight. Remove one to choose another.",
      more: "Other images",
      moreSub: "What you chose stays.",
      noMore: "There are no more new images. What you chose stays.",
    },
    concrete: {
      kicker: "Your images · 2 of 2",
      heading: "Where do your images point?",
      headingGift: "Where do {name}'s images point?",
      sub: "These are things to do that fit your images. Choose a few that make you curious: three to six is plenty.",
      subGift: "These are things to do that fit the images. Choose a few {name} would be curious about: three to six is plenty.",
      chosen: "{n} chosen",
      min: "Choose at least one, or let us choose.",
      max: "That is six. Remove one to choose another.",
      more: "Other activities",
      moreSub: "What you chose stays.",
      noMore: "There are no more new activities. What you chose stays.",
      chooseForMe: "Choose for me",
      chooseForMeSub: "We choose from your images",
      chooseForMeSubGift: "We choose from the images",
      maybe: "Maybe too?",
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
    heading: "How we look through your window",
    headingGift: "How we look through {name}'s window",
    and: "and",
    headline: "You're looking for {a}, and {b}.",
    headlineGift: "{name} is looking for {a}, and {b}.",
    headlineOne: "You're looking for {a}.",
    headlineOneGift: "{name} is looking for {a}.",
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
      teamwork: "something you pull off together",
      strategy: "the quiet satisfaction of a clever plan",
      making: "places where hands have something to do",
      rhythm: "a rhythm that carries you",
      sound: "sound that loosens something in you",
      movement: "movement that clears your head",
      focus: "something to get completely absorbed in",
      stillness: "a stillness that asks nothing of you",
      discovery: "something you didn't know yet",
      craft: "the patience of a real craft",
      technique: "the joy of working out how something works",
      nature: "space, green and weather",
      collecting: "the calm of sorting and keeping",
      miniature: "everything the size of your hand",
      roleplay: "a chance to be someone else for a while",
      competition: "a fair fight with a wink",
      learning: "something new that sticks",
      caring: "something or someone to look after",
      food: "what's on the table and how it tastes",
      water: "water that slows time down",
      height: "a view from above",
      challenge: "a challenge you can just manage",
      retro: "the charm of back then",
      style: "a style that is entirely yours",
      color: "colour that makes you happy",
      language: "words that are going somewhere",
      stars: "a sky full of stars",
      puzzling: "the click when everything falls into place",
      growing: "something growing under your hands",
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
    picksLine: "You also chose {list} yourself: we take that as a starting point.",
    picksLineGift: "{name} also chose {list}: we take that as a starting point.",
    openHeadline: "Your window is still open.",
    openHeadlineGift: "The window is still open.",
    openStory: "No problem: we'll surprise you with a mix you might not have chosen yourself.",
    openStoryGift: "No problem: we'll surprise {name} with a mix that might not have been thought of yet.",
    tension: {
      energy: "You chose calm and tension. That's no contradiction: you're looking for something to lose yourself in.",
      novelty: "You chose familiar and unknown. That's no contradiction: you're looking for recognition with a surprise in it.",
      social: "You chose together and alone. That's no contradiction: you're looking for a place to belong and to be apart for a while.",
      setting: "You chose indoors and outdoors. That's no contradiction: for you the mood counts, not the place.",
    },
    tensionGift: {
      energy: "There is calm and tension in this choice. That's no contradiction: {name} is looking for something to lose themselves in.",
      novelty: "There is familiar and unknown in this choice. That's no contradiction: {name} is looking for recognition with a surprise in it.",
      social: "There is together and alone in this choice. That's no contradiction: {name} is looking for a place to belong and to be apart for a while.",
      setting: "There is indoors and outdoors in this choice. That's no contradiction: for {name} the mood counts, not the place.",
    },
    strong: {
      energy: { low: "Your images breathe calm. We take that seriously: nothing that rushes.", high: "Your images have pace. We take that seriously: something with energy." },
      novelty: { low: "Your images feel familiar. We take that seriously: recognition first, a surprise later.", high: "Your images want something new. We take that seriously: unknown rather than known." },
      social: { low: "Your images ask for time alone. We take that seriously: room to lose yourself in something.", high: "Your images ask for company. We take that seriously: something to do together." },
      setting: { low: "Your images are at home indoors. We take that seriously: sheltered and warm.", high: "Your images are at home outdoors. We take that seriously: air, light and space." },
    },
    strongGift: {
      energy: { low: "These images breathe calm. We take that seriously: nothing that rushes.", high: "These images have pace. We take that seriously: something with energy." },
      novelty: { low: "These images feel familiar. We take that seriously: recognition first, a surprise later.", high: "These images want something new. We take that seriously: unknown rather than known." },
      social: { low: "These images ask for time alone. We take that seriously: room to lose yourself in something.", high: "These images ask for company. We take that seriously: something to do together." },
      setting: { low: "These images are at home indoors. We take that seriously: sheltered and warm.", high: "These images are at home outdoors. We take that seriously: air, light and space." },
    },
    balanced: "Your images don't point one way. That makes it exciting: we'll show you several sides.",
    balancedGift: "These images don't point one way. That makes it exciting: we'll show several sides.",
    open: "Your window is still open. No problem: we'll surprise you.",
    openGift: "The window is still open. No problem: we'll surprise {name}.",
    tensionLabel: "What stands out",
    axesTitle: "Steer it yourself",
    axes: {
      social: { label: "Alone or together", low: "Alone", high: "Together" },
      energy: { label: "Calm or action", low: "Calm", high: "Action" },
      setting: { label: "Indoors or outdoors", low: "Indoors", high: "Outdoors" },
      novelty: { label: "Familiar or new", low: "Familiar", high: "New" },
    },
    seekTitle: "What we look for",
    omitTitle: "What we leave out",
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
      budget: { free: "Free", "25": "Up to €25", "100": "Up to €100" },
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
    },
    missTitle: "What are we missing?",
    missTitleGift: "What are we missing for {name}?",
    missSub: "Optional. One sentence is enough, and it weighs heavily.",
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
    teaser: "One of your seven doors will surprise you.",
    adjust: "Adjust",
    adjustDone: "Done adjusting",
    fixPrompt: "What do you want more of? Pick up to three.",
    moreTitle: "View and adjust",
  },
  situation: {
    heading: "Where, when and with whom?",
    headingGift: "Where, when and with whom for {name}?",
    moreLabel: "Add more",
    moreSub: "Optional: age, how you like to do it, and hard limits.",
  },
  room: {
    locationLabel: "Which place do you search from?",
    locationLabelGift: "Which place do we search from for {name}?",
    locationSub: "We look for real activities around this place in the Netherlands. Home, work or somewhere else: your call.",
    locationPlaceholder: "Type a place, for example Utrecht…",
    distanceLabel: "How far may it be?",
    distanceOptions: [
      { value: "city", label: "In this place" },
      { value: "hour", label: "Up to an hour away" },
      { value: "anywhere", label: "Anywhere in the Netherlands" },
    ],
    timeLabel: "How much time do you have?",
    budgetLabel: "What may it cost?",
  },
  who: {
    companyLabel: "Who's coming along?",
    companyLabelGift: "Who would {name} go with?",
    howLabel: "And how, ideally?",
    howOptions: {
      alone: [
        { value: "solo", label: "At my own pace, alone" },
        { value: "drop_in_alone", label: "Come alone, do it together" },
      ],
      partner: [
        { value: "duo", label: "Just the two of us" },
        { value: "small_group", label: "With a few others around" },
      ],
      friends: [
        { value: "small_group", label: "In a small group" },
        { value: "large_group", label: "In a big group" },
      ],
      family: [
        { value: "with_known", label: "With the family" },
        { value: "small_group", label: "In a small party" },
      ],
      colleagues: [
        { value: "with_known", label: "Together with colleagues" },
        { value: "large_group", label: "As a whole group" },
      ],
    },
    anyLabel: "Doesn't matter",
    ageLabel: "How old are you?",
    ageLabelGift: "How old is {name}?",
    ageSub: "This shapes which ideas you get. Feel free to skip.",
    limitsLabel: "Hard limits",
    limitsSub: "Only what really can't or must happen. Can stay empty.",
    limitChips: [
      "Must be outdoors",
      "Must work indoors",
      "No groups",
      "Wheelchair accessible",
      "Dog-friendly",
      "No alcohol",
      "No fish or shellfish",
      "With children",
    ],
    limitsPlaceholder: "Anything else that really can't happen?",
  },
  nav: {
    back: "Back",
    next: "Continue",
    submit: "On to your Idea Book",
    submitting: "Closing your window…",
    windowOpen: "See your window",
    windowClose: "Close",
    windowTitle: "Your window",
    windowDownload: "Download your window as a picture",
  },
  panes: { worlds: "Direction", places: "Place", moments: "Moment", senses: "Sense", surprise: "Surprise me" },
  sill: { empty: "Every choice finds a place in your window.", with: "with" },
  checkout: {
    heading: "Your window is full.",
    headingGift: "The window for {name} is full.",
    whatYouGet: [
      "Seven possibilities on seven levels, from familiar to undiscovered, the last one a sealed wildcard",
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
    sub: "This is a test version. Six short questions, about a minute. You can skip anything.",
    scoreLabel: "How did it feel to fill your window?",
    scoreOptions: ["Tough", "So-so", "Fine", "Nice", "Lovely"],
    profileLabel: "Did you feel understood by \u201CHow we look through your window\u201D?",
    doorsLabel: "Did you get why you received these doors?",
    agreeOptions: ["Not at all", "Not really", "Half", "Fairly well", "Completely"],
    pickLabel: "Which door would you really do?",
    pickNone: "None of these",
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
  pdf: { coverTitle: "A window for you", coverTitleGift: "A window for {name}" },
  testBanner: "Test version · pay with test card 4242 4242 4242 4242, nothing is charged.",
  errorGeneric: "Something went wrong. Please try again.",
};
