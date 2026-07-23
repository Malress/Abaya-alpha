import { WorkingHour } from "./ordable/types";

export function formatTime(t?: string) {
  if (!t) return "";
  const parts = t.split(":");
  if (parts.length < 2) return t;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export interface CompressedSchedule {
  label: string;
  time: string;
}

function formatBlock(
  startDay: number,
  endDay: number,
  tx: (en: string, ar?: string) => string
): string {
  const sName = tx(DAYS_EN[startDay], DAYS_AR[startDay]);
  if (startDay === endDay) {
    return sName;
  }
  const eName = tx(DAYS_EN[endDay], DAYS_AR[endDay]);
  return `${sName}-${eName}`;
}

export function compressSchedule(
  hours: WorkingHour[] | undefined,
  tx: (en: string, ar?: string) => string
): CompressedSchedule[] {
  if (!hours || hours.length === 0) return [];

  // 1. Sort by day (0 to 6) and then by start time
  const sorted = [...hours].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.start.localeCompare(b.start);
  });

  // 2. Merge overnight shifts
  const merged: WorkingHour[] = [];
  const skipNext = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (skipNext.has(i)) continue;

    const current = { ...sorted[i] };

    // Check if it ends around midnight (23:59:XX)
    if (current.end.startsWith("23:59")) {
      // Look for the next chronological shift
      const nextIdx = (i + 1) % sorted.length;
      const next = sorted[nextIdx];
      const nextExpectedDay = (current.day + 1) % 7;

      // If the next shift is on the next day and starts exactly at 00:00:00
      if (next && next.day === nextExpectedDay && next.start.startsWith("00:00")) {
        // Merge them!
        current.end = next.end;
        skipNext.add(nextIdx);
      }
    }

    merged.push(current);
  }

  // Handle wrap-around removal (if the very first shift was consumed by the last shift)
  if (skipNext.has(0)) {
    const idx = merged.findIndex(
      (m) => m.day === sorted[0].day && m.start === sorted[0].start
    );
    if (idx !== -1) {
      merged.splice(idx, 1);
    }
  }

  // 3. Group by day (0-6)
  const dayStrings: string[] = new Array(7).fill("");

  for (let day = 0; day <= 6; day++) {
    const shiftsForDay = merged.filter((m) => m.day === day);
    if (shiftsForDay.length > 0) {
      dayStrings[day] = shiftsForDay
        .map((s) => `${formatTime(s.start)} - ${formatTime(s.end)}`)
        .join(", ");
    }
  }

  // 4. Compress consecutive days
  const result: CompressedSchedule[] = [];
  let startDay = -1;

  for (let i = 0; i <= 7; i++) {
    if (i < 7 && dayStrings[i] !== "") {
      if (startDay === -1) {
        startDay = i;
      } else if (dayStrings[i] !== dayStrings[startDay]) {
        // Schedule changed, close previous block
        result.push({
          label: formatBlock(startDay, i - 1, tx),
          time: dayStrings[startDay],
        });
        startDay = i;
      }
    } else {
      // It's empty or out of bounds. Close block if open.
      if (startDay !== -1) {
        result.push({
          label: formatBlock(startDay, i - 1, tx),
          time: dayStrings[startDay],
        });
        startDay = -1;
      }
    }
  }

  // Special case: Every day is identically scheduled and not empty
  const allSame = dayStrings.every((d) => d !== "" && d === dayStrings[0]);
  if (allSame && dayStrings[0] !== "") {
    return [
      {
        label: tx("Every day", "كل يوم"),
        time: dayStrings[0],
      },
    ];
  }

  return result;
}
