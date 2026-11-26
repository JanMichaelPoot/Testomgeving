import type { Locale } from "@/lib/locale";

// The page around the PDF (/plan/boek) and its fallback when something is wrong (fix round "plan links").
const nl = {
  pageTitle: "Je Idea Book als PDF — WindowInto",
  heading: "Je Idea Book als PDF",
  back: "Terug naar je Idea Book",
  download: "Download PDF",
  open: "Open de PDF",
  phoneNote: "Op een telefoon opent de PDF in de lezer van je toestel. Met de terugknop kom je weer hier.",
  frameTitle: "Je Idea Book (PDF)",
  problemHeading: "De PDF kon niet worden geopend",
  problemBody: "Er ging iets mis met deze link. Je Idea Book is niet weg. Maak de link opnieuw, of ga terug naar je Idea Book.",
  noBookBody: "Met deze link vinden we geen Idea Book. Gebruik de link uit je bevestigingsmail. Je PDF zit ook als bijlage bij die mail.",
  renew: "Maak de link opnieuw",
  help: "Lukt het niet? Mail ons op {email}, dan helpen we je.",
};

const en: typeof nl = {
  pageTitle: "Your Idea Book as a PDF — WindowInto",
  heading: "Your Idea Book as a PDF",
  back: "Back to my Idea Book",
  download: "Download PDF",
  open: "Open the PDF",
  phoneNote: "On a phone the PDF opens in your device's reader. The back button brings you here again.",
  frameTitle: "Your Idea Book (PDF)",
  problemHeading: "The PDF could not be opened",
  problemBody: "Something went wrong with this link. Your Idea Book is not lost. Make the link again, or go back to your Idea Book.",
  noBookBody: "We can't find an Idea Book with this link. Use the link from your confirmation e-mail. Your PDF is attached to that e-mail too.",
  renew: "Regenerate link",
  help: "Still not working? E-mail us at {email} and we'll help.",
};

export type PlanViewerCopy = typeof nl;
export const getPlanViewerCopy = (locale: Locale): PlanViewerCopy => (locale === "en" ? en : nl);
