// Copy for the check-in a week after a book (Step 243), nl and en: the mail, the page behind its three buttons, and the opt-out page.
// {title} {amount} {date} {n} are filled in by the callers. The tone is the site's: warm, curious, a little playful, never a survey voice.
// Never promises a reward for answering; nothing here is a sales message.

export type CheckinLocale = "nl" | "en";

export interface CheckinCopy {
  mail: {
    subject: string;
    preheader: string;
    eyebrow: string;
    heading: string;
    /** With the idea the buyer chose ("Dit ga ik doen"). {title} */
    leadChosen: string;
    /** Without one. */
    lead: string;
    note: string;
    done: string;
    planned: string;
    not: string;
    footer: string;
    optout: string;
  };
  page: {
    title: string;
    invalid: string;
    /** Under the heading: what the three answers are, so a buyer who lands here can change theirs. */
    switchLabel: string;
    done: string;
    planned: string;
    not: string;
    doneHeading: string;
    doneAsk: string;
    donePlaceholder: string;
    consent: string;
    plannedHeading: string;
    plannedBody: string;
    notHeading: string;
    notAsk: string;
    notPlaceholder: string;
    notNote: string;
    send: string;
    sending: string;
    thanks: string;
    error: string;
    toBook: string;
  };
  optout: { title: string; body: string; invalid: string };
}

const NL: CheckinCopy = {
  mail: {
    subject: "Heb je al iets gedaan met je Idea Book?",
    preheader: "Eén klik is genoeg. Er is geen goed of fout antwoord.",
    eyebrow: "Een week later",
    heading: "Heb je er al iets mee gedaan?",
    leadChosen: "Een week geleden kreeg je je Idea Book. Je koos “{title}”. Ben je er al aan begonnen, of in elk geval iets in beweging gekomen?",
    lead: "Een week geleden kreeg je je Idea Book. Heb je er al iets uit gedaan, hoe klein ook?",
    note: "Eén klik is genoeg. Er is geen goed of fout antwoord, en we gebruiken het om het boek beter te maken.",
    done: "Ja, ik ben ermee aan de slag",
    planned: "Nog niet, maar het staat op mijn lijst",
    not: "Nee, het is er niet van gekomen",
    footer: "Je krijgt deze mail eenmalig, omdat je een Idea Book hebt besteld bij WindowInto.",
    optout: "Liever geen mails van dit soort meer",
  },
  page: {
    title: "Hoe ging het?",
    invalid: "Deze link klopt niet meer. Open de knop in de mail nog eens, of schrijf ons.",
    switchLabel: "Jouw antwoord",
    done: "Ja, ik ben ermee aan de slag",
    planned: "Nog niet, maar het staat op mijn lijst",
    not: "Nee, het is er niet van gekomen",
    doneHeading: "Wat fijn om te horen.",
    doneAsk: "Wat heb je gedaan? Eén zin is genoeg. (mag leeg)",
    donePlaceholder: "Bijvoorbeeld: ik heb zaterdag mijn eerste les gehad.",
    consent: "Jullie mogen mijn woorden anoniem op de site gebruiken.",
    plannedHeading: "Mooi, dat is al een begin.",
    plannedBody: "Een idee gaat makkelijker als je het aan een dag koppelt. Open je boek en kies het ene idee waar je mee begint.",
    notHeading: "Dat kan gebeuren, bedankt voor je eerlijkheid.",
    notAsk: "Wat hield je tegen? Eén zin is genoeg. (mag leeg)",
    notPlaceholder: "Bijvoorbeeld: te ver weg, of geen tijd.",
    notNote: "Dit lezen wij zelf, en we gebruiken het om het boek beter te maken.",
    send: "Verstuur",
    sending: "Even opslaan…",
    thanks: "Dankjewel, dit helpt echt.",
    error: "Opslaan lukte niet. Probeer het zo nog eens.",
    toBook: "Terug naar je boek",
  },
  optout: {
    title: "Je krijgt dit soort mails niet meer",
    body: "We sturen je geen terugkoppelmails meer, ook niet bij een volgend boek. Mails over een bestelling blijf je gewoon krijgen.",
    invalid: "Deze link klopt niet. Schrijf ons als je geen mails meer wilt.",
  },
};

const EN: CheckinCopy = {
  mail: {
    subject: "Have you done anything with your Idea Book yet?",
    preheader: "One click is enough. There is no right or wrong answer.",
    eyebrow: "A week later",
    heading: "Have you done anything with it yet?",
    leadChosen: "A week ago you got your Idea Book. You chose “{title}”. Have you started, or at least got something moving?",
    lead: "A week ago you got your Idea Book. Have you done anything from it yet, however small?",
    note: "One click is enough. There is no right or wrong answer, and we use it to make the book better.",
    done: "Yes, I'm on it",
    planned: "Not yet, but it's on my list",
    not: "No, it didn't happen",
    footer: "You get this one e-mail because you ordered an Idea Book from WindowInto.",
    optout: "I would rather not get mails like this",
  },
  page: {
    title: "How did it go?",
    invalid: "This link is no longer valid. Press the button in the e-mail again, or write to us.",
    switchLabel: "Your answer",
    done: "Yes, I'm on it",
    planned: "Not yet, but it's on my list",
    not: "No, it didn't happen",
    doneHeading: "Lovely to hear.",
    doneAsk: "What did you do? One sentence is enough. (optional)",
    donePlaceholder: "For example: I had my first lesson on Saturday.",
    consent: "You may use my words on the site, anonymously.",
    plannedHeading: "Good, that is already a start.",
    plannedBody: "An idea gets easier when you tie it to a day. Open your book and pick the one idea you will begin with.",
    notHeading: "That happens, thank you for being honest.",
    notAsk: "What held you back? One sentence is enough. (optional)",
    notPlaceholder: "For example: too far away, or no time.",
    notNote: "We read this ourselves, and use it to make the book better.",
    send: "Send",
    sending: "Saving…",
    thanks: "Thank you, this really helps.",
    error: "Saving did not work. Please try again in a moment.",
    toBook: "Back to your book",
  },
  optout: {
    title: "You will not get mails like this any more",
    body: "We will not send you check-in mails again, also not for a next book. Mails about an order you keep getting.",
    invalid: "This link is not valid. Write to us if you do not want any more mail.",
  },
};

export function getCheckinCopy(locale: CheckinLocale): CheckinCopy {
  return locale === "nl" ? NL : EN;
}
