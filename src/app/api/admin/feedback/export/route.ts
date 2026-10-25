import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { csvCell } from "@/lib/csv";

// All tester feedback as CSV (one row per answer), behind the same admin password as the pages.
export const dynamic = "force-dynamic";

const COLUMNS = ["created_at", "locale", "flow_score", "profile_score", "doors_score", "door_pick", "door_kind", "would_pay", "doubt"] as const;

export async function GET() {
  if (!(await isAdminAuthenticated())) return new NextResponse("Niet toegestaan", { status: 401 });
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("test_feedback").select("*").order("created_at", { ascending: false }).limit(5000);
  if (error) return new NextResponse(`Fout: ${error.message}`, { status: 500 });
  const lines = [COLUMNS.join(","), ...(data ?? []).map((row) => COLUMNS.map((c) => csvCell((row as Record<string, unknown>)[c])).join(","))];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="window-feedback-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
