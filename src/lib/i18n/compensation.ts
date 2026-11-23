// Copy for the compensation mail (Step 235): a buyer whose book had a place that was wrong gets an extra one-time discount code. nl and en.
// {amount} {date} {order} {email} are filled in by the mail builder.

export type CompensationLocale = "nl" | "en";

export interface CompensationCopy {
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

const NL: CompensationCopy = {
  subject: "Onze excuses: een extra kortingscode voor je volgende Idea Book",
  preheader: "Een plek in je boek klopte niet. Als compensatie krijg je een extra kortingscode.",
  eyebrow: "Onze excuses",
  heading: "Een plek klopte niet",
  lead: "Je liet ons weten dat een plek in je Idea Book niet klopte. Dat vinden we vervelend: plekken veranderen, maar jij hoort daar niet de dupe van te zijn. Als compensatie krijg je van ons een extra kortingscode van {amount} voor je volgende boek.",
  codeLabel: "Jouw kortingscode",
  valid: "Geldig tot {date}. Eén keer te gebruiken, voor één boek. Niet inwisselbaar voor geld.",
  button: "Een nieuw Idea Book maken",
  help: "Gebruik de code bij het bestellen. Vragen? Antwoord op deze mail of mail naar {email}.",
  orderLine: "Over je bestelling {order}",
};

const EN: CompensationCopy = {
  subject: "Our apologies: an extra discount code for your next Idea Book",
  preheader: "A place in your book was wrong. As compensation you get an extra discount code.",
  eyebrow: "Our apologies",
  heading: "A place was not right",
  lead: "You told us a place in your Idea Book was not right. We are sorry: places change, but you should not be the one to pay for that. As compensation you get an extra discount code of {amount} for your next book.",
  codeLabel: "Your discount code",
  valid: "Valid until {date}. One use, for one book. Cannot be exchanged for money.",
  button: "Make a new Idea Book",
  help: "Use the code when you order. Questions? Reply to this e-mail or write to {email}.",
  orderLine: "About your order {order}",
};

export function getCompensationCopy(locale: CompensationLocale): CompensationCopy {
  return locale === "nl" ? NL : EN;
}
