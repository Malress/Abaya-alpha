// Customer session cookie. The token is stored HTTP-only and only ever attached to
// upstream requests on the server as X-Customer-Token — never exposed to client JS.
export const CUSTOMER_COOKIE = "ord_ct";

export const CUSTOMER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};
