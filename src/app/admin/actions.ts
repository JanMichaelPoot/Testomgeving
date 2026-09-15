"use server";

import { redirect } from "next/navigation";
import {
  checkAdminPassword,
  setAdminSessionCookie,
  clearAdminSessionCookie,
} from "@/lib/adminAuth";

// Signature matches React's useActionState: (previousState, formData) =>
// nextState. Returning a string shows it as the form's error; redirect()
// on success throws internally and is handled by Next itself, the same
// pattern as CheckoutPanel's createCheckoutSession.
export async function loginAdmin(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const password = String(formData.get("password") ?? "");

  if (!checkAdminPassword(password)) {
    return "Onjuist wachtwoord.";
  }

  await setAdminSessionCookie();
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
