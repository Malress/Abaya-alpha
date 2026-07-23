import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ordableFetch } from "@/lib/ordable/server";
import { OrdableError } from "@/lib/ordable/unwrap";
import { CUSTOMER_COOKIE } from "@/lib/ordable/session";

// Order create. Defaults to dry_run:true for validation; a real order is only submitted
// when the client explicitly sends dry_run:false from the shopper's confirmed action.
// The customer token (if signed in) is attached server-side to fund wallet/points.

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  // Fail closed on dry_run: anything other than an explicit false is treated as a dry run.
  const payload = { ...body, dry_run: body.dry_run === false ? false : true };

  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;

  try {
    const data = await ordableFetch("/order/create/", {
      method: "POST",
      body: payload,
      customerToken: token,
      noStore: true,
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const e = err as OrdableError;
    return NextResponse.json(
      { success: false, message: e.message, errors: e.fields },
      { status: e.status || 500 },
    );
  }
}
