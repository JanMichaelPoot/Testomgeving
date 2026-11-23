import type { Instrumentation } from "next";
import { describeRequestError } from "@/lib/requestError";

// Called by Next.js for every error that reaches the server: a page that fails to render, a route handler or a server action that throws. Until now such an error was
// only in the log of the host as plain text, between thousands of lines, and nobody looked. It is now one JSON line with "event":"request_error" that can be searched in
// the host's log and set an alert on, without an extra vendor or account. (Errors that are caught on purpose and handled are not here.)
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  try {
    console.error(JSON.stringify(describeRequestError(error, request, context)));
  } catch {
    // Reporting an error must never be the thing that fails.
  }
};
