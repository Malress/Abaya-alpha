import "server-only";
import { OrdableError, extractErrorMessage } from "./unwrap";

// Server-only ordable/ client. The API key lives here and is never sent to the browser.
// Every path is called WITH a trailing slash — the platform 301-redirects the slashless
// form and the redirect hop can drop the Authorization header.

const API_BASE = process.env.ORDABLE_API_URL ?? process.env.ORDABLE_API_BASE ?? "";
const API_KEY = process.env.ORDABLE_API_KEY ?? "";

if (!API_BASE) {
  // Surfaced at build/boot rather than as a confusing 404 later.
  console.warn("[ordable] ORDABLE_API_URL is not set");
}

function ensureTrailingSlashPath(path: string): string {
  // Split off query string; ensure the path portion ends with a slash.
  const [p, q] = path.split("?");
  const withSlash = p.endsWith("/") ? p : `${p}/`;
  return q ? `${withSlash}?${q}` : withSlash;
}

// ---- Tiny in-memory TTL cache (per server instance) ----
type CacheEntry = { value: unknown; expires: number };
const cache = new Map<string, CacheEntry>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown, ttlMs: number) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  customerToken?: string;
  ttlMs?: number; // cache GET responses for this long
  cacheKey?: string;
  noStore?: boolean;
  signal?: AbortSignal;
}

export async function ordableFetch<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const method = opts.method ?? "GET";
  const url = `${API_BASE}${ensureTrailingSlashPath(path)}`;

  const cacheable = method === "GET" && !opts.noStore && !opts.customerToken && opts.ttlMs;
  const key = opts.cacheKey ?? url;
  if (cacheable) {
    const cached = cacheGet<T>(key);
    if (cached !== undefined) return cached;
  }

  const headers: Record<string, string> = {
    Authorization: API_KEY,
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.customerToken) headers["X-Customer-Token"] = opts.customerToken;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      redirect: "follow",
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (err) {
    // Let Next.js control-flow signals (dynamic rendering, redirects, notFound)
    // propagate untouched — only wrap genuine network failures.
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string" || (err as Error)?.name !== "TypeError") {
      throw err;
    }
    throw new OrdableError(
      `Network error contacting store: ${(err as Error).message}`,
      502,
    );
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const fields =
      parsed && typeof parsed === "object" && "errors" in parsed
        ? ((parsed as { errors?: Record<string, string> }).errors ?? undefined)
        : undefined;
    throw new OrdableError(
      extractErrorMessage(parsed, `Request failed (${res.status})`),
      res.status,
      fields,
    );
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "success" in parsed &&
    (parsed as { success?: boolean }).success === false
  ) {
    throw new OrdableError(extractErrorMessage(parsed, "Request unsuccessful"), 400);
  }

  if (cacheable) cacheSet(key, parsed, opts.ttlMs!);
  return parsed as T;
}

export function hasCredentials(): boolean {
  return Boolean(API_BASE && API_KEY);
}
