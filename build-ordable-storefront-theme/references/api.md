# ordable/ storefront API reference

The full API and data contract for building a storefront on the ordable/ public API (`/public/*`).
Adapt to verified response shapes from the target store — ordable/ installations may differ slightly —
but the endpoints, field names, and gotchas below are the current contract. Where the older
best-practice docs disagreed with the live spec, the spec wins; those corrections are called out inline.

## Contents

1. Security and request boundaries
2. Response handling
3. Store, config, and feature flags
4. Branches, areas, countries, currencies
5. Catalog: categories, products, detail
6. Variants, options, extra fields, booking slots
7. Cart, checkout, and orders (the money path)
8. Promotions and coupons
9. Customer authentication and accounts
10. Reviews, stock, recommendations, pages, banners
11. Caching and efficiency
12. Safe verification
13. Cross-cutting gotchas

---

## 1. Security and request boundaries

Configure only **server-side** environment variables:

```dotenv
ORDABLE_API_BASE=https://store.example.com/public   # the /public suffix is part of the base
ORDABLE_API_KEY=replace-with-storefront-key
NEXT_PUBLIC_SITE_URL=https://shop.example.com
```

Never prefix the API key with `NEXT_PUBLIC_`. Send it upstream as a **raw token, no `Bearer`**:

```http
Authorization: STORE_API_KEY
Accept: application/json
```

`GET /payment_methods` is the only endpoint that needs no auth. Everything else requires the header.

Use two clients:

