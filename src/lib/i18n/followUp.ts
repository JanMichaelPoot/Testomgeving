// Copy for the one follow-up e-mail (improvement brief B5, "Tijd voor een nieuw venster?") and the unsubscribe page behind its link.
// Every text exists in nl and en.

export type FollowUpLocale = "nl" | "en";

export interface FollowUpCopy {
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

const NL: FollowUpCopy = {
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

const EN: FollowUpCopy = {
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

export function getFollowUpCopy(locale: FollowUpLocale): FollowUpCopy {
  return locale === "nl" ? NL : EN;
}
