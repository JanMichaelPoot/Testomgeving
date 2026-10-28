import { describe, expect, it } from "vitest";
import { explainEmailError } from "@/lib/emailErrors";

describe("explainEmailError", () => {
  it("recognises the Resend sandbox refusal seen in the database (mail to anyone but the account owner)", () => {
    const real =
      "Resend rejected the e-mail: validation_error — You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain at resend.com/domains";
    const help = explainEmailError(real);
    expect(help?.cause).toContain("alleen naar het adres van het eigen Resend-account");
    expect(help?.fix).toContain("resend.com/domains");
    expect(help?.fix).toContain("EMAIL_FROM");
  });

  it("recognises an unverified sender domain and a missing or restricted key", () => {
    expect(explainEmailError("The windowinto.nl domain is not verified. Please, add and verify your domain")?.fix).toContain("EMAIL_FROM");
    expect(explainEmailError("Missing API key. Pass it to the constructor")?.cause).toContain("sleutel");
    expect(explainEmailError("restricted_api_key — This API key is restricted to only send emails")?.fix).toContain("RESEND_API_KEY");
  });

  it("returns null for an unknown or empty message, so the raw text is shown as it is", () => {
    expect(explainEmailError("socket hang up")).toBeNull();
    expect(explainEmailError("")).toBeNull();
    expect(explainEmailError(null)).toBeNull();
  });
});
