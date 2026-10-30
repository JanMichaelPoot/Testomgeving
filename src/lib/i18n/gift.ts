// Copy for the gift voucher (improvement brief B3): the buy page, the "ready" page, the redeem pages, the redeem panel at the end of the
// intake, the e-mail and the follow-up e-mail (B5). Kept apart from dictionaries.ts (already very long). Dutch is natural je-vorm; every
// text exists in nl and en. "{price}", "{name}", "{date}" and so on are filled by the caller.
//
// The legal wording of the voucher purchase (`buy.consent*`) is new text for a new product; it has NOT been reviewed by a lawyer.
// docs/cadeaubon.md lists what to have checked before it goes live.

export type GiftLocale = "nl" | "en";

export interface GiftCopy {
  navLabel: string;
  /** The line under the landing buttons that leads to the voucher page. */
  homeLink: string;
  buy: {
    pageTitle: string;
    kicker: string;
    heading: string;
    sub: string;
    included: string[];
    priceCaption: string;
    differentTitle: string;
    differentBody: string;
    differentLink: string;
    form: {
      recipientLabel: string;
      recipientHint: string;
      giverLabel: string;
      giverHint: string;
      messageLabel: string;
      messageHint: string;
      emailLabel: string;
      emailHint: string;
    };
    consentHeading: string;
    consentBody: string;
    consentLabel: string;
    cta: string; // {price}
    ctaPending: string;
    errorTerms: string;
    errorConsent: string;
    errorEmail: string;
    errorGeneric: string;
    errorLimit: string;
  };
  done: {
    pageTitle: string;
    heading: string;
    headingFor: string; // {name}
    sub: string;
    codeLabel: string;
    validUntil: string; // {date}
    singleUse: string;
    downloadA5: string;
    downloadA6: string;
    copyLink: string;
    copied: string;
    whatsapp: string;
    whatsappText: string; // {link}
    emailed: string; // {email}
    emailPending: string;
    howHeading: string;
    howSteps: string[];
    unpaidTitle: string;
    unpaidBody: string;
    refresh: string;
    notFound: string;
  };
  redeem: {
    pageTitle: string;
    enterHeading: string;
    enterSub: string;
    enterLabel: string;
    enterPlaceholder: string;
    enterButton: string;
    headingNamed: string; // {name}
    headingAnon: string;
    fromLine: string; // {name}
    fromAnon: string;
    sub: string;
    steps: string[];
    button: string;
    buttonPending: string;
    states: { invalid: string; notFound: string; pending: string; redeemed: string; expired: string; void: string };
    problemHelp: string;
    giftNote: string;
  };
  panel: {
    heading: string;
    headingNamed: string; // {name}
    validBody: string; // {code} {giver}
    validBodyAnon: string; // {code}
    freeNote: string;
    emailLabel: string;
    emailHint: string;
    followUpLabel: string;
    followUpHint: string;
    termsLabelPrefix: string;
    termsLinkText: string;
    termsLabelSuffix: string;
    cta: string;
    ctaPending: string;
    errorTerms: string;
    errorEmail: string;
    errors: { invalid: string; redeemed: string; expired: string; void: string; pending: string; generic: string; limit: string };
  };
  email: {
    subject: string; // {name}
    subjectAnon: string;
    preheader: string;
    heading: string;
    intro: string; // {recipient}
    introAnon: string;
    codeLabel: string;
    validUntil: string; // {date}
    attachNote: string;
    linkButton: string;
    shareHeading: string;
    shareBody: string;
    orderHeading: string;
    footer: string;
  };
  followUp: {
    subject: string;
    preheader: string;
    heading: string;
    body: string;
    avoidNote: string;
    button: string;
    footer: string;
    unsubscribe: string;
  };
  unsubscribe: { title: string; body: string; invalid: string };
}

