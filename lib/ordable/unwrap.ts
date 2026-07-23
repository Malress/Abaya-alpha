// Response envelope helpers. ordable/ responses are { success, data } but list
// nesting varies, so unwrap defensively without masking real errors.

export function unwrapObject<T>(response: unknown): T {
  if (response && typeof response === "object" && "data" in response) {
    const data = (response as { data: unknown }).data;
    if (data && typeof data === "object" && !Array.isArray(data)) return data as T;
  }
  return response as T;
}

export function unwrapList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  const v = response as { data?: T[] | { data?: T[] } } | undefined;
  if (Array.isArray(v?.data)) return v.data as T[];
  const inner = (v?.data as { data?: T[] } | undefined)?.data;
  if (Array.isArray(inner)) return inner;
  return [];
}

// Tracking may return the order directly, under data, or as the first array element.
export function unwrapOrder<T>(response: unknown): T | null {
  const v = response as { data?: unknown } | undefined;
  const data = v && typeof v === "object" && "data" in v ? v.data : v;
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return (data as T) ?? null;
}

export class OrdableError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "OrdableError";
    this.status = status;
    this.fields = fields;
  }
}

export function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string") return b.message;
    if (typeof b.detail === "string") return b.detail;
    if (b.errors && typeof b.errors === "object") {
      const first = Object.values(b.errors as Record<string, unknown>)[0];
      if (typeof first === "string") return first;
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
  }
  return fallback;
}
