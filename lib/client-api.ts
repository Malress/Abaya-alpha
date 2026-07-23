"use client";

// Browser helpers that talk ONLY to same-origin /sf-api routes. No API key or customer
// token is ever present here — the server routes attach those.

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string>;
  status: number;
  raw?: unknown;
}

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  let body: unknown = undefined;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const failed =
    !res.ok || b.success === false;
  return {
    ok: !failed,
    data: (b.data as T) ?? (b as T),
    message: typeof b.message === "string" ? b.message : undefined,
    errors: b.errors as Record<string, string> | undefined,
    status: res.status,
    raw: body,
  };
}

export async function sfGet<T = unknown>(path: string): Promise<ApiResult<T>> {
  const res = await fetch(`/sf-api/proxy?path=${encodeURIComponent(path)}`, {
    method: "GET",
  });
  return parse<T>(res);
}

export async function sfPost<T = unknown>(
  path: string,
  body: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(`/sf-api/proxy?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

export async function submitOrder<T = unknown>(payload: unknown): Promise<ApiResult<T>> {
  const res = await fetch("/sf-api/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parse<T>(res);
}

export async function authAction<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  const res = await fetch("/sf-api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

export async function uploadFile(file: File): Promise<ApiResult<{ file_url: string }>> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/sf-api/upload", { method: "POST", body: form });
  return parse<{ file_url: string }>(res);
}
