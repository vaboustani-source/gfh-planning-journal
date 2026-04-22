/* Gantt timeline helpers — parse times, compute durations, build axis. */

export interface GanttBlock {
  time: string;
  foh: string;
  boh: string;
  internal: string;
  highlight: string | null;
  duration_minutes?: number | null;
  startMin: number;   // resolved minutes since midnight (may cross midnight via +1440)
  durationMin: number;
}

const DEFAULT_TAIL_DURATION = 30;

/** Parse "8:30", "08:30", "8:30 AM", "8:30 PM", "12:00 AM" → minutes since midnight, or null. */
export function parseTime(raw: string): number | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3];
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  if (mer === "AM") {
    if (h === 12) h = 0;
  } else if (mer === "PM") {
    if (h !== 12) h += 12;
  }
  return h * 60 + min;
}

export function formatTime(totalMin: number): string {
  const m = ((totalMin % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const mer = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${mer}`;
}

/**
 * Resolve raw blocks into Gantt blocks with monotonic startMin and durationMin.
 * If a parsed time is earlier than the previous, assume it crossed midnight (+1440).
 */
export function resolveBlocks(
  raw: { time: string; foh?: string; boh?: string; internal?: string; highlight?: string | null; duration_minutes?: number | null }[]
): GanttBlock[] {
  const parsed: { idx: number; min: number | null; b: typeof raw[number] }[] = raw.map((b, idx) => ({
    idx,
    min: parseTime(b.time),
    b,
  }));

  // Filter out unparseable times AND empty rows
  const valid = parsed.filter(p => p.min !== null && (p.b.foh || p.b.boh || p.b.internal));

  // Make monotonic (cross midnight)
  let prev = -Infinity;
  const monotonic = valid.map(p => {
    let m = p.min as number;
    while (m < prev) m += 1440;
    prev = m;
    return { ...p, min: m };
  });

  // Sort by start time (defensive)
  monotonic.sort((a, b) => (a.min as number) - (b.min as number));

  return monotonic.map((p, i) => {
    const next = monotonic[i + 1];
    const override = p.b.duration_minutes;
    const computed = override && override > 0
      ? override
      : next
        ? Math.max(5, (next.min as number) - (p.min as number))
        : DEFAULT_TAIL_DURATION;
    return {
      time: p.b.time,
      foh: p.b.foh || "",
      boh: p.b.boh || "",
      internal: p.b.internal || "",
      highlight: p.b.highlight ?? null,
      duration_minutes: override ?? null,
      startMin: p.min as number,
      durationMin: computed,
    };
  });
}

export interface GanttAxis {
  startMin: number;
  endMin: number;
  totalMin: number;
  ticks: { min: number; label: string }[];
  intervalMin: number;
}

/** Build an axis padded to nice boundaries with ticks. */
export function buildAxis(blocks: GanttBlock[]): GanttAxis | null {
  if (blocks.length === 0) return null;
  const first = blocks[0].startMin;
  const last = blocks[blocks.length - 1];
  const lastEnd = last.startMin + last.durationMin;

  // Pad 30 min before and after, snap to 30
  const startMin = Math.floor((first - 30) / 30) * 30;
  const endMin = Math.ceil((lastEnd + 30) / 30) * 30;
  const totalMin = endMin - startMin;

  // Tick interval: 30 if span <= 6h else 60
  const intervalMin = totalMin <= 360 ? 30 : 60;
  const ticks: { min: number; label: string }[] = [];
  for (let t = startMin; t <= endMin; t += intervalMin) {
    ticks.push({ min: t, label: formatTime(t) });
  }
  return { startMin, endMin, totalMin, ticks, intervalMin };
}
