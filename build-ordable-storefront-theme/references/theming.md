# Ordable storefront theming reference

Use this reference to turn the API contract into a coherent, responsive, bilingual shopping
experience. Adapt the visual language to the store instead of reproducing the Supplies styling.

## Contents

1. Theme brief and visual direction
2. Token system
3. Page and component coverage
4. Responsive behavior
5. English and Arabic
6. Interaction and state design
7. Accessibility and content resilience
8. Visual verification

## 1. Theme brief and visual direction

Before styling, establish:

- Business type and product density.
- Shopper priorities: speed, discovery, gifting, trust, premium detail, or price comparison.
- Brand assets from `/config/`: English/Arabic names, logos, covers, colors, favicon, contacts,
  social links, and content pages.
- Two or three visual adjectives and one clear reference direction.
- Required locales and whether either is primary.

Translate those inputs into a specific visual system: type scale, image treatment, container width,
spacing rhythm, card shape, control style, surface depth, and motion character. Avoid generic
dashboard styling and decorative gradients unrelated to the brand.

## 2. Token system

Define tokens centrally and consume them everywhere:

```css
:root {
  --color-brand: #3d7a58;
  --color-brand-deep: color-mix(in srgb, var(--color-brand) 85%, black);
  --color-brand-soft: color-mix(in srgb, var(--color-brand) 14%, white);
  --color-discount: #e84949;
  --color-bg: #f4f5f7;
  --color-surface: #fff;
  --color-surface-subtle: #f8f9fa;
  --color-border: #e8eaed;
  --color-text: #1a1f2e;
  --color-text-secondary: #5c6478;
  --color-text-muted: #9ca3b0;
  --color-success: #2d8a5f;
  --color-error: #d94040;
  --shadow-sm: 0 1px 3px rgb(26 31 46 / 6%);
  --shadow-md: 0 4px 12px rgb(26 31 46 / 8%);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-pill: 999px;
  --container: 1400px;
  --space-page: clamp(16px, 3vw, 32px);
  --touch-target: 44px;
}
```

Apply verified `config.theme_color`, `theme_color_light`, and `discount_tag_color` at runtime, but
retain accessible fallbacks. Derive tints and shades instead of scattering hard-coded variants.
Compute or select a readable contrasting foreground; do not assume white works on every API color.

Use one Latin family and one Arabic-capable family with compatible weight and proportions. Keep
font loading optimized and ensure the fallback does not cause layout breakage.

## 3. Page and component coverage

Build a coherent system across the required journey.

### App shell

- Optional announcement bar.
- Sticky header with logo/name, real search, account, language, and cart count.
- Desktop primary navigation and mobile bottom navigation when it improves reachability.
- Cart drawer with wrapping titles, totals, quantity controls, checkout CTA, and focus management.
- Footer with contacts, store pages, social links, track-order link, and policies.

Keep the cart in the header on desktop and mobile; avoid a floating control that obscures content.

### Discovery

- Home: hero/banner, category discovery, curated or API-driven product rows, reviews only when data
  exists, and useful empty states.
- Categories: responsive visual grid with search/filter when the catalog warrants it.
- Shop/category: breadcrumb or consistent back affordance, search, active filters, sort, mobile
  filter drawer, results count, product grid, and load-more/pagination.

### Product cards

Use a stable vertical structure:

```css
.product-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}
.product-card__media { aspect-ratio: 1; overflow: hidden; }
.product-card__body { display: flex; flex: 1; flex-direction: column; }
.product-card__title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.product-card__actions { margin-top: auto; }
```

Keep equal card heights within a grid. Reserve space for prices/discounts, wrap names safely, make
the whole card navigable without nesting inaccessible controls, and keep `+`/`−` targets at least
40–44px. Display out-of-stock, sale, starting price, required-options, and add-confirmed states.

### Product detail

- Consistent back button and breadcrumb.
- Gallery with thumbnails/indicators, keyboard controls, alt text, and no mobile overlay trap.
- Name, price, strike price, availability, variant selectors, option groups, quantity constraints,
  special remarks, add/buy CTA, sanitized description, and cross-sells.
- On mobile, keep the gallery in normal document flow and ensure details remain reachable by
  scrolling. Any sticky CTA must reserve space and never cover required options.

### Cart and checkout

- Cart page and drawer must share line-item behavior and totals.
- Checkout should visibly offer sign-in/register before manual customer details.
- Present fulfillment mode, area, schedule, address, order summary, payment, validation, and final
  confirmation in a clear sequence.
