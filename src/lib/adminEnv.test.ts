import { describe, expect, it } from "vitest";
import { envChecks } from "@/lib/adminEnv";

const get = (checks: ReturnType<typeof envChecks>, name: string) => checks.find((c) => c.name === name)!;

describe("envChecks", () => {
  it("flags a missing mail key as a problem that breaks e-mail, without ever echoing a secret", () => {
    const checks = envChecks({ VERCEL_ENV: "production", ANTHROPIC_API_KEY: "sk-ant-TOPVALUE9", STRIPE_SECRET_KEY: "sk_test_TOPVALUE9" });
    expect(get(checks, "RESEND_API_KEY")).toMatchObject({ ok: false, required: true });
    expect(get(checks, "Omgeving").detail).toContain("production");
    expect(JSON.stringify(checks)).not.toContain("TOPVALUE9");
    expect(get(checks, "STRIPE_SECRET_KEY").detail).toContain("testmodus");
  });

  it("accepts a present key that looks right, and notices an odd one", () => {
    expect(get(envChecks({ RESEND_API_KEY: "re_abc" }), "RESEND_API_KEY").ok).toBe(true);
    expect(get(envChecks({ RESEND_API_KEY: "  " }), "RESEND_API_KEY").ok).toBe(false);
    const odd = get(envChecks({ RESEND_API_KEY: "abc123" }), "RESEND_API_KEY");
    expect(odd.ok).toBe(false);
    expect(odd.detail).toContain("re_");
  });

  it("warns when the site address is localhost, because the buttons in the mail then lead nowhere", () => {
    expect(get(envChecks({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }), "NEXT_PUBLIC_SITE_URL").ok).toBe(false);
    expect(get(envChecks({ NEXT_PUBLIC_SITE_URL: "https://x.vercel.app" }), "NEXT_PUBLIC_SITE_URL").ok).toBe(true);
  });

  it("mentions the unverified-domain risk when the sender is on windowinto.nl", () => {
    expect(envChecks({ EMAIL_FROM: "WINDOW <hello@windowinto.nl>" }).some((c) => c.name === "Afzenderdomein")).toBe(true);
    expect(envChecks({ EMAIL_FROM: "WINDOW <onboarding@resend.dev>" }).some((c) => c.name === "Afzenderdomein")).toBe(false);
  });

  it("knows the Supabase key under its newer name too", () => {
    expect(get(envChecks({ SUPABASE_SECRET_KEY: "sb_secret_X" }), "Supabase-servicesleutel")).toMatchObject({ ok: true });
    expect(get(envChecks({ SUPABASE_SERVICE_ROLE_KEY: "x" }), "Supabase-servicesleutel").ok).toBe(true);
    expect(get(envChecks({}), "Supabase-servicesleutel")).toMatchObject({ ok: false, required: true });
  });
});
