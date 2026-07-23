# Abaya — ordable/ storefront theme

An editorial modest-fashion storefront built on the **ordable/** public API, inspired by the
Modern Abayati design direction (ink / ivory / sand palette, serif display wordmark,
letter-spaced nav, full-bleed imagery). Bilingual **English + Arabic (RTL)**, mobile-first.

## Setup

```bash
npm install
npm run dev
```

`.env.local`:

```dotenv
ORDABLE_API_URL=https://yourstore.ordable.com/public   # /public is part of the base
ORDABLE_API_KEY=your-StorePublicToken                  # SERVER-ONLY — never NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=http://localhost:3000             # order return URLs, canonical, sitemap
```

## Architecture

- **Server-only API** (`lib/ordable/`): the API key lives in `server.ts` and is attached to
  upstream requests on the server only. Every path is called **with a trailing slash**.
- **Same-origin proxy** (`app/sf-api/*`): the browser only ever calls `/sf-api/proxy`,
  `/sf-api/order`, `/sf-api/auth`, `/sf-api/upload`. The proxy validates each request against an
  exact endpoint+method allowlist (`lib/ordable/proxy-allowlist.ts`) and attaches the API key and
  the customer token. The upstream key/token never reach client JS.
- **Customer sessions**: the auth token is stored in an HTTP-only `SameSite=Lax` cookie and sent
  upstream as `X-Customer-Token` from route handlers only.
- **Feature flags fail closed**: every optional feature is gated on a `/config/` flag; a missing or
  false flag means the UI does not render.
- **Money is server-authoritative**: totals, delivery, discounts, wallet/points and VAT come from a
  `dry_run` order round-trip; client math is preview-only. A real order is submitted only from the
  shopper's explicit "Place order" action (`dry_run: false`).

## Feature coverage (gated on the target store's config)

Catalog (categories, smart rows, product list vs detail, variants, options, extra fields incl.
file upload), search, filter & sort, cart with `no_mingling`, checkout (delivery/pickup, areas,
client-computed fulfilment slots, promotions/coupons, wallet + loyalty points, gifting), email/phone
auth + account + order history, order tracking, payment return, reviews, popup banner, static pages.

## Scripts

```bash
npm run dev     # local development
npm run build   # production build
npm run lint    # eslint
```

> Deployment/infrastructure is intentionally out of scope.
