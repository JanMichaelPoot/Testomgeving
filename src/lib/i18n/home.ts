// Copy for the positioning, trust and proof parts of the site (Fase 2 of the A-D brief): the four differentiators, the sample book section,
// the trust block, the FAQ and the "Wat zit erin" page. Kept apart from dictionaries.ts (already very long); components get what they need
// as props. Dutch is natural je-vorm; every text exists in nl and en. "{price}" is filled by the caller.
//
// Honesty rule: only claim what the pipeline does today. It looks places up on the web, drops a place it cannot place, checks that a
// website exists and reads its page (src/lib/claude/localResearch.ts, verifyUrls.ts); it does not verify opening hours or addresses
// against a structured source yet (Fase 3). So the copy says "we look places up and check that their website exists", not "verified".

import { doorRange, doorsSummary } from "@/lib/productStructure";

export type HomeLocale = "nl" | "en";

export const CONTACT_EMAIL = "hello@windowinto.nl";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  /** An optional link shown under the answer. */
  link?: { href: string; label: string };
}

export interface HomeCopy {
  differentiators: { heading: string; sub: string; items: { title: string; body: string }[] };
  sample: {
    heading: string;
    sub: string;
    freeNote: string;
    pdfLink: string;
    open: string;
    close: string;
    previous: string;
    next: string;
    counter: string; // {n} {total}
    spreads: { name: string; alt: string }[]; // cover, idea-1, idea-2
  };
  trust: {
    aiLine: string;
    guaranteeTitle: string;
    guaranteeBody: string;
    noReviews: string;
    testimonialsHeading: string;
    founderHeading: string;
  };
  faq: { heading: string; sub: string; items: FaqItem[]; all: string };
  inside: {
    title: string;
    metaDescription: string;
    intro: string;
    doorsHeading: string;
    doorsIntro: string;
    perIdeaHeading: string;
    perIdea: { title: string; body: string }[];
    besidesHeading: string;
    besides: { title: string; body: string }[];
    cta: string;
    faqHeading: string;
  };
}

