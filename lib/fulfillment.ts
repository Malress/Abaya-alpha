import type { Branch, WorkingHour } from "./ordable/types";

// Fulfillment slots are computed client-side from BRANCH working hours (there is no
// scheduling endpoint). day 0 = Sunday. Times are "HH:MM" in the store's local time; we
// treat the shopper's local clock as the store clock, which is correct for single-market
// stores. The server re-validates and re-prices on order create.

export interface Slot {
  start: string; // HH:MM
  end: string;
  label: string;
}
export interface DayOption {
  date: string; // YYYY-MM-DD
  label: string;
  slots: Slot[];
}
export interface FulfillmentOptions {
  asap: { available: boolean; date?: string; start?: string; end?: string; label?: string };
  days: DayOption[];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${pad(h)}:${pad(m)}`;
}
function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m)} ${period}`;
}
function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_LABELS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function computeFulfillment(
  branch: Branch,
  isDelivery: boolean,
  locale: "en" | "ar",
  daysAhead = 7,
  areaMins?: number | null,
  preparationTime?: number | null,
): FulfillmentOptions {
  const now = new Date();
  const leadMin = branch.minimum_lead_time ?? 0;
  const onDemandMin = isDelivery
    ? branch.on_demand_delivery_minutes ?? 0
    : branch.on_demand_pickup_minutes ?? 0;
  const onDemandEnabled = isDelivery
    ? branch.enable_on_demand_delivery
    : branch.enable_on_demand_pickup;
  const scheduledEnabled = isDelivery
    ? branch.enable_scheduled_delivery
    : branch.enable_scheduled_pickup;

  // ASAP
  const asap: FulfillmentOptions["asap"] = { available: false };
  if (onDemandEnabled) {
    const startMins = now.getHours() * 60 + now.getMinutes() + onDemandMin + leadMin;
    const start = fromMinutes(startMins);
    const end = fromMinutes(startMins + 60);
    asap.available = true;
    asap.date = dateStr(now);
    asap.start = start;
    asap.end = end;
    
    // Compute display string similar to Retail getCompactAsapDisplayString
    if (branch.enable_on_demand_custom_string) {
      asap.label = locale === "ar" && branch.on_demand_custom_string_ar 
        ? branch.on_demand_custom_string_ar 
        : branch.on_demand_custom_string || (locale === "ar" ? "في أقرب وقت" : "As soon as possible");
    } else {
      const mins = areaMins || onDemandMin || preparationTime;
      if (mins && mins > 0) {
        if (mins >= 1440) {
          const days = Math.round(mins / 1440);
          if (days === 1) asap.label = locale === "ar" ? "يوم واحد" : "1 Day";
          else if (days === 2) asap.label = locale === "ar" ? "يومين" : "2 Days";
          else asap.label = locale === "ar" ? `${days} أيام` : `${days} Days`;
        } else if (mins >= 60) {
          const hours = Math.round(mins / 60);
          if (hours === 1) asap.label = locale === "ar" ? "ساعة واحدة" : "1 Hour";
          else if (hours === 2) asap.label = locale === "ar" ? "ساعتين" : "2 Hours";
          else asap.label = locale === "ar" ? `${hours} ساعات` : `${hours} Hours`;
        } else {
          asap.label = locale === "ar" ? `${mins} دقيقة` : `${mins} Mins`;
        }
      } else {
        // Fallback
        asap.label = areaMins !== undefined && areaMins !== null ? (locale === "ar" ? "قيد المراجعة" : "Pending") : (locale === "ar" ? "في أقرب وقت" : "As soon as possible");
      }
    }
  }

  // Scheduled
  const days: DayOption[] = [];
  if (scheduledEnabled) {
    const baseSlots: WorkingHour[] = isDelivery
      ? branch.scheduled_delivery_slots ?? []
      : derivePickupSlots(branch.pickup_working_hours ?? [], branch.pickup_interval ?? 30);

    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dow = d.getDay();
      const daySlots = baseSlots.filter((s) => s.day === dow);
      if (!daySlots.length) continue;

      const nowTotalMin = now.getHours() * 60 + now.getMinutes();
      const slots: Slot[] = [];
      for (const s of daySlots) {
        const startM = toMinutes(s.start);
        // Filter out slots that don't satisfy the lead time (only for today / near days).
        const minutesUntil = i * 24 * 60 + startM - nowTotalMin;
        if (minutesUntil < leadMin) continue;
        slots.push({
          start: s.start,
          end: s.end,
          label: `${to12h(s.start)} – ${to12h(s.end)}`,
        });
      }
      if (!slots.length) continue;

      const dayLabel =
        i === 0
          ? locale === "ar" ? "اليوم" : "Today"
          : i === 1
            ? locale === "ar" ? "غداً" : "Tomorrow"
            : locale === "ar" ? DAY_LABELS_AR[dow] : DAY_LABELS[dow];
      days.push({
        date: dateStr(d),
        label: `${dayLabel} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
        slots,
      });
    }
  }

  return { asap, days };
}

// Split pickup working hours into interval-sized slots.
function derivePickupSlots(hours: WorkingHour[], interval: number): WorkingHour[] {
  const out: WorkingHour[] = [];
  const step = interval > 0 ? interval : 30;
  for (const h of hours) {
    let s = toMinutes(h.start);
    const end = toMinutes(h.end);
    while (s + step <= end) {
      out.push({ day: h.day, start: fromMinutes(s), end: fromMinutes(s + step) });
      s += step;
    }
  }
  return out;
}
