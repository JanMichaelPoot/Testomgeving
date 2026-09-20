import type { LegalDocumentType } from "@/types/database";

// The currently active version of each legal document, matched to the
// `legal_documents` table (see supabase/migrations
// /0010_digital_sales_compliance.sql) and to the actual copy in
// src/lib/i18n/dictionaries.ts. Every order stamps the version that was
// active *at the moment of consent* into terms_acceptance /
// digital_delivery_consent — those stored values never change after the
// fact, even when the constants below are later bumped for a new order.
//
// To publish a new version of a legal document: (1) write the new copy
// into dictionaries.ts (both locales), (2) bump the relevant constant
// below, (3) add a matching row to `legal_documents` via a new migration.
// All three together are "publishing a version" — this file alone is not
// enough, and vice versa.
export const LEGAL_VERSIONS: Record<LegalDocumentType, string> = {
  terms: "v1.0",
  digital_delivery_consent: "v1.0",
  withdrawal_information: "v1.0",
  privacy: "v1.0",
};
