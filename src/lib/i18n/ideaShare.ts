// Copy for sharing one idea (Step 242), nl and en: the block in the idea dialog, the page a friend lands on, and the line on the picture.
// {title} is filled in by the component. The page and the picture use the language the book was written in, the block the site's language.

export type IdeaShareLocale = "nl" | "en";

export interface IdeaShareCopy {
  heading: string;
  sub: string;
  previewAlt: string;
  share: string;
  whatsapp: string;
  copyLink: string;
  copied: string;
  download: string;
  /** The message that goes with the link, so the friend knows what it is. {title} = the idea's title. */
  shareText: string;
  /** The page a friend lands on. */
  pageEyebrow: string;
  pageCtaHeading: string;
  pageCtaBody: string;
  pageCta: string;
  /** Under the title on the picture. */
  cardFooter: string;
}

const NL: IdeaShareCopy = {
  heading: "Deel dit idee",
  sub: "Een idee als kaartje, zonder de rest van je boek.",
  previewAlt: "Het kaartje van dit idee, zoals een vriend het ziet",
  share: "Deel",
  whatsapp: "Via WhatsApp",
  copyLink: "Kopieer link",
  copied: "Link gekopieerd",
  download: "Download kaartje",
  shareText: "Dit idee kreeg ik uit mijn persoonlijke Idea Book van WindowInto: {title}.",
  pageEyebrow: "Een idee uit een persoonlijk Idea Book",
  pageCtaHeading: "Wil je er zelf ook een?",
  pageCtaBody: "Je beantwoordt een paar vragen met beelden, en je krijgt een boek met ideeën die bij jou passen, met echte plekken erbij.",
  pageCta: "Maak jouw eigen Idea Book",
  cardFooter: "Uit een persoonlijk Idea Book van WindowInto",
};

const EN: IdeaShareCopy = {
  heading: "Share this idea",
  sub: "An idea as a small card, without the rest of your book.",
  previewAlt: "The card of this idea, as a friend sees it",
  share: "Share",
  whatsapp: "Via WhatsApp",
  copyLink: "Copy link",
  copied: "Link copied",
  download: "Download card",
  shareText: "I got this idea from my personal Idea Book by WindowInto: {title}.",
  pageEyebrow: "An idea from a personal Idea Book",
  pageCtaHeading: "Want one of your own?",
  pageCtaBody: "You answer a few questions with pictures, and you get a book of ideas that fit you, with real places to go.",
  pageCta: "Make your own Idea Book",
  cardFooter: "From a personal Idea Book by WindowInto",
};

export function getIdeaShareCopy(locale: IdeaShareLocale): IdeaShareCopy {
  return locale === "nl" ? NL : EN;
}
