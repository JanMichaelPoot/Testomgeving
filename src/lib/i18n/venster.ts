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
  chapters: { images: string; room: string; who: string; extra: string };
  recipientFallback: string;
  recipientLabel: string;
  recipientPlaceholder: string;
  worlds: { heading: string; headingGift: string; sub: string; surprise: string; surpriseSub: string; chosen: string };
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
    chose: string; // {list}
    choseGift: string; // {name} {list}
    readOne: string; // {a}
    readTwo: string; // {a} {b}
    seek: string; // {parts}
    seekNeutral: string;
    leanings: { inside: string; outside: string; calm: string; active: string; alone: string; together: string };
    practical: string; // {list}
    and: string;
    time: Record<string, string>;
    budget: Record<string, string>;
    near: string; // {place}
    company: Record<string, string>; // noun phrases: "een partner"
    withWho: string; // with {list}
    noCompany: string;
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
    agree: string;
    adjust: string;
    adjustDone: string;
    fixPrompt: string;
    moreTitle: string;
  };
  room: {
    heading: string;
    headingGift: string;
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
    heading: string;
    headingGift: string;
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
  nav: { back: string; next: string; submit: string; submitting: string; windowOpen: string; windowClose: string; windowTitle: string };
  panes: { worlds: string; places: string; moments: string; senses: string; surprise: string };
  sill: { empty: string; with: string };
  checkout: {
    heading: string;
    headingGift: string;
    whatYouGet: string[];
    editImages: string;
    editRoom: string;
    editWho: string;
    editProfile: string;
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
  feedback: {
    heading: string;
    sub: string;
    scoreLabel: string;
    scoreOptions: string[];
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
  chapters: { images: "Jouw beelden", room: "Praktisch", who: "Met wie", extra: "Jouw venster" },
  recipientFallback: "diegene",
  recipientLabel: "Voor wie is dit venster?",
  recipientPlaceholder: "Voornaam (mag leeg blijven)",
  worlds: {
    heading: "Waar gaat je nieuwsgierigheid naartoe?",
    headingGift: "Waar gaat de nieuwsgierigheid van {name} naartoe?",
    sub: "Kies één tot vier richtingen. Of laat ons kiezen.",
    surprise: "Verras me",
    surpriseSub: "We kiezen de richtingen voor je",
    chosen: "{n} gekozen",
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
    chose: "Je koos {list}.",
    choseGift: "Voor {name} koos je {list}.",
    readOne: "Daarin lezen we {a}.",
    readTwo: "Daarin lezen we {a} en {b}.",
    seek: "We zoeken dus iets {parts}.",
    seekNeutral: "We zoeken dus iets dat bij die beelden past.",
    leanings: {
      inside: "binnen",
      outside: "buiten",
      calm: "in een rustig tempo",
      active: "met wat vaart",
      alone: "om alleen te doen",
      together: "om samen te doen",
    },
    practical: "Daarbij houden we rekening met {list}.",
    and: "en",
    time: { hour: "een uur of twee", halfday: "een halve dag", fullday: "een hele dag", weekend: "een heel weekend" },
    budget: { free: "gratis", "25": "tot €25", "100": "tot €100", allin: "zonder budgetgrens" },
    near: "rond {place}",
    company: { partner: "een partner", friends: "vrienden", family: "familie", colleagues: "collega's" },
    withWho: "met {list}",
    noCompany: "zonder gezelschap",
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
    agree: "Klopt, open mijn venster",
    adjust: "Bijsturen",
    adjustDone: "Klaar met bijsturen",
    fixPrompt: "Wat zoek je meer? Kies er tot drie.",
    moreTitle: "Bekijk en stuur bij",
  },
  room: {
    heading: "Hoeveel ruimte maak je vrij?",
    headingGift: "Hoeveel ruimte maakt {name} vrij?",
    locationLabel: "Waar woon je ongeveer?",
    locationLabelGift: "Waar woont {name} ongeveer?",
    locationSub: "Voor echte adressen bij jou in de buurt. Plaats of regio is genoeg.",
    locationPlaceholder: "Laren, of ergens in de buurt…",
    distanceLabel: "Hoe ver mag het zijn?",
    distanceOptions: [
      { value: "city", label: "In mijn plaats" },
      { value: "hour", label: "Tot een uur reizen" },
      { value: "anywhere", label: "Heel Nederland" },
    ],
    timeLabel: "Hoeveel tijd heb je?",
    budgetLabel: "Wat mag het kosten?",
  },
  who: {
    heading: "Met wie, en wat moet kloppen?",
    headingGift: "Met wie gaat {name}, en wat moet kloppen?",
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
  },
  panes: { worlds: "Richting", places: "Plek", moments: "Moment", senses: "Zintuig", surprise: "Verras me" },
  sill: { empty: "Elke keuze krijgt een plek in je venster.", with: "met" },
  checkout: {
    heading: "Je venster is vol.",
    headingGift: "Het venster voor {name} is vol.",
    whatYouGet: [
      "Zes deuren en een verzegelde wildcard, gekozen vanuit jouw beelden",
      "Per idee een echte plek bij jou in de buurt en een eerste stap",
      "Een PDF met jouw venster op de cover, ook in je mail",
    ],
    editImages: "Beelden wijzigen",
    editRoom: "Plaats, tijd of budget wijzigen",
    editWho: "Met wie of grenzen wijzigen",
    editProfile: "Profiel of schuiven bijsturen",
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
  feedback: {
    heading: "Je helpt ons enorm",
    sub: "Dit is een testversie. Drie korte vragen, het kost een halve minuut.",
    scoreLabel: "Hoe voelde het om je venster te vullen?",
    scoreOptions: ["Taai", "Matig", "Prima", "Fijn", "Heerlijk"],
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
  chapters: { images: "Your images", room: "Practical", who: "With whom", extra: "Your window" },
  recipientFallback: "them",
  recipientLabel: "Who is this window for?",
  recipientPlaceholder: "First name (optional)",
  worlds: {
    heading: "Where does your curiosity go?",
    headingGift: "Where does {name}'s curiosity go?",
    sub: "Pick one to four. Or let us surprise you.",
    surprise: "Surprise me",
    surpriseSub: "We'll pick the directions for you",
    chosen: "{n} chosen",
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
    chose: "You chose {list}.",
    choseGift: "For {name} you chose {list}.",
    readOne: "In them we read {a}.",
    readTwo: "In them we read {a} and {b}.",
    seek: "So we're looking for something {parts}.",
    seekNeutral: "So we're looking for something that fits those images.",
    leanings: {
      inside: "indoors",
      outside: "outdoors",
      calm: "at a calm pace",
      active: "with some pace",
      alone: "to do alone",
      together: "to do together",
    },
    practical: "We're keeping in mind {list}.",
    and: "and",
    time: { hour: "an hour or two", halfday: "half a day", fullday: "a full day", weekend: "a whole weekend" },
    budget: { free: "keeping it free", "25": "up to €25", "100": "up to €100", allin: "no budget limit" },
    near: "around {place}",
    company: { partner: "a partner", friends: "friends", family: "family", colleagues: "colleagues" },
    withWho: "with {list}",
    noCompany: "going solo",
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
    agree: "That's right, open my window",
    adjust: "Adjust",
    adjustDone: "Done adjusting",
    fixPrompt: "What do you want more of? Pick up to three.",
    moreTitle: "View and adjust",
  },
  room: {
    heading: "How much room are you making?",
    headingGift: "How much room is {name} making?",
    locationLabel: "Roughly where do you live?",
    locationLabelGift: "Roughly where does {name} live?",
    locationSub: "For real addresses near you. A town or region is enough.",
    locationPlaceholder: "Rotterdam, or somewhere nearby…",
    distanceLabel: "How far may it be?",
    distanceOptions: [
      { value: "city", label: "In my town" },
      { value: "hour", label: "Up to an hour away" },
      { value: "anywhere", label: "Anywhere in the Netherlands" },
    ],
    timeLabel: "How much time do you have?",
    budgetLabel: "What may it cost?",
  },
  who: {
    heading: "With whom, and what has to fit?",
    headingGift: "Who will {name} go with, and what has to fit?",
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
  },
  panes: { worlds: "Direction", places: "Place", moments: "Moment", senses: "Sense", surprise: "Surprise me" },
  sill: { empty: "Every choice finds a place in your window.", with: "with" },
  checkout: {
    heading: "Your window is full.",
    headingGift: "The window for {name} is full.",
    whatYouGet: [
      "Six doors and a sealed wildcard, chosen from your images",
      "A real place near you and a first step for every idea",
      "A PDF with your window on the cover, also in your inbox",
    ],
    editImages: "Change images",
    editRoom: "Change place, time or budget",
    editWho: "Change company or limits",
    editProfile: "Adjust your profile or sliders",
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
  feedback: {
    heading: "You're helping us a lot",
    sub: "This is a test version. Three short questions, half a minute.",
    scoreLabel: "How did it feel to fill your window?",
    scoreOptions: ["Tough", "So-so", "Fine", "Nice", "Lovely"],
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