- If one payment method exists, preselect it and omit the redundant selection UI.
- Use friendly area selection and date/time-slot cards or grouped controls rather than dense native
  selects when there are many options.
- Stack address fields to one column on narrow screens. Add `min-width: 0` to every grid/flex child
  containing inputs so fields cannot overflow their card.
- Provide dedicated payment return, success, failure, and retry states.

### Account and tracking

- Support phone/email sign-in, registration, verification, forgot password, loading, and errors.
- Keep the account control visible in desktop and mobile navigation.
- Center loading indicators inside their buttons; never position a spinner independently of the
  label container.
- Let order titles, tracking codes, and statuses wrap without breaking layout.

## 4. Responsive behavior

Start with the narrow layout and add space, not the reverse.

Suggested product grid:

```css
.product-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 768px) {
  .product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1100px) {
  .product-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
```

Use at most two product columns on a phone unless the brief explicitly requires compact density.
Cap primary browsing grids at four desktop columns when readability is more important than density.

For filters:

- Use a scrollable sticky sidebar on wide screens, constrained by the viewport/header height.
- Use a side drawer on mobile, opening from the logical inline end and reversing correctly in RTL.
- Trap focus, close on Escape/backdrop, restore trigger focus, and lock only background scrolling.

For horizontal category or product rails, make the rail itself scrollable and preserve page width.
Use `minmax(0, 1fr)`, `min-width: 0`, `overflow-wrap: anywhere`, and logical padding/margins to
eliminate overflow. Do not hide genuine layout overflow on `body` as a substitute for fixing it.

## 5. English and Arabic

Treat both locales as primary:

- Put `lang="ar" dir="rtl"` on the root for Arabic and use an Arabic-capable font such as Tajawal
  when it suits the brand.
- Centralize bilingual selection: `t(en, ar)` should fall back to the available string.
- Use `margin-inline`, `padding-inline`, `inset-inline`, `border-inline`, and `text-align: start`.
- Keep phone numbers, SKUs, prices, and tracking codes readable with local `dir="ltr"` where needed.
- Mirror directional chevrons/arrows, not universal icons such as cart, search, close, or plus.
- Define a reusable directional icon rule; do not hand-position each Arabic chevron.
- Use the same visual back-button component on PDP, category, auth, and account pages.
- Test mixed Arabic/English product names and long translations rather than only short labels.

## 6. Interaction and state design

Every asynchronous action needs:

- Idle, loading, success, disabled, and error states.
- Button-local progress that does not move the label unexpectedly.
- An add-to-cart confirmation on the button itself, plus updated cart count.
- Skeletons only when they improve perceived continuity; use clear empty states otherwise.
- Recovery actions for failed catalog loads, invalid options, checkout validation, and payment failure.

Keep motion brief and functional. Respect `prefers-reduced-motion`. Avoid animation that delays cart
or checkout actions.

## 7. Accessibility and content resilience

- Use semantic landmarks, headings, links, buttons, labels, fieldsets, and error associations.
- Maintain visible `:focus-visible` styles and logical tab order.
- Give icon-only controls accessible names and indicate expanded drawer/menu state.
- Use at least 44px touch targets for primary mobile controls.
- Ensure text/background and brand-button contrast remain readable after dynamic color overrides.
- Give product imagery meaningful alt text; decorative imagery gets empty alt.
- Sanitize rich product/static-page HTML and style the resulting prose without relying on source
  inline styles.
- Test missing photos, missing Arabic copy, very long names, zero/large prices, one/many payment
  methods, empty categories, and no reviews.

## 8. Visual verification

Verify real rendered pages, not only source code:

1. Run the local application with representative store API data.
2. Check 320×568, 390×844, 768×1024, 1024×768, and 1440×900.
3. Check both English/LTR and Arabic/RTL at mobile and desktop widths.
4. Exercise header search, filters, category navigation, PDP gallery/options, cart quantity, checkout
   address/area/time slot, auth, tracking, drawers, and payment return pages.
5. Inspect for horizontal overflow, clipped focus, overlapping sticky elements, unequal cards,
   unreadable dynamic colors, unexpected chevrons, and content hidden behind navigation.
6. Recheck keyboard-only use and reduced-motion mode.
7. Capture before/after screenshots for material visual changes and iterate until the layout is
   stable with real API content.
