import { NextResponse } from "next/server";

// Proxies the free, keyless PDOK Locatieserver (Dutch government geocoding
// service) so the intake's location field can offer real place-name
// suggestions without a paid API (Google Places) or exposing a browser
// call directly to a third party. Restricted to city/municipality-level
// results — the intake explicitly only ever asks for "city or region",
// never a full address (see src/lib/i18n/dictionaries.ts: location.sub).
const PDOK_SUGGEST_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest";

interface PdokDoc {
  weergavenaam?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const url = new URL(PDOK_SUGGEST_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("fq", "type:(woonplaats OR gemeente)");
  url.searchParams.set("rows", "6");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = (await response.json()) as { response?: { docs?: PdokDoc[] } };
    const names = data.response?.docs
      ?.map((doc) => doc.weergavenaam)
      .filter((name): name is string => typeof name === "string" && name.length > 0);

    // De-duplicate — PDOK can return the same display name for a
    // woonplaats and its parent gemeente.
    const suggestions = Array.from(new Set(names ?? []));

    return NextResponse.json({ suggestions });
  } catch {
    // PDOK being slow or unreachable shouldn't break the intake — the
    // field just behaves like a plain text input, with no suggestions.
    return NextResponse.json({ suggestions: [] });
  }
}