- A **server data client** for SSR, metadata, sitemap, and private mutations.
- A **same-origin browser proxy** such as `/sf-api/proxy?path=...`. Validate the path against an exact
  endpoint/method allowlist, reject absolute or protocol-relative URLs, cap request bodies, and attach
  the API key (and the customer's `X-Customer-Token`) only inside the route handler. Do not turn the
  proxy into an unrestricted pass-through; do not allow browser-supplied upstream origins or credentials.

Name the proxy prefix something other than `/api/*` (e.g. `/sf-api/*`). Store domains also serve the
platform dashboard under `/api/*`; claiming `/api/*` breaks `/manage` on shared domains.

Call every endpoint **with its trailing slash** — the platform 301-redirects the slashless form and a
redirect hop can drop the `Authorization` header.

---

## 2. Response handling

Responses follow `{ "success": bool, "data": ... }`. Errors are `{ "success": false, "message": "…" }`
(or `{ "detail" }` on 401/403, or `{ "errors": {field: msg} }` on auth forms). List nesting varies —
unwrap without masking real errors:

```ts
function unwrapList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  const v = response as { data?: T[] | { data?: T[] } };
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray((v?.data as { data?: T[] })?.data)) return (v.data as { data: T[] }).data;
  return [];
}
```

For mutations, check both HTTP status and `success === false`; surface a useful message from
`errors`, `detail`, or `message`. Do not convert transient upstream failures into false 404 pages.

Amounts are in the store **base currency** unless you passed a display `?currency=<iso>` (see §4).

---

## 3. Store, config, and feature flags

| Method | Path | Purpose |
|---|---|---|
| GET | `/config/` | Store name, assets, contacts, colors, SEO, feature flags, popup banners |
| GET | `/payment_methods` | **No auth.** `[{value, label, ar_label, icon?}]` — send `value` back as `payment_method` |
| GET | `/pages/` | Store-authored informational + checkout-agreement pages |
| POST | `/upload/` | multipart field `file`; images + PDF ≤10 MB → `{success, file_url, name}` |

Every optional feature **fails closed**: gate its UI on the config flag; missing/false ⇒ do not render.

Key `config.*` fields:

- **Branding**: `name, ar_name, slogan, ar_slogan, logo, logo_ar, logo_thumb(_ar), cover(_medium/_large), favicon, domain, alt_domain, meta_name, meta_description`, `gallery` (hero slides).
- **Theme**: `theme_color` (primary), `theme_color_light` (light bg), `discount_tag_color` (sale accent) — apply independently; `#0099CC` = unset placeholder. Match social links by field key (`instagram_link`…), never by URL pattern (a known bug misreads Instagram as Snapchat).
- **Currency (newest)**: `enable_currency_converter`, `base_currency`.
- **Ordering**: `minimum_order, minimum_order_pickup, enable_international_delivery, allow_preordering`, busy pause (`busy_until_active/date/time`).
- **Loyalty/Wallet**: `enable_loyalty_points, enable_loyalty_points_payment, loyalty_points_conversion_rate, loyalty_points_to_money_conversion_rate, loyalty_points_to_money_threshold`; wallet needs `enable_wallet` **and** `enable_wallet_staff`.
- **Reviews**: `enable_feedback` (store), `enable_product_feedback` (product) — single pre-combined booleans (the old `_on_website`/`_staff` flags are gone).
- **Gifting**: `enable_gifts` (master), `enable_gifts_message_form, enable_force_gift_name_number, gift_message_character_limit (0=∞), enable_unknown_gift_recipient_location, enable_gift_links, enable_send_gift_anonymously, disable_cash_for_gift, enable_gift_wrapping, gift_wrapping_price`.
- **Discovery/UX**: `enable_filter_and_sort, enable_product_recommendations(_staff), enable_product_cross_sell_items(_staff), enable_popup_banner, popup_banner, enable_phone_login`.
- **Analytics** (inject only when non-null): `google_analytics, google_manager_id, fb_pixel, snap_pixel, tiktok_pixel, twitter_pixel, …`.

---

## 4. Branches, areas, countries, currencies

| Method | Path | Purpose |
|---|---|---|
| GET | `/branches` | Branches + fulfillment capabilities |
| POST | `/branches/areas/` | Delivery areas for `{ "branch_ids": [1, 2] }` (accepts `?currency=`) |
| GET | `/countries/` | **Newest.** Delivery countries for pickers + phone dial codes |
| GET | `/currencies/` | **Newest.** Enabled display currencies + live rates |

- **`/branches`**: working hours (`delivery_working_hours`, `pickup_working_hours`, `scheduled_delivery_slots` — each `{day 0=Sun, start, end}`), fulfillment flags (`enable_delivery/pickup`, `enable_on_demand_*`, `enable_scheduled_*`, `on_demand_*_minutes`, `minimum_lead_time`, `pickup_interval`, `enable_same_day_delivery`), custom ETA strings, VAT (`enable_vat`, `vat_rate`, `remove_delivery_charge_from_vat`), `disable_cash`, `minimum_order_pickup`, busy flags, banner, car info (`ask_for_car_info`, `make/color/plate_is_required`), `country`, `area`, `sort_order`.
- **`/branches/areas/`**: **each area's `id` is THE `area_id`** used on create/quote/addresses (a branch-delivery-charge id — never a raw area id). Carries `branch_id, name, ar_name, country{name,ar_name}, province{…}, delivery_rate, minimum_order_value, delivery_minutes`. Can transiently 500 on cold concurrent hits — retry once, degrade gracefully.
- **`/countries/`** → `[{id, name, ar_name, alpha_2_code, dial_code, flag, currency, currency_local, currency_iso, currency_decimals, timezone, enable_offline_payments}]`. Sorted by merchant order; **first entry is the store's base country** — use it as the "home country" instead of hardcoding, and to drive the checkout phone dial code.
- **`/currencies/`** → `{ enabled, currencies:[{iso, symbol, symbol_ar, decimals, rate, is_base}] }`. Base is first with `rate:1, is_base:true`. `enabled:false` ⇒ `currencies:[]`. Gate any currency UI on `enabled` / `config.enable_currency_converter`. Rates are platform-provided, cached ~1h. **Do not hardcode exchange rates.**

**Display conversion**: pass `?currency=<iso>` to catalog / areas / order endpoints and the backend
returns converted amounts. **Orders are always charged in the base currency** regardless — conversion is
display-level only. Format decimals from the currency's `decimals` (KWD/BHD/OMR = 3, most others = 2).

---

## 5. Catalog: categories, products, detail

| Method | Path | Purpose |
|---|---|---|
| GET | `/categories/?branch_id={id}&with_products=8&channel=web&order_type=&category_id=&search=&currency=` | Hierarchy + bounded home-row products |
| GET | `/categories/smart/?branch_id={id}&channel=web&order_type=&currency=` | **Newest.** Virtual categories |
| GET | `/products/?page={n}&limit={n}&branch_id={id}&channel=web&category_id=&search=&order_type=&type_of_product=&product_id=&booking_from=&currency=` | Paginated catalog |
| GET | `/product/?product_id={id}&branch_id={id}&currency=` | Full product notation |
| GET | `/filters/?branch_id=&category_id=&currency=` | Filter definitions + ranges |
| POST | `/products/filter/` | Filtered product query (accepts `?currency=`) |
| POST | `/products/recommendations/` | Algorithm recommendations (accepts `?currency=`) |
| GET | `/products/cross_selling/?product_id={id}&branch_id={id}&currency=` | Merchant-curated related products |

- **Categories**: build one map by id; render sorted top-level only (skip `is_child` at the top — it duplicates); resolve children from `sub_categories[]`. A parent has **either** direct products **or** subcategories, never both. Honor `no_mingling` (cart may only hold items from that one category). A category image may fall back to an embedded product photo. Slug from API `slug` → English name → id.
- **Smart categories** (`/categories/smart/`): blocks `[{key: most_selling|newest|discounted, name, ar_name, sort_order, photo, show_cover, products_count, products:[short], gallery:[url]}]`. Only enabled blocks returned; empty ⇒ none on (fail closed). `gallery` lets listing cards offer an in-card carousel without a detail call.
- **Product list = short notation.** Always pass `branch_id` (stock is per-branch). Hide `is_variant` children; show parents (`has_variants`). Sort by `sort_order`. Paginate via `has_next_page` / `meta.has_next_page` — don't guess from array length.
- **Product detail = long notation.** Fetch before opening a modal — short notation lacks options, extra_fields, booking_slots, gallery, variant_keys, description, nutrition, and qty limits. It uses `product_type` (list uses `type_of_product` — read `product.product_type || product.type_of_product`). `description`/`ar_description` are HTML — sanitize then render.
- **`/filters/`** → `{filter_list:[{id, name, ar_name, type (int), options:[{id, name, ar_name, sort_order}]}], price_range:{min,max}, nutrition_fact:{…:[min,max]}}`. 400 when filter&sort disabled.
- **`/products/filter/`** body: `{branch_id, channel?, order_type?, categories:[ids], filter_options:[option ids], price_range:[min,max], nutritional_fact?, sort ("price-asc"/"price-desc"/"name-asc"/"name-desc"), page, limit}`. **`filter_options` is an array of integer option ids** from `/filters/` — not `{key:[values]}`.

```ts
type ProductShort = {
  id: number; category_id: number; category_name: string; category_ar_name: string;
  name: string; ar_name: string; slug?: string;
  price: number; striked_price: number | null; least_price?: number;
  photo?: string | null; photo_thumb?: string | null; photo_small?: string | null; photo_medium?: string | null;
  type_of_product: "produced" | "stocked" | "bookable" | "digital" | "composite";
  inventory_on_hand: number | null; buyable: boolean;
  has_variants: boolean; is_variant: boolean; has_required_options?: boolean;
  min_addable_quantity?: number; sort_order: number;
};
```

**Availability & pricing**: only `stocked` products go OOS.

```ts
function isOutOfStock(p: { product_type?: string; type_of_product?: string; inventory_on_hand?: number | null; allow_preordering?: boolean }) {
  const type = p.product_type || p.type_of_product;
  if (type !== "stocked") return false;
  return (p.inventory_on_hand ?? 0) <= 0 && !p.allow_preordering;
}
```

Also respect `buyable`, min/max quantities, `increments`, and required options. Treat `striked_price`
as display-only (show only when `> price`; real discounts come from promotions). If a configurable
product's base price is 0, derive a verified "Starting from" value from `least_price`, variants, or
required options. Prefer the right CDN size (thumb=cart, small=cards, medium=galleries) with fallbacks.

---

## 6. Variants, options, extra fields, booking slots (long notation only)

- **Variants**: the parent's `variant_keys[]` names dimensions; each child's `variant_values[]` maps them. Render color-like keys (`/colou?rs?/i`) as image swatches, others as text chips; cross-filter incompatible values. If a parent has variants, fetch required child long notations in parallel and cache by `branchId:productId`. Resolve only when all selected key/value pairs match a child; use the resolved **child's** price/image/availability/options. **Order the child id** (`resolvedVariant?.id ?? product.id`) — parents are rejected.
- **Options**: sort options **and** choices by `sort_order`. `multiple:false` = checkbox (0/1); `multiple:true` = stepper capped by `choice.maximum`. Enforce `option.minimum` (required) and `option.maximum` (total). Preselect choices with `preselected > 0`. Payload: `options: [{id: <choiceId>, quantity}]` — **objects, not bare ints** (bare int arrays 500 the backend).
- **Extra fields** (`text`/`file`/`checkbox`): sort by `sort_order`; a `file` value must be a **URL string** — upload via `POST /upload/` first, store `file_url` (`String(fileObject)` = `"[object File]"`). Payload: `extra_fields: [{id, value}]`.
- **Booking slots**: detect bookable by `booking_slots.length > 0`, not `product_type` alone (composite products carry slots). Group by date, skip `inventory <= 0`, show 12-hour times. Payload: item-level `booking_slot_id`.

---

## 7. Cart, checkout, and orders (the money path)

### Cart identity

Same product + different option selections = **separate cart lines**. Derive a stable line id from
product id + sorted option choice ids + quantities. Persist locally, but revalidate availability and
totals through a `dry_run` before enabling final submit. Line total:

```text
(product/variant price + sum(option price × option quantity)) × product quantity
```

### Checkout resources

Load areas + payment methods lazily when checkout opens; filter areas by the eligible branch. If exactly
one valid payment method exists, preselect it and omit the chooser. Offer sign-in as an alternative to
manual customer entry; authenticated orders carry the server-held customer token.

Filter payment methods: `branch.disable_cash` removes cash; any cart item `cash_only` ⇒ only cash; any
`credit_only` ⇒ only online; a gift with `disable_cash_for_gift` ⇒ drop `cash`/`kod`. Offline methods
(`cash`, `kod`) omit `success_url`/`fail_url`; online methods require them; `tap_v2_credit` needs `tap_credit_token`.

### Fulfillment (client-computed — no scheduling endpoint)

`fulfillment_date` + `fulfillment_slot_start` + `fulfillment_slot_end` (end after start), computed from
**branch** working hours. ASAP uses `on_demand_*_minutes` + `minimum_lead_time`; scheduled delivery uses
`branch.scheduled_delivery_slots`; scheduled pickup is generated from `pickup_working_hours` +
`pickup_interval`. Factor in preorder `preordering_leadtime`.

### Order payload (`POST /order/create/`)

```json
{
  "branch_id": 1126,
  "is_delivery": true,
  "fulfillment_date": "2026-07-21",
  "fulfillment_slot_start": "10:00",
  "fulfillment_slot_end": "12:00",
  "customer": { "name": "Test Customer", "phone": "+96550000000", "email": "test@example.com" },
  "delivery_address": {
    "area_id": 1, "block": "1", "street": "Example Street", "building": "10",
    "floor": "2", "apartment": "4", "additional": "Opposite the park"
  },
  "items": [
    { "id": 123, "quantity": 2, "options": [{ "id": 456, "quantity": 1 }],
      "extra_fields": [{ "id": 789, "value": "Happy Birthday" }],
      "special_requests": "", "booking_slot_id": null }
  ],
  "payment_method": "cash",
  "success_url": "https://shop.example.com/order/return?status=success",
  "fail_url": "https://shop.example.com/order/return?status=fail",
  "language": "english",
  "special_remarks": "",
  "dry_run": true
}
```

- `area_id` is the id from `/branches/areas/` (saved addresses return `branch_delivery_charge_id` — send that as `area_id`). Omit `delivery_address` for pickup.
- `id` is the variant **child**/standalone id, never a parent. Item note = `special_requests`; order note = `special_remarks`.
- **Promotions**: `smartPromotionsDiscounts` (auto-applied) and `manuallyAppliedPromotion` (coupon) — see §8.
- **Account funding** (needs `X-Customer-Token`): `use_customer_wallet` (1:1, applied first) then `use_customer_points` (converted, remainder). Payment/discount waterfall: smart promos → coupon → wallet → points → `payment_method`.
- **Gifts**: `is_gift, gift_recipient_name, gift_recipient_number, gift_message, gift_link, send_gift_anonymously, unknown_gift_recipient_location` (each gated on the matching config flag; `unknown_gift_recipient_location:true` ⇒ only `area_id` needed). `gift_wrapping` is display-only client-side — the backend sets it.
- Derive return URLs from the storefront origin (`NEXT_PUBLIC_SITE_URL`), not the API origin.
- **Delivery is priced server-side** and cannot be overridden. In-country = `area.delivery_rate`; cross-border (when `enable_international_delivery`) = quote via `POST /order/international_quote/ {area_id, items:[{id,quantity}]}` → `{shipping_charge, country}` (debounce ~500ms; display-only, create recomputes it).
- Send `dry_run: true` first; render field/global errors; read a coupon's server-computed `discount_total` off the dry-run (it returns **no** final total and **no** payment link — compute the displayed total yourself). Submit the real mutation only from the shopper's final confirmed action; handle online-payment redirect, success, failure, cancel, refresh, and duplicate-return idempotently.

### Order tracking (`GET /order/?tracking_id={code}`, accepts `?currency=`)

May return the order directly, under `data`, or as the **first element of an array** — unwrap
`Array.isArray(data) ? data[0] : (data ?? res)`. Fields include a real `status`
(`New POS` / `Received` / `Preparing` / `Driver Pending` / `Out for Delivery` / `Complete` /
`Cancelled` / `Refunded`), `total, delivery_rate, discount_total, var_rate` (**API typo for `vat_rate`**),
`vat_amount, vat_with_product_price, currency, payments[], delivery_address|pickup_address, is_gift + gift_*,
placed, expected_delivery_date_time, tracking_link, branch_id/name(_ar), customer, items[]`. Don't cache
tracking. The create response is thin (`{tracking_id, payment_link?}`) — merge your checkout payload into
local history so the tracker has customer details before the first live fetch.

`GET /orders/` returns the signed-in customer's history (`X-Customer-Token`), newest first.

---

## 8. Promotions and coupons (`GET /promotions/?branch_id=`)

Active offers, **pre-filtered server-side** by schedule/channel/usage/branch — render as-is; don't
re-schedule client-side. Pass `?branch_id=` on branch-based stores; re-fetch on branch switch. Filter out
`hide_promotion` from carousels.

Promotion item: `{id (SmartPromotion id), name, ar_name, discount_description(_ar), code (null=auto-applied),
conditions:[{type, value}] (type:"points" ⇒ loyalty promo), discounts:[{id, type, value}] (what it grants),
loyalty_points_cost, banner(_small), background_color, expiry, show_expiry, remaining, show_remaining,
repeatable, quantity_per_user, user_quantity_used, excluded_products/categories/modifiers, hide_promotion,
bypass_minimum_order, apply_for_cash, max_discount_amount, auto_add_free_products, isSmartPromo}`.

Two application paths on `POST /order/create/`:

- **Auto-applied / smart** → `smartPromotionsDiscounts`: a map keyed by discount `type`, values `[{ id: promo.discounts[].id, promo: promo.id }]`.
- **Coupon code** → `manuallyAppliedPromotion: { code, id? }`.

`conditions[].type === "points"` marks a **loyalty promotion** costing `loyalty_points_cost` points —
require explicit opt-in, offer only to a logged-in customer with enough points (distinct from the generic
`use_customer_points`). The backend re-validates everything and recomputes the amount; read the cart's
value from a `dry_run` `discount_total`. Amounts are never final client-side.

---

## 9. Customer authentication and accounts

Use **server** route handlers. Auth **`mode` is an integer: `0` = sign-up, `1` = log-in** (not strings).

| Action | Phone | Email |
|---|---|---|
| Login/register | `/auth/phone/` | `/auth/email/` |
| Verify code | `/auth/phone/verify/` | `/auth/email/verify/` |
| Forgot password | `/auth/forgot-password/phone/` | `/auth/forgot-password/` |

Auth returns either `{token}` (verified) or `{verify:true}` (a code was sent → call the matching
`/verify/` with `{email|phone, code}` → `{token}`). Store the token in a secure, HTTP-only,
`SameSite=Lax` cookie; attach it server-side as `X-Customer-Token`; never expose it to client JS.
Preserve a validated relative `next` path through auth (reject external redirect targets).

Account endpoints: `GET /auth/me/` (`{id, name, phone, email, verified, provider, points, total_points,
opt_in_marketing}`), `POST /auth/profile/` (phone matching a guest **promotes** it, merging order
history), `GET /auth/wallet/`, `GET /auth/points/`, `GET/POST /auth/addresses/` + `/edit/` `/delete/`
`/preferred/` (added addresses carry `branch_delivery_charge_id` → send as `area_id`), `POST /auth/logout/`,
`POST /auth/delete/`. Guests are first-class — build flows for both guest and signed-in.

---

## 10. Reviews, stock, recommendations, pages, banners

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/feedback` (`?product_id=`) | Reviews. GET returns approved only; `{rating (0–5\|null), comment, name}`. POST `{rating, comment?, customer_name?, phone_number?, product_id?, order_id?}` — **moderated** (success ≠ visible); 403 when that review type is disabled. Note GET `name` vs POST `customer_name` |
| POST | `/stock/notification/` | `{email, product_id, branch_id}` — `branch_id` required (stock is per-branch) |
| POST | `/products/recommendations/` | `{ids:[…], branch_id?, exclude?}` → short products; empty/403 when disabled |
| GET | `/products/cross_selling/` | Merchant-curated related → short products |

Recommendations/cross-sells return short-notation products — open the modal before adding (they may have
required options), except when `show_quick_add_to_cart && !has_variants && !OOS`; exclude cart items.

- **Static pages** (`GET /pages/`): `{title, title_ar, content (HTML), content_ar, placement, window_type, checkable, custom_text(_ar)}`. No id/slug — route by slugified title. `placement` 0=footer, 1=nav, 2=checkout-agreement (a `checkable` checkbox that gates the order). Compare `placement` loosely (number or string). Sanitize HTML.
- **Popup banners**: inside `GET /config` as `popup_banner`, gated by `enable_popup_banner` — already time/channel-filtered server-side. `{id (dismissal key), type, image, title(_ar), content(_ar) (HTML), redirect_link, window_mode (0 modal|1 full-screen), autoclose, autoclose_timer (s), is_b2b}`. Track dismissal by `id` in localStorage. Sanitize HTML.

---

## 11. Caching and efficiency

Suggested starting TTLs:

| Data | TTL |
|---|---:|
| Config, branches, static pages, countries, currencies | 1 hour |
| Categories | 5 minutes |
| Products and product detail | 2 minutes |
| Promotions | short (schedule-sensitive) |
| Sitemap crawl | 24 hours |

Rules:

- Fetch config, branches, categories, pages (and countries/currencies) once on the server and seed the client provider.
- Use `categories?with_products=8` for bounded home rows; do not fetch every category separately.
- Never call the API in a loop — use `Promise.all`. Batch (`/branches/areas/ {branch_ids}`, `/products/?product_id=1,2,3`). Debounce search 400ms. Never poll (tracking = fetch on load + manual refresh).
- Fetch long notation (`/product/`) only on product open; cache per `(branchId, productId)`.
- Paginate grids; keep filtering server-backed where supported; cache by all query dimensions (especially branch + `currency`).
- On branch switch, clear only branch-sensitive caches (product detail, variant children) and re-fetch products + categories; keep config/payments/areas/reviews.
- Never cache customer sessions, authenticated responses, order mutations, or tracking in a shared cache.

---

## 12. Safe verification

- Use a dedicated test store + its `StorePublicToken`; read-only where possible.
- Use clearly fake customer data and `dry_run: true` for checkout validation. Never submit a real order, send a real notification, or publish feedback without explicit user authorization.
- Verify money paths with a **real** test order (cash method) then `GET /order/?tracking_id=` — check `delivery_rate`, `status`, totals, `currency`.
- Test: config, branch, category, first product page, one full product, areas, payment methods, currencies/countries, one promotion.
- Test edge cases: empty arrays, alternate response nesting, 400 validation, 401/403, 404 product, 429, 5xx, Arabic + long titles + missing images.
- Confirm the browser receives no API key or customer token.

---

## 13. Cross-cutting gotchas

1. Trailing slashes always — 301 hops can drop `Authorization`.
2. API key + customer token are **server-only**; never `NEXT_PUBLIC_`, never in client JS.
3. `area_id` = the id from `/branches/areas/` (branch-delivery-charge), never a raw area id.
4. Variant **parents** are browsable but never purchasable — order the child id.
5. Product type: `type_of_product` (lists) vs `product_type` (detail) — read both.
6. `inventory_on_hand` may be `null` for a 0-stock stocked item — `?? 0`.
7. Item note = `special_requests`; order note = `special_remarks`.
8. Order `var_rate` is an API typo for `vat_rate`.
9. Auth `mode` is an **integer** (`0` sign-up / `1` log-in), not a string.
10. `filter_options` is an array of integer option ids, not `{key: [values]}`.
11. Options in the order are `[{id, quantity}]` objects — bare int arrays 500 the backend.
12. `file` extra-field values must be uploaded URLs, not `File` objects.
13. `dry_run` returns before pricing / payment link — verify amounts with a real test order.
14. `?currency=` gives converted **display** amounts; orders are always **charged in base currency**.
15. All money (discounts, wallet/points, delivery, VAT, conversion) is server-authoritative; client math is display-only.
16. Feature flags absent from `/config` ⇒ treat as OFF (fail closed).
17. Reviews are moderated — a successful POST isn't visible in GET until approved.
