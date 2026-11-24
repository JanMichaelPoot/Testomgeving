// Copy for the reward mail (Step 239): a friend ordered a book with a code the buyer passed on, so the buyer gets a code of their own. nl and en.
// {amount} {date} {order} {email} are filled in by the mail builder. The mail never says who the friend is.

export type RewardLocale = "nl" | "en";

export interface RewardCopy {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  lead: string;
  codeLabel: string;
  valid: string;
  button: string;
  help: string;
  orderLine: string;
}

const NL: RewardCopy = {
  subject: "Bedankt voor het delen: een kortingscode voor jou",
  preheader: "Iemand aan wie je een code gaf heeft een Idea Book besteld. Jij krijgt ook korting.",
  eyebrow: "Bedankt voor het delen",
  heading: "Een vriend heeft besteld",
  lead: "Iemand aan wie je een code gaf, heeft een eigen Idea Book besteld. Dankjewel voor het doorvertellen! Als bedankje krijg je van ons een kortingscode van {amount} voor je volgende boek.",
  codeLabel: "Jouw kortingscode",
  valid: "Geldig tot {date}. Eén keer te gebruiken, voor één boek. Niet inwisselbaar voor geld.",
  button: "Een nieuw Idea Book maken",
  help: "Gebruik de code bij het bestellen. Vragen? Antwoord op deze mail of mail naar {email}.",
  orderLine: "Over je bestelling {order}",
};

const EN: RewardCopy = {
  subject: "Thank you for sharing: a discount code for you",
  preheader: "Someone you gave a code to has ordered an Idea Book. You get a discount too.",
  eyebrow: "Thank you for sharing",
  heading: "A friend has ordered",
  lead: "Someone you gave a code to has ordered an Idea Book of their own. Thank you for spreading the word! As a thank-you you get a discount code of {amount} for your next book.",
  codeLabel: "Your discount code",
  valid: "Valid until {date}. One use, for one book. Cannot be exchanged for money.",
  button: "Make a new Idea Book",
  help: "Use the code when you order. Questions? Reply to this e-mail or write to {email}.",
  orderLine: "About your order {order}",
};

export function getRewardCopy(locale: RewardLocale): RewardCopy {
  return locale === "nl" ? NL : EN;
}