const NL: GiftCopy = {
  navLabel: "Cadeaubon",
  homeLink: "Of geef een cadeaubon: de ander kiest zelf",
  buy: {
    pageTitle: "Cadeaubon — geef een persoonlijk Idea Book cadeau",
    kicker: "Cadeaubon",
    heading: "Geef iemand een venster vol mogelijkheden",
    sub: "De ontvanger kiest zelf een paar beelden. Wij maken er een persoonlijk boek van, met echte plekken in de buurt. Jij hoeft alleen te bedenken voor wie.",
    included: [
      "Direct na betaling: een persoonlijke code, een kaart om uit te printen (PDF) en een link om te delen.",
      "Het boek zelf is voor de ontvanger gratis: de code is genoeg.",
      "Eén keer te gebruiken en 12 maanden geldig, dus zonder haast te geven.",
    ],
    priceCaption: "eenmalig, het boek zelf zit erin",
    differentTitle: "Liever zelf de beelden kiezen voor iemand?",
    differentBody: "Dat kan ook: jij vult de intake in voor de ander en het boek gaat naar diegene, voor de prijs van één boek.",
    differentLink: "Zelf invullen voor iemand",
    form: {
      recipientLabel: "Voor wie is het?",
      recipientHint: "Voornaam. Staat op de kaart. Mag leeg.",
      giverLabel: "Van wie?",
      giverHint: "Jouw naam, onder je bericht. Mag leeg.",
      messageLabel: "Een persoonlijk bericht",
      messageHint: "Staat op de kaart en op de pagina waar de ontvanger de code inwisselt. Maximaal 280 tekens.",
      emailLabel: "Naar welk e-mailadres sturen we de bon?",
      emailHint: "Optioneel. Leeg laten betekent: het adres dat je bij het betalen invult.",
    },
    consentHeading: "Dit moet je weten voor je betaalt",
    consentBody:
      "Je krijgt de cadeaubon (code, kaart en link) direct na betaling, digitaal. Het Idea Book zelf wordt pas gemaakt als de ontvanger de code inwisselt. Wil je de bon niet meer, dan kun je hem binnen 14 dagen na aankoop herroepen zolang hij nog niet is ingewisseld: mail hello@windowinto.nl en de code wordt ongeldig.",
    consentLabel:
      "Ik vraag om directe levering van de digitale cadeaubon. Ik begrijp dat ik mijn herroepingsrecht van 14 dagen verlies zodra de ontvanger de bon inwisselt en het Idea Book is geleverd.",
    cta: "Koop de cadeaubon · {price}",
    ctaPending: "Even geduld…",
    errorTerms: "Ga akkoord met de Algemene Voorwaarden om verder te gaan.",
    errorConsent: "Bevestig dat je de digitale levering wilt en wat dat voor je herroepingsrecht betekent.",
    errorEmail: "Dit e-mailadres lijkt niet te kloppen.",
    errorGeneric: "Er ging iets mis bij het starten van de betaling. Probeer het zo nog eens.",
    errorLimit: "Je testboeken zijn op. Neem contact op als je meer wilt proberen.",
  },
  done: {
    pageTitle: "Je cadeaubon staat klaar",
    heading: "Je cadeaubon staat klaar",
    headingFor: "Je cadeaubon voor {name} staat klaar",
    sub: "Geef de kaart of de link door. Wie de code invult, kiest zelf een paar beelden en krijgt een persoonlijk Idea Book.",
    codeLabel: "De code",
    validUntil: "Geldig tot {date}",
    singleUse: "Eén keer te gebruiken",
    downloadA5: "Download de kaart (A5)",
    downloadA6: "Kleiner formaat (A6)",
    copyLink: "Kopieer de link",
    copied: "Gekopieerd",
    whatsapp: "Deel via WhatsApp",
    whatsappText: "Ik heb iets voor je: een cadeaubon voor een persoonlijk Idea Book van WindowInto. Wissel hem hier in: {link}",
    emailed: "We hebben de code en de kaart ook gemaild naar {email}.",
    emailPending: "De mail met de code en de kaart is onderweg. Bewaar deze pagina voor de zekerheid.",
    howHeading: "Zo werkt het voor de ontvanger",
    howSteps: ["Open de link, of ga naar windowinto.nl/cadeau en vul de code in.", "Kies een paar beelden en geef aan hoe de dag eruitziet.", "Een paar minuten later staat het boek klaar, met echte plekken in de buurt."],
    unpaidTitle: "We hebben je betaling nog niet bevestigd",
    unpaidBody: "Heb je net betaald? Wacht even en ververs de pagina. Je code verschijnt zodra de betaling binnen is.",
    refresh: "Ververs",
    notFound: "We konden bij deze betaling geen cadeaubon vinden. Mail hello@windowinto.nl met je betaalbewijs, dan helpen we je verder.",
  },
  redeem: {
    pageTitle: "Wissel je cadeaubon in",
    enterHeading: "Heb je een cadeaubon?",
    enterSub: "Vul de code in die op de kaart staat. Hoofdletters, spaties en streepjes maken niet uit.",
    enterLabel: "Je code",
    enterPlaceholder: "WIN-XXXX-XXXX-XXXX",
    enterButton: "Controleer de code",
    headingNamed: "{name}, iemand geeft je een venster",
    headingAnon: "Iemand geeft je een venster",
    fromLine: "Van {name}",
    fromAnon: "Een cadeau voor jou",
    sub: "Je kiest een paar beelden, wij maken er een persoonlijk boek van met echte plekken in de buurt. Het kost jou niets en duurt een paar minuten.",
    steps: ["Kies een paar beelden die je aanspreken.", "Vertel waar je zoekt en hoeveel ruimte je hebt.", "Open je venster: je boek staat een paar minuten later klaar."],
    button: "Open je venster",
    buttonPending: "Even geduld…",
    states: {
      invalid: "Deze code lijkt niet te kloppen. Controleer hem op de kaart; 0, O, 1, I en L komen er niet in voor.",
      notFound: "We kennen deze code niet. Controleer hem op de kaart.",
      pending: "Deze cadeaubon is nog niet betaald, dus hij kan nog niet worden ingewisseld. Probeer het over een paar minuten nog eens.",
      redeemed: "Deze cadeaubon is al ingewisseld. Een code kan maar één keer worden gebruikt.",
      expired: "Deze cadeaubon is verlopen. Een bon is 12 maanden geldig.",
      void: "Deze cadeaubon is niet meer geldig, bijvoorbeeld omdat hij is terugbetaald.",
    },
    problemHelp: "Denk je dat dit niet klopt? Mail hello@windowinto.nl met je code.",
    giftNote: "Het boek is gratis voor jou: de giver heeft het al betaald.",
  },
  panel: {
    heading: "Je cadeaubon is geldig",
    headingNamed: "{name}, je cadeaubon is geldig",
    validBody: "Code {code}, van {giver}. Open je venster en het boek wordt gemaakt.",
    validBodyAnon: "Code {code}. Open je venster en het boek wordt gemaakt.",
    freeNote: "Het boek is gratis voor jou: de giver heeft het al betaald.",
    emailLabel: "Wil je het boek ook per e-mail?",
    emailHint: "Optioneel. Zonder e-mailadres staat je boek op de volgende pagina en kun je de PDF daar downloaden.",
    followUpLabel: "Mail me over zes weken één keer: tijd voor een nieuw venster?",
    followUpHint: "Optioneel, en alleen als je hierboven een e-mailadres invult. Eén e-mail, daarna niets meer. Je kunt je toestemming altijd intrekken via hello@windowinto.nl.",
    termsLabelPrefix: "Ik ga akkoord met de",
    termsLinkText: "Algemene Voorwaarden",
    termsLabelSuffix: "van WindowInto.",
    cta: "Open mijn venster",
    ctaPending: "Je venster wordt geopend…",
    errorTerms: "Ga akkoord met de Algemene Voorwaarden om verder te gaan.",
    errorEmail: "Dit e-mailadres lijkt niet te kloppen.",
    errors: {
      invalid: "Deze code lijkt niet te kloppen.",
      redeemed: "Deze cadeaubon is intussen al ingewisseld.",
      expired: "Deze cadeaubon is verlopen.",
      void: "Deze cadeaubon is niet meer geldig.",
      pending: "Deze cadeaubon is nog niet betaald.",
      generic: "Er ging iets mis bij het inwisselen. Je cadeaubon is niet gebruikt; probeer het zo nog eens.",
      limit: "Je testboeken zijn op. Neem contact op als je meer wilt proberen.",
    },
  },
  email: {
    subject: "Je cadeaubon voor {name} staat klaar",
    subjectAnon: "Je cadeaubon staat klaar",
    preheader: "De code, de kaart om uit te printen en een link om te delen.",
    heading: "Je cadeaubon staat klaar",
    intro: "Bedankt. Hieronder staat de code voor {recipient}. De kaart om uit te printen zit als PDF bij deze mail.",
    introAnon: "Bedankt. Hieronder staat de code. De kaart om uit te printen zit als PDF bij deze mail.",
    codeLabel: "De code",
    validUntil: "Geldig tot {date}. Eén keer te gebruiken.",
    attachNote: "De kaart (A5) zit als PDF bij deze mail. Print hem uit en geef hem cadeau, of stuur alleen de link.",
    linkButton: "De link voor de ontvanger",
    shareHeading: "Zo werkt het voor de ontvanger",
    shareBody: "Wie de link opent (of de code invult op windowinto.nl/cadeau), kiest zelf een paar beelden en krijgt een persoonlijk Idea Book met echte plekken in de buurt. Het boek is voor de ontvanger gratis.",
    orderHeading: "Je bestelling",
    footer: "Binnen 14 dagen na aankoop kun je de cadeaubon herroepen zolang hij nog niet is ingewisseld: mail hello@windowinto.nl.",
  },
  followUp: {
    subject: "Tijd voor een nieuw venster?",
    preheader: "Een nieuw boek, met andere ideeën dan de vorige keer.",
    heading: "Tijd voor een nieuw venster?",
    body: "Het is ongeveer zes weken geleden dat je je Idea Book kreeg. Misschien heb je intussen iets uitgeprobeerd, misschien juist niet. Wil je opnieuw kijken wat er mogelijk is? Je kiest nieuwe beelden en krijgt een nieuw boek.",
    avoidNote: "Ideeën die je vorige keer al kreeg, laten we dit keer weg.",
    button: "Open een nieuw venster",
    footer: "Je krijgt deze ene e-mail omdat je daar bij je bestelling toestemming voor gaf. Er volgt er geen tweede.",
    unsubscribe: "Geen e-mail meer van WindowInto",
  },
  unsubscribe: {
    title: "Afgemeld",
    body: "Gelukt: we bewaren je e-mailadres niet meer voor een herinnering en sturen je geen mail over een nieuw venster.",
    invalid: "Deze afmeldlink werkt niet (meer). Mail hello@windowinto.nl en we regelen het.",
  },
};

