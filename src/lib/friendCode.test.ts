import { describe, expect, it } from "vitest";
import { FRIEND_CODE_STORAGE_KEY, friendCodeFromQuery, friendLink, friendWhatsAppUrl } from "@/lib/friendCode";
import { generateCode, normalizeCode } from "@/lib/discountCode";

describe("friendCodeFromQuery", () => {
  it("reads a code the way the server does, so what a link carries is what the order checks", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(friendCodeFromQuery(code)).toBe(code);
      expect(friendCodeFromQuery(code.toLowerCase().replace(/-/g, " "))).toBe(normalizeCode(code));
    }
  });

  it("takes it loosely typed", () => {
    expect(friendCodeFromQuery("wiabcdefgh")).toBe("WI-ABCD-EFGH");
    expect(friendCodeFromQuery(" wi abcd efgh ")).toBe("WI-ABCD-EFGH");
  });

  it("ignores what cannot be a code", () => {
    for (const bad of [null, undefined, "", "hello", "WI-ABCD", "WI-ABCD-EFGH-IJKL", "XX-ABCD-EFGH", "WI-ABC0-EFGH", "WI-ABCI-EFGH", "<script>", "WI-ABCD-EFGH; drop table"]) {
      expect(friendCodeFromQuery(bad)).toBeNull();
    }
  });
});

describe("friendLink and friendWhatsAppUrl", () => {
  it("opens the intake in the language of the mail, with the code and where the visit came from", () => {
    expect(friendLink("https://windowinto.nl", "nl", "WI-ABCD-EFGH")).toBe("https://windowinto.nl/intake?lang=nl&code=WI-ABCD-EFGH&utm_source=friend_code&utm_medium=email");
    expect(friendLink("https://windowinto.nl", "en", "WI-ABCD-EFGH")).toContain("lang=en");
  });

  it("puts the message and the link in one WhatsApp text that survives the encoding", () => {
    const link = friendLink("https://windowinto.nl", "nl", "WI-ABCD-EFGH");
    const url = friendWhatsAppUrl("Kijk eens & probeer: €2,50", link);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.replace("https://wa.me/?text=", ""))).toBe(`Kijk eens & probeer: €2,50 ${link}`);
  });

  it("names its storage key", () => {
    expect(FRIEND_CODE_STORAGE_KEY).toBe("window-friend-code");
  });
});
