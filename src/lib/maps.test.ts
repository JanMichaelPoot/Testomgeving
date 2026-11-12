import { describe, expect, it } from "vitest";
import { hasMapLink, isOnlineCity, mapsSearchUrl } from "@/lib/maps";

describe("the Google Maps link of a place in the booklet", () => {
  it("is shown for a physical place, with the name and the town in the search", () => {
    expect(hasMapLink({ city: "Utrecht" })).toBe(true);
    expect(mapsSearchUrl("Klei Atelier", "Utrecht")).toBe("https://www.google.com/maps/search/?api=1&query=Klei%20Atelier%2C%20Utrecht");
  });

  it("is left out for an online provider, which only gets its website", () => {
    for (const city of ["Online", "online", " ONLINE ", "Nederland", "Netherlands", "Landelijk", "Webshop"]) {
      expect(isOnlineCity(city), city).toBe(true);
      expect(hasMapLink({ city }), city).toBe(false);
    }
  });

  it("keeps the link for an older book whose place has no town recorded", () => {
    expect(hasMapLink({ city: "" })).toBe(true);
  });
});
