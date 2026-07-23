import type { CartLine, SelectedOption } from "./ordable/types";

// A line's identity = product/child id + sorted option choice ids + quantities.
// Same product with different options is a separate line.
export function deriveLineId(
  productId: number,
  options: SelectedOption[],
  bookingSlotId?: number | null,
): string {
  const opt = [...options]
    .sort((a, b) => a.id - b.id)
    .map((o) => `${o.id}x${o.quantity}`)
    .join(",");
  return `${productId}|${opt}|${bookingSlotId ?? ""}`;
}

export function lineUnitPrice(line: CartLine): number {
  const optionsTotal = line.options.reduce(
    (sum, o) => sum + (o.price ?? 0) * o.quantity,
    0,
  );
  return line.unitPrice + optionsTotal;
}

export function lineTotal(line: CartLine): number {
  return lineUnitPrice(line) * line.quantity;
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

// Map cart lines to the order payload's items[] shape.
export function toOrderItems(lines: CartLine[]) {
  return lines.map((l) => ({
    id: l.productId,
    quantity: l.quantity,
    options: l.options.map((o) => ({ id: o.id, quantity: o.quantity })),
    extra_fields: (l.extraFields ?? []).map((f) => ({ id: f.id, value: f.value })),
    special_requests: l.specialRequests ?? "",
    booking_slot_id: l.bookingSlotId ?? null,
  }));
}
