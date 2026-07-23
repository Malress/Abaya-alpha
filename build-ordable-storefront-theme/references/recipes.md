# ordable/ storefront implementation recipes

Working code for the stateful, edge-case-heavy flows where reinventing the logic tends to introduce
bugs — especially on the money path. The **contract** (endpoints, fields, flags) lives in
[api.md](api.md); the **design system** lives in [theming.md](theming.md). This file is the cookbook.

Snippets are framework-neutral JS/TS. Adapt naming to the project, but preserve the **logic and
ordering** — the traps are called out with `⚠️`. All money is server-authoritative; everything here is
preview/UX only until a `dry_run` or real order confirms it.

## Contents

1. Shared helpers (fetch, unwrap, formatters, OOS)
2. Boot sequence and caching
3. Category tree (top-down, dedup-safe)
4. Variant resolution and cross-filtering
5. Options: state, validation, pricing, payload
6. Extra fields: upload, validation, payload
7. Cart: validation pipeline, dedup, line pricing
8. Fulfillment slot computation (ASAP + scheduled)
9. Price breakdown: VAT, delivery, gift wrapping, currency
10. Promotions: build + dry-run for the real discount
11. Gift checkout: decision tree and payload
12. Order create + tracking unwrap + local history
13. Popup banner dismissal/queue

---

## 1. Shared helpers

```js
// Server-side these run with the real key; client-side they hit your allowlisted proxy.
async function apiFetch(path, { method = 'GET', body, headers, customerToken } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: API_KEY,                                    // server-only
      ...(customerToken ? { 'X-Customer-Token': customerToken } : {}),
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), // NEVER set for FormData
      ...headers,
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) throw new Error(json?.message || json?.detail || `API ${res.status}`)
  return json
}
const get  = (p, o) => apiFetch(p, o)
const post = (p, body, o) => apiFetch(p, { method: 'POST', body, ...o })

const unwrapList = (r) => Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data
  : Array.isArray(r?.data?.data) ? r.data.data : []

// Currency-aware money formatter. Feed it a currency from GET /currencies/ (or the base country).
// ⚠️ Do NOT hardcode exchange rates — pass ?currency= to the API and format the returned amount.
function money(amount, { symbol = 'KWD', decimals = 3, isAR = false, symbolAr } = {}) {
  if (amount == null) return ''
  return `${parseFloat(amount).toFixed(decimals)} ${isAR ? (symbolAr || symbol) : symbol}`
}

// ⚠️ API returns 24h; ALL user-facing times must be 12h.
function formatTime12h(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// ⚠️ inventory_on_hand can be null for a 0-stock stocked item — always ?? 0.
function isOOS(p) {
  const type = p.product_type || p.type_of_product   // ⚠️ list=type_of_product, detail=product_type
  if (type !== 'stocked') return false
  return (p.inventory_on_hand ?? 0) <= 0 && !p.allow_preordering
}

// ⚠️ language state is uppercase 'EN'/'AR'; fall back to the other so nothing renders blank.
const t = (en, ar, lang) => (lang === 'AR' ? (ar || en) : (en || ar)) || ''

// Standardize a phone to international format before sending.
function cleanPhone(phone, dialCode = '+965') {
  let c = String(phone).trim().replace(/[\s\-()]/g, '')
  if (c.startsWith('00')) c = '+' + c.slice(2)
  else if (!c.startsWith('+')) c = `${dialCode}${c}`
  return c
}
```

---

## 2. Boot sequence and caching