const EN: GiftCopy = {
  navLabel: "Gift voucher",
  homeLink: "Or give a gift voucher: they choose themselves",
  buy: {
    pageTitle: "Gift voucher — give a personal Idea Book",
    kicker: "Gift voucher",
    heading: "Give someone a window full of possibilities",
    sub: "The recipient picks a few images themselves. We turn them into a personal book with real places nearby. All you have to do is think of who it is for.",
    included: [
      "Straight after payment: a personal code, a card to print (PDF) and a link to share.",
      "The book itself is free for the recipient: the code is all they need.",
      "Single use and valid for 12 months, so there is no rush.",
    ],
    priceCaption: "one-off, the book itself is included",
    differentTitle: "Would you rather pick the images for someone yourself?",
    differentBody: "You can: you fill in the intake for them and the book goes to them, for the price of one book.",
    differentLink: "Fill it in for someone",
    form: {
      recipientLabel: "Who is it for?",
      recipientHint: "First name. It is printed on the card. Optional.",
      giverLabel: "From whom?",
      giverHint: "Your name, under your message. Optional.",
      messageLabel: "A personal message",
      messageHint: "It is printed on the card and shown on the page where the recipient redeems the code. 280 characters at most.",
      emailLabel: "Which e-mail address should we send the voucher to?",
      emailHint: "Optional. Leave it empty to use the address you enter when paying.",
    },
    consentHeading: "What you should know before you pay",
    consentBody:
      "You receive the gift voucher (code, card and link) digitally, straight after payment. The Idea Book itself is only made when the recipient redeems the code. If you no longer want the voucher, you can withdraw within 14 days of purchase as long as it has not been redeemed: e-mail hello@windowinto.nl and the code becomes invalid.",
    consentLabel:
      "I ask for the digital gift voucher to be delivered immediately. I understand that I lose my 14-day right of withdrawal once the recipient redeems the voucher and the Idea Book has been delivered.",
    cta: "Buy the gift voucher · {price}",
    ctaPending: "One moment…",
    errorTerms: "Accept the Terms and Conditions to continue.",
    errorConsent: "Confirm that you want digital delivery and what that means for your right of withdrawal.",
    errorEmail: "This e-mail address does not look right.",
    errorGeneric: "Something went wrong starting the payment. Please try again in a moment.",
    errorLimit: "Your test books are used up. Get in touch if you want to try more.",
  },
  done: {
    pageTitle: "Your gift voucher is ready",
    heading: "Your gift voucher is ready",
    headingFor: "Your gift voucher for {name} is ready",
    sub: "Hand over the card or share the link. Whoever enters the code picks a few images themselves and receives a personal Idea Book.",
    codeLabel: "The code",
    validUntil: "Valid until {date}",
    singleUse: "Single use",
    downloadA5: "Download the card (A5)",
    downloadA6: "Smaller size (A6)",
    copyLink: "Copy the link",
    copied: "Copied",
    whatsapp: "Share via WhatsApp",
    whatsappText: "I have something for you: a gift voucher for a personal WindowInto Idea Book. Redeem it here: {link}",
    emailed: "We also e-mailed the code and the card to {email}.",
    emailPending: "The e-mail with the code and the card is on its way. Keep this page to be safe.",
    howHeading: "How it works for the recipient",
    howSteps: ["Open the link, or go to windowinto.nl/cadeau and enter the code.", "Pick a few images and say what the day looks like.", "A few minutes later the book is ready, with real places nearby."],
    unpaidTitle: "We have not confirmed your payment yet",
    unpaidBody: "Did you just pay? Wait a moment and refresh the page. Your code appears as soon as the payment is in.",
    refresh: "Refresh",
    notFound: "We could not find a gift voucher for this payment. E-mail hello@windowinto.nl with your proof of payment and we will help.",
  },
  redeem: {
    pageTitle: "Redeem your gift voucher",
    enterHeading: "Do you have a gift voucher?",
    enterSub: "Enter the code printed on the card. Capitals, spaces and dashes do not matter.",
    enterLabel: "Your code",
    enterPlaceholder: "WIN-XXXX-XXXX-XXXX",
    enterButton: "Check the code",
    headingNamed: "{name}, someone is giving you a window",
    headingAnon: "Someone is giving you a window",
    fromLine: "From {name}",
    fromAnon: "A gift for you",
    sub: "You pick a few images and we turn them into a personal book with real places nearby. It costs you nothing and takes a few minutes.",
    steps: ["Pick a few images that appeal to you.", "Tell us where to look and how much room you have.", "Open your window: your book is ready a few minutes later."],
    button: "Open your window",
    buttonPending: "One moment…",
    states: {
      invalid: "This code does not look right. Check it against the card; 0, O, 1, I and L are never used.",
      notFound: "We do not know this code. Check it against the card.",
      pending: "This gift voucher has not been paid yet, so it cannot be redeemed. Please try again in a few minutes.",
      redeemed: "This gift voucher has already been redeemed. A code can only be used once.",
      expired: "This gift voucher has expired. A voucher is valid for 12 months.",
      void: "This gift voucher is no longer valid, for instance because it was refunded.",
    },
    problemHelp: "Think this is wrong? E-mail hello@windowinto.nl with your code.",
    giftNote: "The book is free for you: the giver has already paid for it.",
  },
  panel: {
    heading: "Your gift voucher is valid",
    headingNamed: "{name}, your gift voucher is valid",
    validBody: "Code {code}, from {giver}. Open your window and the book is made.",
    validBodyAnon: "Code {code}. Open your window and the book is made.",
    freeNote: "The book is free for you: the giver has already paid for it.",
    emailLabel: "Would you like the book by e-mail too?",
    emailHint: "Optional. Without an address your book appears on the next page and you can download the PDF there.",
    followUpLabel: "E-mail me once in six weeks: time for a new window?",
    followUpHint: "Optional, and only if you enter an e-mail address above. One e-mail, nothing after that. You can withdraw your consent at any time via hello@windowinto.nl.",
    termsLabelPrefix: "I agree to WindowInto's",
    termsLinkText: "Terms and Conditions",
    termsLabelSuffix: "",
    cta: "Open my window",
    ctaPending: "Opening your window…",
    errorTerms: "Accept the Terms and Conditions to continue.",
    errorEmail: "This e-mail address does not look right.",
    errors: {
      invalid: "This code does not look right.",
      redeemed: "This gift voucher has meanwhile been redeemed.",
      expired: "This gift voucher has expired.",
      void: "This gift voucher is no longer valid.",
      pending: "This gift voucher has not been paid yet.",
      generic: "Something went wrong redeeming it. Your voucher has not been used; please try again in a moment.",
      limit: "Your test books are used up. Get in touch if you want to try more.",
    },
  },
  email: {
    subject: "Your gift voucher for {name} is ready",
    subjectAnon: "Your gift voucher is ready",
    preheader: "The code, the card to print and a link to share.",
    heading: "Your gift voucher is ready",
    intro: "Thank you. Below is the code for {recipient}. The card to print is attached to this e-mail as a PDF.",
    introAnon: "Thank you. Below is the code. The card to print is attached to this e-mail as a PDF.",
    codeLabel: "The code",
    validUntil: "Valid until {date}. Single use.",
    attachNote: "The card (A5) is attached as a PDF. Print it and give it as a gift, or just send the link.",
    linkButton: "The link for the recipient",
    shareHeading: "How it works for the recipient",
    shareBody: "Whoever opens the link (or enters the code at windowinto.nl/cadeau) picks a few images and receives a personal Idea Book with real places nearby. The book is free for the recipient.",
    orderHeading: "Your order",
    footer: "You can withdraw from the gift voucher within 14 days of purchase as long as it has not been redeemed: e-mail hello@windowinto.nl.",
  },
  followUp: {
    subject: "Time for a new window?",
    preheader: "A new book, with different ideas from last time.",
    heading: "Time for a new window?",
    body: "It is about six weeks since you received your Idea Book. Perhaps you tried something since, perhaps not. Would you like to see what is possible now? You pick new images and get a new book.",
    avoidNote: "We leave out the ideas you already received last time.",
    button: "Open a new window",
    footer: "You get this one e-mail because you agreed to it when you ordered. There will not be a second.",
    unsubscribe: "No more e-mail from WindowInto",
  },
  unsubscribe: {
    title: "Unsubscribed",
    body: "Done: we no longer keep your e-mail address for a reminder and will not e-mail you about a new window.",
    invalid: "This unsubscribe link does not work (any more). E-mail hello@windowinto.nl and we will sort it out.",
  },
};

export function getGiftCopy(locale: GiftLocale): GiftCopy {
  return locale === "nl" ? NL : EN;
}

export const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m);
