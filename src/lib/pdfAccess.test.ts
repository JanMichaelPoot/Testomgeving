import { describe, expect, it, vi, beforeEach } from "vitest";

let signedUrlResult: { data: { signedUrl: string } | null; error: { message: string } | null } = {
  data: { signedUrl: "https://storage.test/signed/idea-book.pdf?token=abc" },
  error: null,
};
let lastCall: { path: string; expiresIn: number } | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(() => ({
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: (path: string, expiresIn: number) => {
          lastCall = { path, expiresIn };
          expect(bucket).toBe("window-plans");
          return Promise.resolve(signedUrlResult);
        },
      }),
    },
  })),
}));

import { getSignedPdfUrl } from "./pdfAccess";

beforeEach(() => {
  lastCall = null;
  signedUrlResult = {
    data: { signedUrl: "https://storage.test/signed/idea-book.pdf?token=abc" },
    error: null,
  };
});

describe("getSignedPdfUrl", () => {
  it("returns null without calling storage when there is no stored path", async () => {
    const result = await getSignedPdfUrl(null);
    expect(result).toBeNull();
    expect(lastCall).toBeNull();
  });

  it("mints a signed URL for the bare storage object path", async () => {
    const result = await getSignedPdfUrl("session-123/idea-book.pdf");
    expect(result).toBe("https://storage.test/signed/idea-book.pdf?token=abc");
    expect(lastCall?.path).toBe("session-123/idea-book.pdf");
    // One hour — long enough to outlast one sitting on the /plan page,
    // short enough that a leaked link (browser history, a proxy log)
    // isn't useful for long. See pdfAccess.ts for the full rationale.
    expect(lastCall?.expiresIn).toBe(60 * 60);
  });

  it("returns null instead of throwing when Supabase Storage returns an error", async () => {
    signedUrlResult = { data: null, error: { message: "object not found" } };
    const result = await getSignedPdfUrl("session-123/idea-book.pdf");
    expect(result).toBeNull();
  });
});
