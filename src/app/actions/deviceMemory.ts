"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { disableDeviceMemory } from "@/lib/discovery/historyStore";

// "Forget this device" (privacy page): deletes everything stored for the device and
// the cookie itself. As easy to do as opting in was, which is what withdrawing consent
// requires.
export async function forgetDevice() {
  await disableDeviceMemory(createServiceRoleClient());
  revalidatePath("/privacy");
}
