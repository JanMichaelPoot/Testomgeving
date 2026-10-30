"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/posthog/client";
import { startRedeem } from "@/app/cadeau/actions";

function SubmitButton({ label, pending }: { label: string; pending: string }) {
  const status = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={status.pending} className="w-full justify-center sm:w-auto">
      {status.pending ? pending : label}
    </Button>
  );
}

// "Open je venster" on the page of a valid code: remembers the code and starts the intake (src/app/cadeau/actions.ts). Nothing is used up yet.
export function VoucherStartForm({ code, label, pendingLabel }: { code: string; label: string; pendingLabel: string }) {
  return (
    <form action={startRedeem} onSubmit={() => trackEvent("gift_voucher_redeem_started")}>
      <input type="hidden" name="code" value={code} />
      <SubmitButton label={label} pending={pendingLabel} />
    </form>
  );
}
