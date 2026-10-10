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
  reflection: {
    kicker: string;
    heading: string;
    prefix: string;
    prefixGift: string;
    and: string;
    nothing: string;
    question: string;
    yes: string;
    no: string;
    fixPrompt: string;
    fixDone: string;
    leanings: { alone: string; together: string; calm: string; active: string; inside: string; outside: string };
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
  extra: {
    heading: string;
    headingGift: string;
    sub: string;
    placeholder: string;
    suggestions: string[];
    skip: string;
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
      { title: "Wat trekt je", body: "Kies beelden die je aantrekken. Geen vragenlijst." },
      { title: "Waar en hoeveel ruimte", body: "Plaats, tijd en budget, voor echte adressen." },
      { title: "Met wie", body: "En je harde grenzen. Dan is je venster vol." },
    ],
  },
  chapters: { images: "Wat trekt je", room: "Waar en hoeveel", who: "Met wie", extra: "Nog één ding" },
  recipientFallback: "diegene",
  recipientLabel: "Voor wie is dit venster?",
  recipientPlaceholder: "Voornaam (mag leeg blijven)",
  worlds: {
    heading: "Welke werelden trekken je?",
    headingGift: "Welke werelden zouden {name} trekken?",
    sub: "Kies er één tot vier. Of laat ons je verrassen.",
    surprise: "Verras me",
    surpriseSub: "We kiezen de werelden voor je",
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
      heading: "Welk moment wil je vaker voelen?",
      headingGift: "Welk moment gun je {name}?",
      sub: "Niet wat je gaat doen, maar hoe het voelt.",
    },
    senses: {
      kicker: "Ronde 3 van 3 · zintuigen · mag je overslaan",
      heading: "Wat wil je ruiken, voelen of horen?",
      headingGift: "Wat zou {name} willen ruiken, voelen of horen?",
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
  reflection: {
    kicker: "Je venster",
    heading: "Je venster krijgt vorm.",
    prefix: "Dit lezen we in je beelden:",
    prefixGift: "Dit lezen we in de beelden voor {name}:",
    and: "en",
    nothing: "We zien nog weinig in je beelden. Dat mag: dan verrassen we je.",
    question: "Klopt dat?",
    yes: "Klopt, verder",
    no: "Niet helemaal",
    fixPrompt: "Wat zoek je meer? Kies er tot drie.",
    fixDone: "Zo klopt het, verder",
    leanings: {
      alone: "het liefst op je eentje",
      together: "het liefst samen",
      calm: "in een rustig tempo",
      active: "met wat vaart",
      inside: "binnen",
      outside: "buiten",
    },
  },
  room: {
    heading: "Waar en hoeveel ruimte?",
    headingGift: "Waar en hoeveel ruimte heeft {name}?",
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
    heading: "Met wie?",
    headingGift: "Met wie gaat {name}?",
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
      "Gratis",
      "Rolstoeltoegankelijk",
      "Moet met de hond kunnen",
      "Geen alcohol",
      "Geen vis of schaaldieren",
      "Met kinderen",
    ],
    limitsPlaceholder: "Nog iets anders dat écht niet kan?",
  },
  extra: {
    heading: "Wat zou je stiekem vaker willen doen?",
    headingGift: "Wat zou {name} stiekem vaker willen doen?",
    sub: "Optioneel, maar dit telt zwaar mee in je boek.",
    placeholder: "Ik zou best vaker…",
    suggestions: ["Iets maken met mijn handen", "Er in mijn eentje op uit gaan", "Meer tijd in de natuur", "Iets nieuws leren"],
    skip: "Overslaan",
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
  panes: { worlds: "Werelden", places: "Plekken", moments: "Momenten", senses: "Zintuigen", surprise: "Verras me" },
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
      { title: "What draws you", body: "Pick images that pull you in. No questionnaire." },
      { title: "Where and how much room", body: "Place, time and budget, for real addresses." },
      { title: "With whom", body: "And your hard limits. Then your window is full." },
    ],
  },
  chapters: { images: "What draws you", room: "Where and how much", who: "With whom", extra: "One more thing" },
  recipientFallback: "them",
  recipientLabel: "Who is this window for?",
  recipientPlaceholder: "First name (optional)",
  worlds: {
    heading: "Which worlds draw you in?",
    headingGift: "Which worlds would draw {name} in?",
    sub: "Pick one to four. Or let us surprise you.",
    surprise: "Surprise me",
    surpriseSub: "We'll pick the worlds for you",
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
      heading: "Which moment would you like to feel more often?",
      headingGift: "Which moment would you wish for {name}?",
      sub: "Not what you'll do, but how it feels.",
    },
    senses: {
      kicker: "Round 3 of 3 · senses · feel free to skip",
      heading: "What would you like to smell, feel or hear?",
      headingGift: "What would {name} like to smell, feel or hear?",
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
  reflection: {
    kicker: "Your window",
    heading: "Your window is taking shape.",
    prefix: "Here's what we read in your images:",
    prefixGift: "Here's what we read in the images for {name}:",
    and: "and",
    nothing: "There's not much to read in your images yet. That's fine: we'll surprise you.",
    question: "Does that feel right?",
    yes: "Yes, continue",
    no: "Not quite",
    fixPrompt: "What are you after more? Pick up to three.",
    fixDone: "That's it, continue",
    leanings: {
      alone: "ideally on your own",
      together: "ideally together",
      calm: "at a calm pace",
      active: "with some speed",
      inside: "indoors",
      outside: "outdoors",
    },
  },
  room: {
    heading: "Where, and how much room?",
    headingGift: "Where, and how much room does {name} have?",
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
    heading: "With whom?",
    headingGift: "Who will {name} go with?",
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
      "Free of charge",
      "Wheelchair accessible",
      "Dog-friendly",
      "No alcohol",
      "No fish or shellfish",
      "With children",
    ],
    limitsPlaceholder: "Anything else that really can't happen?",
  },
  extra: {
    heading: "What would you secretly love to do more often?",
    headingGift: "What would {name} secretly love to do more often?",
    sub: "Optional, but it weighs heavily in your book.",
    placeholder: "I'd love to…",
    suggestions: ["Make something with my hands", "Head out on my own", "Spend more time in nature", "Learn something new"],
    skip: "Skip",
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
  panes: { worlds: "Worlds", places: "Places", moments: "Moments", senses: "Senses", surprise: "Surprise me" },
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