```js
// Phase 1 paints the shell; Phase 2 loads catalog + checkout data; Phase 3 paginates products.
async function boot(sessionGet, sessionSet) {
  const [config, branches] = await Promise.all([
    get('/config/').then(r => r.data),
    get('/branches/').then(r => r.data || []),
  ])
  const branchId = branches[0]?.id
  const [categories, areas, payments, pages, promotions, currencies, countries] = await Promise.all([
    get(`/categories/?branch_id=${branchId}&with_products=8&channel=web`).then(r => r.data || []),
    post('/branches/areas/', { branch_ids: branches.map(b => b.id) }).then(r => r.data || []).catch(() => []), // ⚠️ can 500 cold — degrade
    get('/payment_methods').then(r => r.data || []),        // ⚠️ the one no-auth endpoint
    get('/pages/').then(r => r.data || []).catch(() => []),
    get(`/promotions/?branch_id=${branchId}`).then(r => r.data || []).catch(() => []),
    get('/currencies/').then(r => r.data).catch(() => ({ enabled: false, currencies: [] })),
    get('/countries/').then(r => r.data || []).catch(() => []),
  ])
  const products = await fetchAllProducts(branchId)
  return { config, branches, branchId, categories, areas, payments, pages, promotions, currencies, countries, products }
}

async function fetchAllProducts(branchId, currency) {
  const all = []; let page = 1
  const cur = currency ? `&currency=${currency}` : ''
  while (true) {
    const res = await get(`/products/?page=${page}&limit=500&branch_id=${branchId}&channel=web${cur}`)
    all.push(...(Array.isArray(res.data) ? res.data : []))
    if (!res.has_next_page && !res.meta?.has_next_page) break   // ⚠️ flag can be top-level or in meta
    page++
  }
  return all
}

// On branch switch: clear ONLY branch-sensitive caches, re-fetch products + categories.
function onBranchSwitch(newId, caches) {
  caches.productDetail.clear()   // inventory differs per branch
  caches.variantChildren = {}    // variant stock differs per branch
  return Promise.all([ fetchAllProducts(newId), get(`/categories/?branch_id=${newId}&channel=web`).then(r => r.data) ])
  // KEEP: config, payments, areas (already batched all branches), reviews
}
```

---

## 3. Category tree (top-down, dedup-safe)

```js
// ⚠️ Never render is_child categories at the top level — they duplicate under their parent.
function buildCategoryTree(categories) {
  const byId = {}
  for (const c of categories) byId[c.id] = c
  const topLevel = categories.filter(c => !c.is_child).sort((a, b) => a.sort_order - b.sort_order)
  const childrenOf = (cat) => (cat.sub_categories || [])
    .map(id => byId[id]).filter(Boolean).sort((a, b) => a.sort_order - b.sort_order)
  return { topLevel, childrenOf }
}
// A parent has EITHER direct products OR subcategories, never both:
//   has_children && sub_categories.length  → render subcategory picker (its products list is empty)
//   else                                    → render category.products
```

---

## 4. Variant resolution and cross-filtering

```js
// Fetch children in parallel, cache by branchId:parentId. Children are products with
// parent_product_id === parent.id && is_variant. Fetch their LONG notation for options/stock.
async function getVariantChildren(parent, branchId, allProducts, cache, getDetail) {
  const key = `${branchId}:${parent.id}`
  if (cache[key]) return cache[key]
  const childIds = allProducts.filter(p => p.parent_product_id === parent.id && p.is_variant).map(p => p.id)
  const children = await Promise.all(childIds.map(id => getDetail(id, branchId)))
  cache[key] = children
  return children
}

const isColorKey = (name) => /colou?rs?/i.test(name)  // color → image swatches; else → text chips

// Which values remain selectable in each dimension given current selections in OTHER dimensions.
function availableValues(children, selections) {
  const avail = {}
  for (const child of children) {
    for (const vv of child.variant_values || []) {
      const otherOk = Object.entries(selections)
        .filter(([k]) => k !== vv.variant_key)
        .every(([k, v]) => child.variant_values?.find(x => x.variant_key === k)?.variant_value === v)
      if (otherOk) (avail[vv.variant_key] ||= new Set()).add(vv.variant_value)
    }
  }
  return avail  // dim incompatible chips/swatches using this
}

// Resolve to a concrete child once every dimension is chosen. ⚠️ Order the CHILD id, never the parent.
function resolveVariant(children, selections) {
  return children.find(child =>
    Object.entries(selections).every(([k, v]) =>
      child.variant_values?.find(x => x.variant_key === k)?.variant_value === v))
}
```

---

## 5. Options: state, validation, pricing, payload

