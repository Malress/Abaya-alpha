// Exact endpoint + method allowlist for the same-origin browser proxy (/sf-api/proxy).
// The proxy is NOT a general pass-through: only these routes may be reached, and only
// with the listed method. Paths are matched by a RegExp against the (slash-normalised)
// path portion — query strings are allowed but never the origin.

export interface AllowRule {
  method: "GET" | "POST";
  pattern: RegExp;
  // Whether this route may carry the customer auth token (X-Customer-Token).
  auth?: boolean;
}

export const ALLOWLIST: AllowRule[] = [
  // Catalog
  { method: "GET", pattern: /^\/products\/$/ },
  { method: "GET", pattern: /^\/product\/$/ },
  { method: "GET", pattern: /^\/categories\/$/ },
  { method: "GET", pattern: /^\/categories\/smart\/$/ },
  { method: "GET", pattern: /^\/filters\/$/ },
  { method: "POST", pattern: /^\/products\/filter\/$/ },
  { method: "GET", pattern: /^\/products\/cross_selling\/$/ },
  { method: "GET", pattern: /^\/feedback\/$/ },
  { method: "POST", pattern: /^\/feedback\/$/, auth: true },
  { method: "POST", pattern: /^\/stock\/notification\/$/ },

  // Fulfilment + money path
  { method: "POST", pattern: /^\/branches\/areas\/$/ },
  { method: "GET", pattern: /^\/promotions\/$/ },
  { method: "POST", pattern: /^\/order\/international_quote\/$/ },
  { method: "GET", pattern: /^\/payment_methods\/$/ },
  { method: "GET", pattern: /^\/countries\/$/ },
  { method: "GET", pattern: /^\/currencies\/$/ },
  { method: "GET", pattern: /^\/order\/$/ }, // tracking (?tracking_id=)

  // Account (auth token attached server-side)
  { method: "GET", pattern: /^\/auth\/me\/$/, auth: true },
  { method: "POST", pattern: /^\/auth\/profile\/$/, auth: true },
  { method: "GET", pattern: /^\/auth\/wallet\/$/, auth: true },
  { method: "GET", pattern: /^\/auth\/points\/$/, auth: true },
  { method: "GET", pattern: /^\/auth\/addresses\/$/, auth: true },
  { method: "POST", pattern: /^\/auth\/addresses\/$/, auth: true },
  { method: "POST", pattern: /^\/auth\/addresses\/edit\/$/, auth: true },
  { method: "POST", pattern: /^\/auth\/addresses\/delete\/$/, auth: true },
  { method: "POST", pattern: /^\/auth\/addresses\/preferred\/$/, auth: true },
  { method: "GET", pattern: /^\/orders\/$/, auth: true },
];

export function findRule(method: string, path: string): AllowRule | undefined {
  return ALLOWLIST.find((r) => r.method === method && r.pattern.test(path));
}
