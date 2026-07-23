import { NextRequest, NextResponse } from "next/server";
import { OrdableError, extractErrorMessage } from "@/lib/ordable/unwrap";

// File upload for `file` extra-fields. Forwards multipart to /upload/ with the API key
// attached server-side. Returns { file_url } which the client stores in the order payload.

const API_BASE = process.env.ORDABLE_API_URL ?? process.env.ORDABLE_API_BASE ?? "";
const API_KEY = process.env.ORDABLE_API_KEY ?? "";
const MAX = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: "No file" }, { status: 400 });
  }
  if (file.size > MAX) {
    return NextResponse.json({ success: false, message: "File too large" }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.append("file", file, file.name);

  try {
    const res = await fetch(`${API_BASE}/upload/`, {
      method: "POST",
      headers: { Authorization: API_KEY },
      body: upstream,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new OrdableError(extractErrorMessage(data, "Upload failed"), res.status);
    }
    return NextResponse.json(data);
  } catch (err) {
    const e = err as OrdableError;
    return NextResponse.json(
      { success: false, message: e.message },
      { status: e.status || 500 },
    );
  }
}