```js
// State shape: { [optionId]: { [choiceId]: qty } }
// Sort options AND choices by sort_order. Initialize preselected choices.
function initSelectedOptions(options) {
  const sel = {}
  for (const opt of options) for (const c of opt.choices) if (c.preselected > 0) (sel[opt.id] ||= {})[c.id] = c.preselected
  return sel
}

// multiple:false = checkbox (toggle 0/1); multiple:true = stepper capped by choice.maximum.
// Enforce option.maximum (total across choices) and option.minimum (required).
function validateOptions(options, sel) {
  for (const opt of options) {
    const total = Object.values(sel[opt.id] || {}).reduce((s, q) => s + q, 0)
    if (opt.minimum > 0 && total < opt.minimum)
      return { valid: false, error: `Select at least ${opt.minimum} for "${opt.option_name}"` }
  }
  return { valid: true }
}

function optionsPrice(options, sel) {
  let total = 0
  for (const opt of options) for (const c of opt.choices) total += (c.price || 0) * (sel[opt.id]?.[c.id] || 0)
  return total
}

// ⚠️ Payload options are OBJECTS {id: choiceId, quantity} — bare int arrays 500 the backend.
function buildOptionsPayload(sel) {
  const out = []
  for (const [optId, choices] of Object.entries(sel))
    for (const [choiceId, qty] of Object.entries(choices)) if (qty > 0) out.push({ id: Number(choiceId), quantity: Number(qty) })
  return out
}
```

---

## 6. Extra fields: upload, validation, payload

```js
// ⚠️ A `file` field's value must be an uploaded URL string, not a File (String(File) === "[object File]").
async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)                              // images + PDF, ≤10 MB
  const res = await apiFetch('/upload/', { method: 'POST', body: form }) // ⚠️ don't set Content-Type
  if (!res?.success) throw new Error(res?.message || 'Upload failed')
  return res.file_url                                    // store THIS as the field value
}

function validateExtraFields(fields, values) {
  for (const f of fields) {
    if (!f.is_required) continue
    const v = values[f.id]
    if (!v || (typeof v === 'string' && !v.trim())) return { valid: false, error: `"${f.name}" is required` }
  }
  return { valid: true }
}

// Payload: [{id, value}] — checkbox → 'yes'/'', file → uploaded URL, text → string.
const buildExtraFieldsPayload = (values) =>
  Object.entries(values).filter(([, v]) => v !== '' && v != null).map(([id, v]) => ({ id: Number(id), value: String(v) }))
```

---

## 7. Cart: validation pipeline, dedup, line pricing

```js
// ⚠️ Validate in THIS order before adding. `target` is the resolved variant child, else the product.
function validateAddToCart({ product, resolvedVariant, selOpts, selXFields, selSlot }, cartItems, categories) {
  const errors = []
  const target = resolvedVariant || product

  // 1. variant resolved?
  if (product.has_variants && !resolvedVariant) return ['Please select all variant options']
  // 2. option minimums
  for (const opt of (target.options || [])) {
    const total = Object.values(selOpts[opt.id] || {}).reduce((s, q) => s + q, 0)
    if (opt.minimum > 0 && total < opt.minimum) errors.push(`Select at least ${opt.minimum} for "${opt.option_name}"`)
  }
  // 3. required extra fields
  for (const f of (target.extra_fields || [])) {
    const v = selXFields[f.id]
    if (f.is_required && (!v || (typeof v === 'string' && !v.trim()))) errors.push(`"${f.name}" is required`)
  }
  // 4. booking slot (detect by array presence, NOT product_type)
  if ((target.booking_slots?.length || 0) > 0 && !selSlot) errors.push('Please select a booking slot')
  // 5. no_mingling — cart may only hold items from that one category
  if (cartItems.length) {
    const cat = categories?.find(c => c.id === target.category_id)
    if (cat?.no_mingling && !cartItems.every(it => it.product.category_id === target.category_id))
      errors.push('This item cannot be mixed with items from other categories')
  }
  // 6. stock
  if ((target.product_type || target.type_of_product) === 'stocked'
      && (target.inventory_on_hand ?? 0) <= 0 && !target.allow_preordering) errors.push('This item is out of stock')

  return errors  // [] === valid
}

// Same product + identical selections → bump quantity, don't duplicate the line.
function addToCart(prev, newItem) {
  const same = (a, b) =>
    a.product.id === b.product.id && a.resolvedVariant?.id === b.resolvedVariant?.id &&
    JSON.stringify(a.selOpts) === JSON.stringify(b.selOpts) &&
    JSON.stringify(a.selXFields) === JSON.stringify(b.selXFields) &&
    JSON.stringify(a.selSlot) === JSON.stringify(b.selSlot)
  const idx = prev.findIndex(it => same(it, newItem))
  if (idx > -1) { const copy = [...prev]; copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + newItem.quantity }; return copy }
  return [...prev, newItem]
}

// Line = (base + options + priced extra fields) × qty.  base = variant price ?? product price.
function lineTotal(item) {
  const src = item.resolvedVariant || item.product
  const base = item.resolvedVariant?.price ?? item.product.price
  const opts = optionsPrice(src.options || [], item.selOpts || {})
  const xf = (src.extra_fields || []).reduce((s, f) => s + (item.selXFields?.[f.id] && f.price > 0 ? f.price : 0), 0)
  return (base + opts + xf) * (item.quantity || 1)
}
```

