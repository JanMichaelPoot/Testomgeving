// What is written to the log when a request fails on the server (src/instrumentation.ts). One JSON line, so the log of the host can be searched and alerts can be set on
// it ("event":"request_error"). Only what is needed to find the failure: where (route, method, kind), which error (name, message, digest, the first lines of the stack).
// Never the query string, headers, cookies or body: those can hold an e-mail address, a session or a token.

export interface RequestErrorLine {
  level: "error";
  event: "request_error";
  at: string;
  method: string;
  path: string;
  routePath: string;
  routeType: string;
  routerKind: string;
  renderSource: string | null;
  name: string;
  message: string;
  digest: string | null;
  stack: string | null;
}

const MESSAGE_MAX = 300;
const STACK_LINES = 6;

/** A path without its query string or fragment, and without an identifier that looks like a secret (a long token segment is shortened). */
export function cleanPath(raw: string): string {
  const path = (raw ?? "").split(/[?#]/)[0].slice(0, 200);
  return path
    .split("/")
    .map((seg) => (seg.length > 40 ? `${seg.slice(0, 8)}…` : seg))
    .join("/");
}

/** Anything that looks like an e-mail address or a long token in a message is hidden: error messages from libraries sometimes quote their input. */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(?:sk|pk|rk|whsec|cs_(?:test|live))_[A-Za-z0-9_]{8,}/g, "[token]")
    .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, "[jwt]");
}

export function describeRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string; routerKind?: string; renderSource?: string },
  now: Date = new Date(),
): RequestErrorLine {
  const e = (error && typeof error === "object" ? error : {}) as { name?: unknown; message?: unknown; digest?: unknown; stack?: unknown };
  const stack = typeof e.stack === "string" ? scrub(e.stack.split("\n").slice(1, 1 + STACK_LINES).map((l) => l.trim()).join(" | ")) : null;
  return {
    level: "error",
    event: "request_error",
    at: now.toISOString(),
    method: (request.method ?? "").slice(0, 10),
    path: cleanPath(request.path),
    routePath: (context.routePath ?? "").slice(0, 200),
    routeType: context.routeType ?? "",
    routerKind: context.routerKind ?? "",
    renderSource: context.renderSource ?? null,
    name: typeof e.name === "string" ? e.name.slice(0, 80) : "Error",
    message: scrub(typeof e.message === "string" ? e.message : String(error)).slice(0, MESSAGE_MAX),
    digest: typeof e.digest === "string" ? e.digest.slice(0, 40) : null,
    stack,
  };
}
