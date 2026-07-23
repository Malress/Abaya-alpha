import type { Currency, Locale, ProductShort } from "./ordable/types";

export function formatMoney(
  amount: number,
  currency: Currency | undefined,
  locale: Locale,
): string {
  const decimals = currency?.decimals ?? 3;
  const symbol =
    locale === "ar" ? currency?.symbol_ar || currency?.symbol : currency?.symbol;
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = value.toFixed(decimals);
  // Symbol trails in Arabic, leads in English — kept simple and readable either way.
  return locale === "ar"
    ? `${formatted} ${symbol ?? ""}`.trim()
    : `${symbol ?? ""} ${formatted}`.trim();
}

// Only `stocked` products can be genuinely out of stock.
export function isOutOfStock(p: {
  product_type?: string;
  type_of_product?: string;
  inventory_on_hand?: number | null;
  allow_preordering?: boolean;
  buyable?: boolean;
}): boolean {
  if (p.buyable === false) return true;
  const type = p.product_type || p.type_of_product;
  if (type !== "stocked") return false;
  return (p.inventory_on_hand ?? 0) <= 0 && !p.allow_preordering;
}

export function isOnSale(p: { price: number; striked_price?: number | null }): boolean {
  return typeof p.striked_price === "number" && p.striked_price > p.price;
}

// Prefer the right CDN size with graceful fallbacks.
export function productImage(
  p: Partial<ProductShort>,
  size: "thumb" | "small" | "medium" = "small",
): string | null {
  const order =
    size === "thumb"
      ? [p.photo_thumb, p.photo_small, p.photo]
      : size === "medium"
        ? [p.photo_medium, p.photo, p.photo_small]
        : [p.photo_small, p.photo_medium, p.photo];
  return order.find((x): x is string => Boolean(x)) ?? p.photo ?? null;
}

// Derive a "from" price for configurable products whose base price is 0.
export function displayPrice(p: ProductShort): { price: number; isFrom: boolean } {
  if (p.price > 0) return { price: p.price, isFrom: false };
  if (typeof p.least_price === "number" && p.least_price > 0) {
    return { price: p.least_price, isFrom: true };
  }
  return { price: p.price, isFrom: false };
}