const NL: HomeCopy = {
  differentiators: {
    heading: "Wat WINDOW anders maakt",
    sub: "Geen vragenlijst en geen lijstje van de eerste Google-resultaten.",
    items: [
      { title: "Beelden in plaats van een vragenlijst", body: "Je kiest wat je aantrekt en wij lezen daar je smaak uit. Klaar in ±3 minuten." },
      {
        title: "Echte plekken bij jou in de buurt",
        body: "We zoeken ze op het web en controleren of hun website bestaat. Vinden we bij een idee geen plek, dan zeggen we dat.",
      },
      { title: "Een boek om te bewaren", body: "Een vormgegeven PDF om uit te printen of te delen, ook meteen in je mail." },
      { title: "Eén wildcard", body: "Naast zes ideeën een zevende die we eigenlijk niet zouden voorstellen. Maar toch doen." },
    ],
  },
  sample: {
    heading: "Zo ziet een boek eruit",
    sub: "Drie pagina's uit een voorbeeldboek. Klik op een pagina om hem te vergroten.",
    freeNote: "Je venster en je profielportret zijn gratis. Je betaalt pas voor de uitwerking: het boek.",
    pdfLink: "Bekijk het hele voorbeeld (PDF)",
    open: "Vergroot",
    close: "Sluiten",
    previous: "Vorige pagina",
    next: "Volgende pagina",
    counter: "Pagina {n} van {total}",
    spreads: [
      { name: "Omslag", alt: "Omslag van een voorbeeldboek: een houten bureau bij een raam met een kompas en een opengeslagen dagboek" },
      { name: "Je profiel", alt: "De profielpagina uit het voorbeeldboek: je profiel in een zin, je grenzen en voorkeuren, en de vier deuren met het idee dat het best past" },
      { name: "Een idee", alt: "Een ideepagina uit het voorbeeldboek: waarom het bij je past, tijd, niveau, een mogelijke invulling, stappen, kosten en een eerste stap" },
      { name: "Nog een idee", alt: "Een tweede ideepagina uit het voorbeeldboek, met dezelfde opbouw: waarom, stappen, kosten en een eerste stap" },
    ],
  },
  trust: {
    aiLine: "Gemaakt met AI. De plekken zoeken we op het web en we controleren of hun website bestaat.",
    guaranteeTitle: "Klopt een plek niet?",
    guaranteeBody: `Je krijgt gratis een nieuw boek. Mail naar ${CONTACT_EMAIL}.`,
    noReviews: "We zijn net begonnen, dus nog geen reviews. Liever zelf oordelen? Bekijk hierboven een voorbeeld.",
    testimonialsHeading: "Wat anderen zeggen",
    founderHeading: "Waarom ik dit maak",
  },
  faq: {
    heading: "Veelgestelde vragen",
    sub: "Kort antwoord op wat mensen vooraf willen weten.",
    all: "Alles over wat er in je boek zit",
    items: [
      {
        id: "wat-krijg-ik",
        question: "Wat krijg ik precies?",
        answer: `Een persoonlijk Idea Book met zes ideeën en één wildcard, verdeeld over de deuren ${doorRange("nl")}. Bij elk idee lees je waarom het bij je past, drie manieren om te beginnen (proeven, doen, doorpakken), plekken bij jou in de buurt en een eerste stap. Je krijgt het online, als PDF en in je mail.`,
        link: { href: "/wat-zit-erin", label: "Bekijk wat er in zit" },
      },
      {
        id: "hoe-lang",
        question: "Hoe lang duurt het?",
        answer: "Invullen kost ±3 minuten. Na je betaling stellen we je boek samen; dat duurt meestal één tot twee minuten en je ziet op het scherm hoe ver we zijn.",
      },
      {
        id: "plek-klopt-niet",
        question: "Wat als een plek niet klopt?",
        answer: `Plekken veranderen: iets kan gesloten of verhuisd zijn. Klopt er iets niet? Mail naar ${CONTACT_EMAIL} en je krijgt gratis een nieuw boek.`,
      },
      {
        id: "privacy",
        question: "Wat gebeurt er met mijn gegevens?",
        answer:
          "Je antwoorden horen bij een willekeurig sessienummer, niet bij je e-mailadres. Je e-mailadres bewaren we pas na je betaling, om je boek te sturen. Betaalgegevens gaan rechtstreeks naar Stripe; die zien wij nooit. Analytics gebruiken we alleen met jouw toestemming.",
        link: { href: "/privacy", label: "Lees de privacyverklaring" },
      },
      {
        id: "cadeau",
        question: "Kan ik dit cadeau geven?",
        answer:
          "Ja. Kies 'Geef een venster cadeau', vul de keuzes in voor de ontvanger (een voornaam is optioneel) en laat het boek naar het e-mailadres van de ontvanger sturen. Dit past goed bij iemand die aan een nieuwe fase begint, zoals pensioen of een verhuizing.",
      },
      {
        id: "betalen",
        question: "Hoe betaal ik, en wat kost het?",
        answer: "Eenmalig {price} (inclusief btw), via Stripe: met iDEAL of een kaart. Je venster en je profielportret zijn gratis; je betaalt pas als je je boek wilt.",
      },
    ],
  },
  inside: {
    title: "Wat zit er in je Idea Book?",
    metaDescription: "Zes ideeën en één wildcard, met waarom ze bij je passen, drie manieren om te beginnen, plekken bij jou in de buurt en een eerste stap.",
    intro: "Een persoonlijk boek met zes ideeën en één wildcard, gemaakt uit de beelden die jij koos. Dit zit erin.",
    doorsHeading: "Zeven ideeën, vijf deuren",
    doorsIntro: `Elk idee zit achter een deur: hoe verder de deur, hoe verder van je comfortzone (${doorsSummary("nl")}).`,
    perIdeaHeading: "Bij elk idee",
    perIdea: [
      { title: "Waarom het bij je past", body: "Een uitleg die teruggrijpt op wat jij koos, geen algemeen advies." },
      { title: "Drie manieren om te beginnen", body: "Proeven (een uurtje), doen (een halve dag) of doorpakken (een weekend of cursus), elk met kosten en duur." },
      { title: "Plekken bij jou in de buurt", body: "Wat we online vonden, met een kaartlink. Vinden we niets, dan staat dat er eerlijk bij." },
      { title: "Een eerste stap", body: "Iets wat je vandaag nog kunt doen, zo concreet mogelijk." },
    ],
    besidesHeading: "Naast de ideeën",
    besides: [
      { title: "Je venster", body: "Je keuzes vormen een venster dat je als afbeelding kunt bewaren. Gratis." },
      { title: "Je profielportret", body: "Een korte tekst over hoe we jouw keuzes lezen, vóór je betaalt. Gratis." },
      { title: "PDF en mail", body: "Het hele boek als PDF, online te lezen en in je mail. Eenmalig {price}, inclusief btw." },
    ],
    cta: "Open je venster",
    faqHeading: "Veelgestelde vragen",
  },
};