---

## 8. Fulfillment slot computation (ASAP + scheduled)

⚠️ There is no scheduling endpoint. Compute from **branch** working hours (not store config). `end`
must be after `start`.

```js
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

function computeFulfillmentASAP(area, branch, cartItems, isDelivery = true) {
  const now = new Date()
  const lead = isDelivery ? (area?.delivery_minutes || branch.on_demand_delivery_minutes || 0)
                          : (branch.on_demand_pickup_minutes || 0)
  now.setMinutes(now.getMinutes() + Math.max(lead, branch.minimum_lead_time || 0))

  let date = fmtDate(now), start = '', end = ''
  const hours = isDelivery ? branch.delivery_working_hours : branch.pickup_working_hours
  const day = now.getDay()                                   // 0=Sunday
  const today = hours?.find(h => h.day === day)

  if (!today) {                                              // closed today → next open day
    for (let i = 1; i <= 7; i++) {
      const nh = hours?.find(h => h.day === (day + i) % 7)
      if (nh) { const d = new Date(now); d.setDate(d.getDate() + i); date = fmtDate(d); start = nh.start; end = nh.end; break }
    }
  } else {
    const [oH, oM] = today.start.split(':').map(Number), [cH, cM] = today.end.split(':').map(Number)
    const cur = now.getHours()*60 + now.getMinutes(), openM = oH*60+oM, closeM = cH*60+cM
    if (cur >= closeM || cur < openM) {                      // outside hours → tomorrow's opening
      const tm = new Date(now); tm.setDate(tm.getDate() + 1); date = fmtDate(tm); start = today.start; end = today.end
    } else {                                                 // during hours → ASAP window
      start = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      const e = new Date(now); e.setHours(e.getHours() + 3)
      end = `${String(Math.min(cH, e.getHours())).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`
    }
  }

  // preorder lead time pushes the date out
  const maxLead = Math.max(0, ...cartItems.map(it => (it.resolvedVariant || it.product).allow_preordering ? ((it.resolvedVariant || it.product).preordering_leadtime || 0) : 0))
  if (maxLead > 0) {
    const d = new Date(); d.setDate(d.getDate() + maxLead); date = fmtDate(d)
    const fh = hours?.find(h => h.day === d.getDay()); start = fh?.start || '09:00'; end = fh?.end || '22:00'
  }
  return { fulfillment_date: date, fulfillment_slot_start: start, fulfillment_slot_end: end }
}

// Scheduled delivery: branch.scheduled_delivery_slots ({day,start,end}); skip today if !enable_same_day_delivery.
function buildScheduledDeliverySlots(branch, days = 14) {
  const out = [], today = new Date()
  for (let off = 0; off < days; off++) {
    const d = new Date(today); d.setDate(d.getDate() + off)
    if (off === 0 && !branch.enable_same_day_delivery) continue
    for (const s of (branch.scheduled_delivery_slots || []).filter(x => x.day === d.getDay())) {
      if (off === 0) {
        const [h, m] = s.start.split(':').map(Number)
        if (h*60+m < today.getHours()*60 + today.getMinutes() + (branch.minimum_lead_time || 0)) continue
      }
      out.push({ date: fmtDate(d), start: s.start, end: s.end,
        label: `${fmtDate(d)} ${formatTime12h(s.start)} - ${formatTime12h(s.end)}` })
    }
  }
  return out
}

// Scheduled pickup: split pickup_working_hours into branch.pickup_interval-minute slots.
function buildPickupSlots(branch, days = 7) {
  const out = [], today = new Date(), step = branch.pickup_interval || 30
  for (let off = 0; off < days; off++) {
    const d = new Date(today); d.setDate(d.getDate() + off)
    for (const h of (branch.pickup_working_hours || []).filter(x => x.day === d.getDay())) {
      const [sH, sM] = h.start.split(':').map(Number), [eH, eM] = h.end.split(':').map(Number)
      let cur = sH*60+sM; const close = eH*60+eM
      while (cur + step <= close) {
        if (!(off === 0 && cur < today.getHours()*60 + today.getMinutes() + (branch.minimum_lead_time || 0))) {
          const f = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
          out.push({ date: fmtDate(d), start: f(cur), end: f(cur + step) })
        }
        cur += step
      }
    }
  }
  return out
}
```

---

## 9. Price breakdown: VAT, delivery, gift wrapping, currency

⚠️ Display only — the order always charges the server's computed amounts. VAT is **branch-level**.

```js
function calculateVAT(base, deliveryRate, cartItems, branch) {
  if (!branch.enable_vat) return 0
  let vatBase = branch.remove_delivery_charge_from_vat ? base : base + deliveryRate
  const exempt = cartItems.filter(it => (it.resolvedVariant || it.product).exclude_from_vat)
    .reduce((s, it) => s + (it.resolvedVariant?.price ?? it.product.price) * (it.quantity || 1), 0)
  return Math.max(0, vatBase - exempt) * (branch.vat_rate || 0)
}

function orderTotals({ cartItems, area, branch, discount = 0, isGift, giftWrapped, config }) {
  const subtotal = cartItems.reduce((s, it) => s + lineTotal(it), 0)
  const delivery = area?.delivery_rate || 0                              // pickup → pass 0 (or use quote for intl)
  const giftWrap = (isGift && giftWrapped && config.enable_gift_wrapping) ? (config.gift_wrapping_price || 0) : 0
  const afterDiscount = subtotal - discount
  const vat = calculateVAT(afterDiscount, delivery, cartItems, branch)  // 0 when disabled/included
  return { subtotal, discount, delivery, giftWrap, vat, total: afterDiscount + delivery + giftWrap + vat }
}
// Multi-currency: fetch amounts with ?currency= and format with that currency's {symbol,decimals}
// from GET /currencies/. The ORDER is still charged in base currency — conversion is display-only.
```

---

## 10. Promotions: build + dry-run for the real discount

```js
// Auto-applied smart promos → smartPromotionsDiscounts, keyed by discount type.
// id = promo.discounts[].id (SmartPromotionDiscount), promo = promo.id (SmartPromotion).
function buildSmartPromotions(promotions) {
  const map = {}
  for (const p of promotions) for (const d of (p.discounts || [])) (map[d.type] ||= []).push({ id: d.id, promo: p.id })
  return Object.keys(map).length ? map : null
}

// GET /promotions/ describes WHAT an offer grants, not its KWD value for THIS cart.
// dry_run an order with the promo attached and read discount_total. Debounce ~500-800ms; re-run
// when cart / area / payment method changes; require a resolved area for delivery orders.
async function getCartDiscount(basePayload, { smartPromotions, couponCode }) {
  const payload = {
    ...basePayload, dry_run: true,
    ...(smartPromotions ? { smartPromotionsDiscounts: smartPromotions } : {}),
    ...(couponCode ? { manuallyAppliedPromotion: { code: couponCode } } : {}),
  }
  const res = await post('/order/create/', payload)         // throws on invalid/ineligible coupon
  return res?.data?.discount_total ?? res?.discount_total ?? 0
}
// ⚠️ Filter hide_promotion out of carousels. type:"points" conditions = loyalty promo costing
// loyalty_points_cost — logged-in + enough points only; distinct from use_customer_points.
```

---

## 11. Gift checkout: decision tree and payload

```js
// Gate EVERYTHING on config.enable_gifts first. Each sub-feature has its own flag.
function giftPayload(isGift, config, g, dialCode) {
  if (!isGift) return {}
  return {
    is_gift: true,
    gift_recipient_name: g.recipientName,                                 // required if enable_force_gift_name_number
    gift_recipient_number: cleanPhone(g.recipientPhone, dialCode),
    ...(config.enable_gifts_message_form && g.message ? { gift_message: g.message } : {}),
    ...(config.enable_gift_links && g.link ? { gift_link: g.link } : {}),
    ...(config.enable_send_gift_anonymously ? { send_gift_anonymously: !!g.anonymous } : {}),
    ...(config.enable_unknown_gift_recipient_location ? { unknown_gift_recipient_location: !!g.unknownLocation } : {}),
    // ⚠️ unknown_gift_recipient_location:true → only area_id required (hide block/street/building).
    // ⚠️ gift_wrapping is display-only client-side; backend sets it. Add gift_wrapping_price to the shown total.
  }
}
function giftPayments(methods, isGift, config) {           // disable_cash_for_gift drops cash/kod on gifts
  return (isGift && config.disable_cash_for_gift) ? methods.filter(m => !['cash', 'kod'].includes(m.value)) : methods
}
```

---

## 12. Order create + tracking unwrap + local history

```js
async function submitOrder(payload, { customerToken } = {}) {
  const dry = await post('/order/create/', { ...payload, dry_run: true }, { customerToken })
  if (dry?.success === false) throw new Error(dry.message || 'Validation failed')   // show, don't submit
  const res = await post('/order/create/', payload, { customerToken })
  const link = res?.data?.payment_link || res?.payment_link || res?.data?.payment_url
  if (link) { saveOrder({ ...res.data, ...payload }); return { redirect: link } }   // online → redirect
  saveOrder({ ...res.data, ...payload })                                            // ⚠️ merge payload — response is thin
  return { order: res.data || res }
}

// ⚠️ GET /order/?tracking_id= may return the order directly, under data, or as data[0].
function unwrapOrder(res) {
  const d = res?.data ?? res
  return Array.isArray(d) ? d[0] : d
}

const HISTORY_KEY = 'ordable_my_orders'
function saveOrder(order) {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    const id = order.tracking_id || order.tracking_code || order.id
    const i = list.findIndex(o => (o.tracking_id || o.tracking_code || o.id) === id)
    if (i === -1) list.unshift(order); else list[i] = order
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch {}
}
```

---

## 13. Popup banner dismissal/queue

```js
// popup_banner arrives inside GET /config, gated by enable_popup_banner, already time/channel-filtered.
const DISMISS_KEY = 'ordable_dismissed_popups'
const getDismissed = () => { try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]') } catch { return [] } }
function markDismissed(id) {
  const ids = getDismissed()
  if (id != null && !ids.includes(id)) { ids.push(id); localStorage.setItem(DISMISS_KEY, JSON.stringify(ids)) }
}
const pickBanner = (banners) => banners.find(b => !getDismissed().includes(b.id)) || null

// Closing one records it, then swaps the next undismissed banner into the same modal (queue).
function handleClose(banner, banners, setBanner, setOpen) {
  markDismissed(banner?.id)
  const next = banners.find(b => !getDismissed().includes(b.id))
  if (next) setBanner(next); else setOpen(false)
}
// window_mode 0=centered (click-outside dismisses), 1=full-screen (close button only).
// autoclose + autoclose_timer(seconds); content is HTML — sanitize.
```
