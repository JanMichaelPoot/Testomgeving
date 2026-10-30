// The company behind WindowInto, as it must be shown to visitors and customers (footer, privacy page,
// order confirmation mail). One source, so the three places cannot disagree.
// The VAT number is not listed on purpose: none has been supplied. Add it here when it is known.
export const COMPANY = {
  tradeName: "VantageLabs",
  legalForm: { nl: "eenmanszaak", en: "sole proprietorship" },
  kvk: "42198388",
  branchNumber: "000067049303",
  street: "Breeweg 9",
  postalCode: "1251 DX",
  city: "Laren",
} as const;

const address = `${COMPANY.street}, ${COMPANY.postalCode} ${COMPANY.city}`;

/** One line, for a footer or a mail: "VantageLabs (eenmanszaak) · KvK 42198388 · vestigingsnr. ... · Breeweg 9, 1251 DX Laren". */
export const COMPANY_LINE = {
  nl: `${COMPANY.tradeName} (${COMPANY.legalForm.nl}) · KvK-nummer ${COMPANY.kvk} · vestigingsnummer ${COMPANY.branchNumber} · ${address}`,
  en: `${COMPANY.tradeName} (${COMPANY.legalForm.en}) · Chamber of Commerce no. ${COMPANY.kvk} · branch no. ${COMPANY.branchNumber} · ${address}, the Netherlands`,
} as const;
