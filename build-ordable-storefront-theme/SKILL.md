---
name: build-ordable-storefront-theme
description: Build, redesign, extend, or audit a polished Next.js ecommerce theme powered by the ordable/ storefront API. Use for ordable/ catalog, category, product, variants, options, cart, checkout, promotions, gifting, wallet/loyalty, multi-currency, customer account, order tracking, bilingual English/Arabic, responsive UI, brand-token, SEO, and storefront performance work. Do not use this skill for deployment, hosting, DNS, Cloudflare, or infrastructure setup.
---

# Build an ordable/ storefront theme

> Write **ordable/** always lowercase, always with the trailing slash — not "Ordable" or "ORDABLE".

Build a complete storefront experience around the ordable/ API while keeping API credentials
server-only, catalog reads efficient, and the visual direction specific to the store.

## Load the references

- Read [references/api.md](references/api.md) completely before creating data types, API
  clients, route handlers, authentication, cart-to-order mapping, or checkout behavior. It is the
  **full, current** endpoint + payload contract, including the newest capabilities (multi-currency,
  countries, smart categories, promotions, gifting, wallet/points) and the field-name gotchas that
  cause real bugs.
- Read [references/theming.md](references/theming.md) completely before designing or changing
  layouts, components, responsive behavior, bilingual UI, or visual tokens.
- Consult [references/recipes.md](references/recipes.md) when implementing the stateful, edge-case-heavy
  flows — boot/caching, category tree, variant resolution, options/extra-fields, cart validation +
  pricing, fulfillment-slot computation, VAT/currency breakdown, promotions dry-run, gift payload,
  order create/tracking, popup queue. Prefer its worked logic over reinventing these; the money-path
  and edge-case traps are where regressions hide.
- Keep deployment and infrastructure out of scope. Stop after local production verification.

## Feature scope

A full ordable/ storefront may include, all gated on `GET /config/` flags (fail closed — a missing or
false flag means the feature does not render):

- **Catalog** — categories (incl. `no_mingling`), smart categories (`most_selling`/`newest`/`discounted`),
  product list (short notation) vs product detail (long notation), variants, options, extra fields
  (+ file `/upload/`), booking slots.
- **Money path** — cart, delivery vs pickup, server-computed fulfillment slots, `dry_run` validation,
  promotions/coupons, wallet + loyalty-points payment, international quote, VAT, multi-currency display.
- **Accounts** — email/phone auth (`mode` is an integer: `0`=sign-up, `1`=log-in), profile, saved
  addresses, wallet, points, order history.
- **Content** — static pages (footer/nav/checkout-agreement), popup banners, reviews, recommendations,
  cross-selling, stock notifications.

Do not assume a feature is on. Consult `references/api.md` for the exact flag and payload before building it.

## Work in this order

1. Inspect the repository, its `AGENTS.md`, package versions, existing routes, environment
   examples, API clients, and styling system. For Next.js projects, read the locally installed
   framework documentation relevant to the files being changed.
2. Derive a brief from the user's request, store assets, API config, and current site. Capture
   business type, audience, visual tone, required journeys, locales, currencies, and reference sites.
   Ask only when a missing choice would materially change the result.
3. Validate the API connection with the smallest safe representative requests. Never print,
   expose, or commit the API key. Never place a real order while testing.
4. Establish shared TypeScript models and server/client data boundaries before building UI.
5. Establish theme tokens, typography, spacing, states, and responsive rules before styling
   individual pages.
6. Implement the shopping journey end to end: discovery, category/search, product selection,
   cart, checkout, payment return, authentication, and order tracking as required by the brief.
7. Verify behavior with real API shapes and store content, including Arabic, long titles, missing
   images, empty results, variants, required options, out-of-stock items, promotions, and API errors.
8. Run type checking, linting, production build, and local browser checks at representative mobile
   and desktop widths. Report existing unrelated failures separately.

## Architecture requirements

- Keep `ORDABLE_API_BASE` and `ORDABLE_API_KEY` server-only. Browser code must call an
  allowlisted same-origin route; it must never receive the upstream key. Never prefix the key with
  `NEXT_PUBLIC_`.
- Call every endpoint **with its trailing slash** — the platform 301-redirects the slashless form and
  the redirect hop can drop the `Authorization` header.
- Render SEO-critical boot data and the first product page on the server. Seed client context from
  that result instead of repeating the same fetch after hydration.
- Never download the entire catalog for normal browsing. Paginate product lists and preserve the
  active branch, category, search query, filters, and sort when loading more.
- Fetch independent resources in parallel. Cache stable reads by an appropriate TTL and isolate
  branch-sensitive data. Load checkout-only resources only when checkout is opened.
- Treat product list records and product-detail records as different API notations. Do not infer
  variants, options, inventory, or pricing from incomplete list data.
- Preserve stable, readable routes: `/category/{category-slug}` and
  `/product/{category-slug}/{product-slug}`. Keep legacy redirects only when required.
- Sanitize API-supplied rich HTML before using `dangerouslySetInnerHTML` with a runtime-compatible
  sanitizer.
- Store customer tokens in secure HTTP-only cookies. Attach them to upstream requests only on the
  server, as `X-Customer-Token`. Never expose them to client JavaScript.
- Trust the server on all money — discounts, wallet/points, delivery charges, VAT, and currency
  conversion are server-authoritative. Client-side math is preview-only.
- Default to `dry_run: true` for order validation. Submit a real order only after explicit user
  authorization and intentional UI action.

## Experience requirements

- Make the theme recognizably tailored to the store; do not merely recolor a generic template.
- Support English and Arabic from the first layout pass. Use logical CSS properties, set `lang`
  and `dir`, choose an Arabic-capable font, and test directional icons in RTL.
- Design mobile-first. Avoid horizontal page overflow, fixed overlays that obscure content, and
  controls smaller than a comfortable touch target.
- Keep product cards equal-height, product titles wrapping safely, quantities easy to press, and
  product details scrollable on small screens.
- Provide visible loading, success, empty, unavailable, validation, and error states. Add-to-cart
  interactions must visibly confirm success.
- Make search and filters available on mobile; use a drawer when a desktop sidebar would crowd the
  product grid.
- Preserve keyboard access, visible focus, semantic labels, sufficient contrast, and reduced-motion
  behavior.

## Completion checklist

- Confirm API secrets and customer tokens do not appear in browser code, generated assets, logs, or
  committed files.
- Confirm catalog, search, filters, category hierarchy, PDP variants/options, cart line identity,
  checkout dry run, promotions, authentication, and tracking behave against representative API data.
- Confirm English and Arabic at 320, 390, 768, 1024, and 1440 CSS pixels without overflow.
- Confirm metadata, canonical URLs, structured data, robots rules, and sitemap use public slug URLs.
- Confirm local development and the production build pass.
- Summarize the implemented theme, changed files, checks run, and any API assumptions. Do not add
  or execute deployment instructions.