const EN: HomeCopy = {
  differentiators: {
    heading: "What makes WINDOW different",
    sub: "No questionnaire and no list of the first Google results.",
    items: [
      { title: "Images instead of a questionnaire", body: "You pick what draws you in and we read your taste from it. Ready in about 3 minutes." },
      {
        title: "Real places near you",
        body: "We look them up on the web and check that their website exists. If we find no place for an idea, we say so.",
      },
      { title: "A book to keep", body: "A designed PDF to print or share, also in your inbox right away." },
      { title: "One wildcard", body: "Besides six ideas, a seventh we probably shouldn't suggest. But do anyway." },
    ],
  },
  sample: {
    heading: "What a book looks like",
    sub: "Three pages from a sample book. Click a page to enlarge it.",
    freeNote: "Your window and your profile portrait are free. You only pay for the write-up: the book.",
    pdfLink: "See the whole sample (PDF)",
    open: "Enlarge",
    close: "Close",
    previous: "Previous page",
    next: "Next page",
    counter: "Page {n} of {total}",
    spreads: [
      { name: "Cover", alt: "Cover of a sample book: a wooden desk by a window with a compass and an open journal" },
      { name: "Your profile", alt: "The profile page from the sample book: your profile in one sentence, your limits and preferences, and the four doors with the idea that fits best" },
      { name: "An idea", alt: "An idea page from the sample book: why it fits you, time, level, a possible plan, steps, cost and a first step" },
      { name: "Another idea", alt: "A second idea page from the sample book, with the same layout: why, steps, cost and a first step" },
    ],
  },
  trust: {
    aiLine: "Made with AI. We look places up on the web and check that their website exists.",
    guaranteeTitle: "Is a place wrong?",
    guaranteeBody: `You get a new book for free. Email ${CONTACT_EMAIL}.`,
    noReviews: "We've only just started, so no reviews yet. Rather judge for yourself? See a sample above.",
    testimonialsHeading: "What others say",
    founderHeading: "Why I make this",
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "Short answers to what people want to know beforehand.",
    all: "Everything about what is in your book",
    items: [
      {
        id: "wat-krijg-ik",
        question: "What exactly do I get?",
        answer: `A personal Idea Book with six ideas and one wildcard, spread over the doors ${doorRange("en")}. For each idea you read why it fits you, three ways to start (taste, do, go deeper), places near you and a first step. You get it online, as a PDF and in your inbox.`,
        link: { href: "/wat-zit-erin", label: "See what is inside" },
      },
      {
        id: "hoe-lang",
        question: "How long does it take?",
        answer: "Filling it in takes about 3 minutes. After you pay we put your book together; that usually takes one to two minutes and you see on screen how far along we are.",
      },
      {
        id: "plek-klopt-niet",
        question: "What if a place is wrong?",
        answer: `Places change: something may have closed or moved. Something not right? Email ${CONTACT_EMAIL} and you get a new book for free.`,
      },
      {
        id: "privacy",
        question: "What happens to my data?",
        answer:
          "Your answers belong to a random session number, not to your e-mail address. We only keep your e-mail address after you pay, to send your book. Payment details go straight to Stripe; we never see them. We only use analytics with your consent.",
        link: { href: "/privacy", label: "Read the privacy statement" },
      },
      {
        id: "cadeau",
        question: "Can I give this as a gift?",
        answer:
          "Yes. Choose 'Give a window as a gift', fill in the choices for the recipient (a first name is optional) and have the book sent to the recipient's e-mail address. It suits someone starting a new phase, such as retirement or a move.",
      },
      {
        id: "betalen",
        question: "How do I pay, and what does it cost?",
        answer: "A one-time {price} (VAT included), through Stripe: with iDEAL or a card. Your window and your profile portrait are free; you only pay when you want your book.",
      },
    ],
  },
  inside: {
    title: "What is in your Idea Book?",
    metaDescription: "Six ideas and one wildcard, with why they fit you, three ways to start, places near you and a first step.",
    intro: "A personal book with six ideas and one wildcard, made from the images you picked. This is what is inside.",
    doorsHeading: "Seven ideas, five doors",
    doorsIntro: `Every idea sits behind a door: the further the door, the further from your comfort zone (${doorsSummary("en")}).`,
    perIdeaHeading: "With every idea",
    perIdea: [
      { title: "Why it fits you", body: "An explanation that points back to what you picked, not general advice." },
      { title: "Three ways to start", body: "Taste (an hour), do (half a day) or go deeper (a weekend or course), each with cost and duration." },
      { title: "Places near you", body: "What we found online, with a map link. If we find nothing, it says so honestly." },
      { title: "A first step", body: "Something you can do today, as concrete as possible." },
    ],
    besidesHeading: "Besides the ideas",
    besides: [
      { title: "Your window", body: "Your choices form a window you can save as an image. Free." },
      { title: "Your profile portrait", body: "A short text on how we read your choices, before you pay. Free." },
      { title: "PDF and e-mail", body: "The whole book as a PDF, readable online and in your inbox. A one-time {price}, VAT included." },
    ],
    cta: "Open your window",
    faqHeading: "Frequently asked questions",
  },
};

export function getHomeCopy(locale: HomeLocale): HomeCopy {
  return locale === "nl" ? NL : EN;
}

export const withPrice = (text: string, price: string) => text.replaceAll("{price}", price);

// --- Founder note (D3): hidden until Jan fills it in. Name and sentence are required; the photo is optional (a public path).
export interface FounderNoteData {
  name: string;
  /** Public path of a photo, e.g. "/founder/jan.jpg"; empty = no photo. */
  photo: string;
  sentence: Record<HomeLocale, string>;
}

export const FOUNDER_NOTE: FounderNoteData = { name: "", photo: "", sentence: { nl: "", en: "" } };

export function founderNoteFor(locale: HomeLocale, note: FounderNoteData = FOUNDER_NOTE): { name: string; photo: string; sentence: string } | null {
  const sentence = note.sentence[locale]?.trim() || note.sentence.nl.trim();
  if (!note.name.trim() || !sentence) return null;
  return { name: note.name.trim(), photo: note.photo.trim(), sentence };
}

// --- Testimonials: fed by consented quotes in Fase 5; an empty list renders nothing.
export interface Testimonial {
  quote: string;
  /** First name or initials only, as the person agreed. */
  attribution: string;
}

export const TESTIMONIALS: Testimonial[] = [];
