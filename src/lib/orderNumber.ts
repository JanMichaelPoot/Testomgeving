import type { createServiceRoleClient } from "@/lib/supabase/server";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

// Assigns the next human-readable order number ("WI-2026-000042") via the
// next_order_number() Postgres function (see supabase/migrations
// /0010_digital_sales_compliance.sql). Done as a database sequence rather
// than a "count existing rows + 1" query in application code, which would
// race under concurrent checkouts and risk assigning the same number twice.
export async function nextOrderNumber(
  supabase: ServiceRoleClient
): Promise<string> {
  const { data, error } = await supabase.rpc("next_order_number");

  if (error || !data) {
    throw new Error(error?.message ?? "Could not assign an order number.");
  }

  return data;
}
