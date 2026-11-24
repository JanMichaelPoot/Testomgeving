// Copy for the rating block at the bottom of the book (Step 241), nl and en. {amount} {date} {n} are filled in by the component.
// Tone: warm, short, a little playful; never pushy. The low-score path asks a question and does not sell anything.

export type BookFeedbackLocale = "nl" | "en";

export interface BookFeedbackCopy {
  heading: string;
  scaleLow: string;
  scaleHigh: string;
  /** "{n} van 5": the accessible name of a score button. */
  scoreAria: string;
  highLead: string;
  friendLead: string;
  friendRow: string;
  friendSend: string;
  friendReward: string;
  friendValid: string;
  friendMessage: string;
  shareLead: string;
  quoteLabel: string;
  quotePlaceholder: string;
  consentLabel: string;
  lowLead: string;
  lowPlaceholder: string;
  lowNote: string;
  send: string;
  sending: string;
  thanks: string;
  thanksLow: string;
  error: string;
}

const NL: BookFeedbackCopy = {
  heading: "Hoe waardevol was dit boek voor je?",
  scaleLow: "Niet echt",
  scaleHigh: "Heel waardevol",
  scoreAria: "{n} van 5",
  highLead: "Fijn om te horen.",
  friendLead: "Ken je iemand die dit ook leuk zou vinden? Stuur een code door: die persoon krijgt {amount} korting op een eigen Idea Book.",
  friendRow: "Voor vriend {n}",
  friendSend: "Stuur via WhatsApp",
  friendReward: "En zodra een vriend heeft besteld, krijg jij zelf ook {amount} korting voor een volgend boek.",
  friendValid: "Elke code is één keer te gebruiken, door één vriend, tot {date}.",
  friendMessage: "Ik liet bij WindowInto een persoonlijk Idea Book maken: ideeën voor wat ik echt leuk vind, met echte plekken erbij. Ik vond het mooi, dus hier is {amount} korting voor jou:",
  shareLead: "Ken je iemand die dit ook leuk zou vinden? Laat het hem of haar zien.",
  quoteLabel: "Wil je in één zin zeggen wat het je opleverde? (mag leeg)",
  quotePlaceholder: "Bijvoorbeeld: ik ga dit weekend…",
  consentLabel: "Jullie mogen mijn woorden anoniem op de site gebruiken.",
  lowLead: "Dank voor je eerlijkheid. Wat miste je, of wat kon beter?",
  lowPlaceholder: "Eén zin is genoeg.",
  lowNote: "Dit lezen wij zelf, en we gebruiken het om het boek beter te maken.",
  send: "Verstuur",
  sending: "Even opslaan…",
  thanks: "Dankjewel, dit helpt echt.",
  thanksLow: "Dankjewel. We lezen het en gaan ermee aan de slag.",
  error: "Opslaan lukte niet. Probeer het zo nog eens.",
};

const EN: BookFeedbackCopy = {
  heading: "How valuable was this book to you?",
  scaleLow: "Not really",
  scaleHigh: "Very valuable",
  scoreAria: "{n} out of 5",
  highLead: "Lovely to hear.",
  friendLead: "Know someone who would enjoy this too? Send a code on: that person gets {amount} off an Idea Book of their own.",
  friendRow: "For friend {n}",
  friendSend: "Send on WhatsApp",
  friendReward: "And once a friend has ordered, you get {amount} off a next book yourself.",
  friendValid: "Each code can be used once, by one friend, until {date}.",
  friendMessage: "I had a personal Idea Book made at WindowInto: ideas for what I really enjoy, with real places to go. I loved it, so here is {amount} off for you:",
  shareLead: "Know someone who would enjoy this too? Show them.",
  quoteLabel: "Want to say in one sentence what it gave you? (optional)",
  quotePlaceholder: "For example: this weekend I'm going to…",
  consentLabel: "You may use my words on the site, anonymously.",
  lowLead: "Thank you for being honest. What did you miss, or what could be better?",
  lowPlaceholder: "One sentence is enough.",
  lowNote: "We read this ourselves, and use it to make the book better.",
  send: "Send",
  sending: "Saving…",
  thanks: "Thank you, this really helps.",
  thanksLow: "Thank you. We will read it and work on it.",
  error: "Saving did not work. Please try again in a moment.",
};

export function getBookFeedbackCopy(locale: BookFeedbackLocale): BookFeedbackCopy {
  return locale === "nl" ? NL : EN;
}
