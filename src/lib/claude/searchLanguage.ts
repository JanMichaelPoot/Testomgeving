// The language a place abroad is searched in (Jan, 16 Nov 2026: the book for Wernigerode in Germany found hardly any concrete place). The research prompt
// already said "search in the local language", but its example queries ("<activity> proefles <place>", "beoordelingen") and every activity's search terms
// ("Search terms to try (Dutch)") were Dutch, so a search for a German town was steered back towards Dutch words that no German site uses. For the countries
// people most often search in, this gives the words a local would type; for any other country the prompt says "the local language" and nothing more.

export interface SearchLanguage {
  /** How the language is named in the prompt ("German"; "Dutch (Flanders) or French (Wallonia and Brussels)"). */
  name: string;
  /** The words of a local search: a trial lesson, a course, a club or association, reviews, and "near me". */
  words: { trial: string; course: string; club: string; reviews: string; near: string };
}

const LANGUAGES: Record<string, SearchLanguage> = {
  DE: { name: "German", words: { trial: "Probestunde", course: "Kurs", club: "Verein", reviews: "Bewertungen", near: "in der Nähe" } },
  AT: { name: "German", words: { trial: "Probestunde", course: "Kurs", club: "Verein", reviews: "Bewertungen", near: "in der Nähe" } },
  CH: { name: "German (French or Italian in the French- and Italian-speaking regions)", words: { trial: "Probelektion", course: "Kurs", club: "Verein", reviews: "Bewertungen", near: "in der Nähe" } },
  BE: { name: "Dutch (Flanders) or French (Wallonia and Brussels)", words: { trial: "proefles / cours d'essai", course: "cursus / cours", club: "club / vereniging", reviews: "beoordelingen / avis", near: "in de buurt / près de" } },
  LU: { name: "French or German", words: { trial: "cours d'essai / Probestunde", course: "cours / Kurs", club: "club / Verein", reviews: "avis / Bewertungen", near: "près de" } },
  FR: { name: "French", words: { trial: "cours d'essai", course: "cours", club: "club ou association", reviews: "avis", near: "près de" } },
  ES: { name: "Spanish", words: { trial: "clase de prueba", course: "curso", club: "club o asociación", reviews: "opiniones", near: "cerca de" } },
  IT: { name: "Italian", words: { trial: "lezione di prova", course: "corso", club: "associazione", reviews: "recensioni", near: "vicino a" } },
  PT: { name: "Portuguese", words: { trial: "aula experimental", course: "curso", club: "clube ou associação", reviews: "avaliações", near: "perto de" } },
  GB: { name: "English", words: { trial: "trial class", course: "course", club: "club", reviews: "reviews", near: "near me" } },
  IE: { name: "English", words: { trial: "trial class", course: "course", club: "club", reviews: "reviews", near: "near me" } },
  US: { name: "English", words: { trial: "trial class", course: "class", club: "club", reviews: "reviews", near: "near me" } },
  CA: { name: "English (French in Quebec)", words: { trial: "trial class", course: "class", club: "club", reviews: "reviews", near: "near me" } },
  AU: { name: "English", words: { trial: "trial class", course: "class", club: "club", reviews: "reviews", near: "near me" } },
  NZ: { name: "English", words: { trial: "trial class", course: "class", club: "club", reviews: "reviews", near: "near me" } },
  DK: { name: "Danish", words: { trial: "prøvetime", course: "kursus", club: "forening", reviews: "anmeldelser", near: "i nærheden" } },
  SE: { name: "Swedish", words: { trial: "provlektion", course: "kurs", club: "förening", reviews: "recensioner", near: "nära" } },
  NO: { name: "Norwegian", words: { trial: "prøvetime", course: "kurs", club: "forening", reviews: "anmeldelser", near: "i nærheten" } },
  PL: { name: "Polish", words: { trial: "zajęcia próbne", course: "kurs", club: "klub lub stowarzyszenie", reviews: "opinie", near: "w pobliżu" } },
};

/** The search language of a country (ISO code), or null when there is no vocabulary for it (the prompt then says "the local language"). */
export function searchLanguageFor(countryCode: string | null | undefined): SearchLanguage | null {
  if (!countryCode) return null;
  return LANGUAGES[countryCode.toUpperCase()] ?? null;
}
