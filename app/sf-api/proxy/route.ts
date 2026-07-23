import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ordableFetch } from "@/lib/ordable/server";
import { OrdableError } from "@/lib/ordable/unwrap";
import { findRule } from "@/lib/ordable/proxy-allowlist";
import { CUSTOMER_COOKIE } from "@/lib/ordable/session";

// Same-origin browser proxy. Validates path+method against an exact allowlist, rejects
// absolute / protocol-relative URLs, caps the body size, and attaches the API key (and
// the customer token for auth routes) only here — never in client code. Prefixed /sf-api
// so it does not collide with the platform dashboard's /api/* on shared domains.

const MAX_BODY = 100 * 1024; // 100 KB

function normalisePath(raw: string): string | null {
  if (!raw) return null;
  // Reject absolute or protocol-relative targets outright.
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) return null;
  const [p, ...rest] = raw.split("?");
  if (!p.startsWith("/")) return null;
  if (p.includes("..")) return null;
  const withSlash = p.endsWith("/") ? p : `${p}/`;
  const query = rest.length ? `?${rest.join("?")}` : "";
  return `${withSlash}${query}`;
}

async function handle(req: NextRequest, method: "GET" | "POST") {
  const rawPath = req.nextUrl.searchParams.get("path");
  const normalised = normalisePath(rawPath ?? "");
  if (!normalised) {
    return NextResponse.json({ success: false, message: "Invalid path" }, { status: 400 });
  }
  const pathOnly = normalised.split("?")[0];
  const rule = findRule(method, pathOnly);
  if (!rule) {
    return NextResponse.json(
      { success: false, message: "Endpoint not allowed" },
      { status: 403 },
    );
  }

  let body: unknown = undefined;
  if (method === "POST") {
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return NextResponse.json(
        { success: false, message: "Payload too large" },
        { status: 413 },
      );
    }
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { success: false, message: "Invalid JSON body" },
          { status: 400 },
        );
      }
    }
  }

  let customerToken: string | undefined;
  if (rule.auth) {
    const store = await cookies();
    customerToken = store.get(CUSTOMER_COOKIE)?.value;
  }

  try {
    const data = await ordableFetch(normalised, {
      method,
      body,
      customerToken,
      noStore: true,
    });
    return NextResponse.json(data);
  } catch (err) {
    const e = err as OrdableError;
    return NextResponse.json(
      { success: false, message: e.message, errors: e.fields },
      { status: e.status || 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req, "GET");
}

export async function POST(req: NextRequest) {
  return handle(req, "POST");
}
