export interface Message {
  id: string;
  body: string;
  sender_id?: string | null;
  sender_event_user_id: string | null;
  created_at: string | null;
  read_at?: string | null;
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
