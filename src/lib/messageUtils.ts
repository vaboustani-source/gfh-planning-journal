export interface Message {
  id: string;
  body: string;
  sender_id?: string | null;
  sender_event_user_id: string | null;
  created_at: string | null;
  read_at?: string | null;
  reply_to_message_id?: string | null;
}

/** Render message body as plain text for quote previews — mentions become "@Name". */
export function bodyToPlainText(
  body: string,
  participantsById: Record<string, EventParticipant>,
): string {
  return parseMessageBody(body)
    .map(part => {
      if (part.type === "text") return part.value;
      const p = participantsById[part.eventUserId];
      return `@${p?.display_name ?? "Unknown"}`;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate to N chars with ellipsis. */
export function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export interface EventParticipant {
  id: string;
  user_id: string | null;
  display_name: string | null;
  color: string | null;
  role_in_event: string | null;
}

/**
 * iMessage-style timestamp header.
 * - Today within last hour: "3:42 PM"
 * - Today >1 hour ago: "Today 9:15 AM"
 * - Yesterday: "Yesterday 4:30 PM"
 * - Within last 7 days: "Monday 3:42 PM"
 * - Same year, older: "Apr 12 at 3:42 PM"
 * - Different year: "Apr 12, 2025 at 3:42 PM"
 */
export function formatTimestampHeader(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();

  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfToday.getDate() - 1);
  const sevenDaysAgo = new Date(startOfToday); sevenDaysAgo.setDate(startOfToday.getDate() - 6);

  const msStart = new Date(date); msStart.setHours(0, 0, 0, 0);
  const diffMs = now.getTime() - date.getTime();

  if (msStart.getTime() === startOfToday.getTime()) {
    if (diffMs < 60 * 60 * 1000) return time;
    return `Today ${time}`;
  }
  if (msStart.getTime() === startOfYesterday.getTime()) return `Yesterday ${time}`;
  if (msStart >= sevenDaysAgo) {
    const dayName = date.toLocaleDateString(undefined, { weekday: "long" });
    return `${dayName} ${time}`;
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear) {
    const md = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${md} at ${time}`;
  }
  const mdy = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${mdy} at ${time}`;
}

/** Insert header if >15 min gap OR different calendar day. */
export function shouldShowTimestampHeader(prev: Message | undefined, current: Message): boolean {
  if (!prev?.created_at || !current.created_at) return !prev;
  const p = new Date(prev.created_at);
  const c = new Date(current.created_at);
  const diff = c.getTime() - p.getTime();
  if (diff >= 15 * 60 * 1000) return true;
  return p.toDateString() !== c.toDateString();
}

/** True if same sender as prev AND within 2 min AND no header between. */
export function isGroupedWithPrev(prev: Message | undefined, current: Message, headerShown: boolean): boolean {
  if (headerShown || !prev) return false;
  if (prev.sender_event_user_id !== current.sender_event_user_id) return false;
  if (!prev.created_at || !current.created_at) return false;
  const diff = new Date(current.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff < 2 * 60 * 1000;
}

/** Convert hex (#RRGGBB) to rgba string. */
export function hexToRgba(hex: string | null | undefined, alpha: number): string {
  const fallback = "#648857";
  const h = (hex && /^#?[0-9a-fA-F]{6}$/.test(hex.replace("#", "")) ? hex : fallback).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function initialOf(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** Darken a hex color by a small amount for chip text legibility. */
export function darkenHex(hex: string | null | undefined, amount = 0.35): string {
  const fallback = "#648857";
  const h = (hex && /^#?[0-9a-fA-F]{6}$/.test((hex || "").replace("#", "")) ? hex! : fallback).replace("#", "");
  const r = Math.max(0, Math.floor(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.floor(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `rgb(${r}, ${g}, ${b})`;
}

export type MessageBodyPart =
  | { type: "text"; value: string }
  | { type: "mention"; eventUserId: string }
  | { type: "section"; section: string };

/** Parse stored body markup `[[@event_user_id]]` and `[[#section]]` into ordered parts. */
export function parseMessageBody(body: string): MessageBodyPart[] {
  if (!body) return [];
  const parts: MessageBodyPart[] = [];
  // Match either [[@uuid]] or [[#section-key]]
  const regex = /\[\[(@[0-9a-fA-F-]{8,}|#[a-z0-9_-]+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: body.slice(lastIndex, match.index) });
    }
    const token = match[1];
    if (token.startsWith("@")) {
      parts.push({ type: "mention", eventUserId: token.slice(1) });
    } else {
      parts.push({ type: "section", section: token.slice(1) });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < body.length) parts.push({ type: "text", value: body.slice(lastIndex) });
  return parts;
}

/** Extract event_user_ids referenced via [[@...]] in order, deduped. */
export function extractMentionIds(body: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const regex = /\[\[@([0-9a-fA-F-]{8,})\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(body)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); ids.push(m[1]); }
  }
  return ids;
}

/** Portal sections that can be tagged via #section. */
export const PORTAL_SECTIONS: { key: string; label: string; path: string }[] = [
  { key: "vendors",    label: "Vendors",    path: "/portal/vendors" },
  { key: "lodging",    label: "Lodging",    path: "/portal/our-people" },
  { key: "ceremony",   label: "Ceremony",   path: "/portal/ceremony" },
  { key: "menus",      label: "Menus",      path: "/portal/menus-meals" },
  { key: "timeline",   label: "Timeline",   path: "/portal/timeline" },
  { key: "financials", label: "Financials", path: "/portal/financials" },
  { key: "decor",      label: "Decor",      path: "/portal/decor" },
  { key: "planning",   label: "Planning",   path: "/portal/planning" },
];

export function getSectionByKey(key: string) {
  return PORTAL_SECTIONS.find(s => s.key === key.toLowerCase());
}

