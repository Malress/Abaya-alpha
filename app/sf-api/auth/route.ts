import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ordableFetch } from "@/lib/ordable/server";
import { OrdableError } from "@/lib/ordable/unwrap";
import { CUSTOMER_COOKIE, CUSTOMER_COOKIE_OPTIONS } from "@/lib/ordable/session";

// Customer auth. The upstream token is captured here and written to an HTTP-only cookie;
// it is never returned to the browser. Auth `mode` is an integer (0 sign-up / 1 log-in).

type Body = {
  action: "auth" | "verify" | "forgot" | "logout" | "me" | "profile";
  channel?: "email" | "phone";
  mode?: number;
  email?: string;
  phone?: string;
  password?: string;
  name?: string;
  code?: string;
  opt_in_marketing?: boolean;
};

function tokenFrom(data: unknown): string | undefined {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.token === "string") return d.token;
    const inner = d.data as Record<string, unknown> | undefined;
    if (inner && typeof inner.token === "string") return inner.token;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const store = await cookies();

  try {
    if (body.action === "logout") {
      const token = store.get(CUSTOMER_COOKIE)?.value;
      if (token) {
        await ordableFetch("/auth/logout/", {
          method: "POST",
          customerToken: token,
          noStore: true,
        }).catch(() => undefined);
      }
      const res = NextResponse.json({ success: true });
      res.cookies.set(CUSTOMER_COOKIE, "", { ...CUSTOMER_COOKIE_OPTIONS, maxAge: 0 });
      return res;
    }

    if (body.action === "me") {
      const token = store.get(CUSTOMER_COOKIE)?.value;
      if (!token) return NextResponse.json({ success: false, authenticated: false });
      const data = await ordableFetch("/auth/me/", {
        customerToken: token,
        noStore: true,
      });
      return NextResponse.json({ success: true, authenticated: true, data });
    }

    if (body.action === "profile") {
      const token = store.get(CUSTOMER_COOKIE)?.value;
      if (!token) return NextResponse.json({ success: false }, { status: 401 });
      const data = await ordableFetch("/auth/profile/", {
        method: "POST",
        body: {
          name: body.name,
          email: body.email,
          phone: body.phone,
          opt_in_marketing: body.opt_in_marketing,
        },
        customerToken: token,
        noStore: true,
      });
      return NextResponse.json({ success: true, data });
    }

    const channel = body.channel ?? "email";

    if (body.action === "forgot") {
      const path =
        channel === "phone" ? "/auth/forgot-password/phone/" : "/auth/forgot-password/";
      await ordableFetch(path, {
        method: "POST",
        body: channel === "phone" ? { phone: body.phone } : { email: body.email },
        noStore: true,
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === "auth") {
      const path = channel === "phone" ? "/auth/phone/" : "/auth/email/";
      const payload =
        channel === "phone"
          ? { phone: body.phone, password: body.password, mode: body.mode ?? 1, name: body.name }
          : { email: body.email, password: body.password, mode: body.mode ?? 1, name: body.name };
      const data = await ordableFetch(path, { method: "POST", body: payload, noStore: true });
      const token = tokenFrom(data);
      if (token) {
        const res = NextResponse.json({ success: true, verify: false });
        res.cookies.set(CUSTOMER_COOKIE, token, CUSTOMER_COOKIE_OPTIONS);
        return res;
      }
      // A verification code was sent.
      return NextResponse.json({ success: true, verify: true });
    }

    if (body.action === "verify") {
      const path = channel === "phone" ? "/auth/phone/verify/" : "/auth/email/verify/";
      const payload =
        channel === "phone"
          ? { phone: body.phone, code: body.code }
          : { email: body.email, code: body.code };
      const data = await ordableFetch(path, { method: "POST", body: payload, noStore: true });
      const token = tokenFrom(data);
      if (!token) {
        return NextResponse.json(
          { success: false, message: "Verification failed" },
          { status: 400 },
        );
      }
      const res = NextResponse.json({ success: true });
      res.cookies.set(CUSTOMER_COOKIE, token, CUSTOMER_COOKIE_OPTIONS);
      return res;
    }

    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 });
  } catch (err) {
    const e = err as OrdableError;
    return NextResponse.json(
      { success: false, message: e.message, errors: e.fields },
      { status: e.status || 500 },
    );
  }
}
