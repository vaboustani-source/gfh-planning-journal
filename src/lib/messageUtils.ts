export interface Message {
  id: string;
  body: string;
  sender_id: string | null;
  created_at: string | null;
  read_at: string | null;
}

/**
 * Format a timestamp in iMessage style relative to now.
 * Same day: "2:47 PM"
 * Yesterday: "Yesterday 2:47 PM"
 * This week: "Monday 2:47 PM"
 * Older: "April 3 at 2:47 PM"
 */
export function formatSmartTimestamp(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
  const msgDate = new Date(date); msgDate.setHours(0, 0, 0, 0);

  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (msgDate.getTime() === today.getTime()) return time;
  if (msgDate.getTime() === yesterday.getTime()) return `Yesterday ${time}`;
  if (msgDate >= weekAgo) {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    return `${dayName} ${time}`;
  }
  const monthDay = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${monthDay} at ${time}`;
}

/**
 * Check if there's a 60+ minute gap between two messages.
 */
export function hasTimeGap(prev: Message | undefined, current: Message): boolean {
  if (!prev?.created_at || !current.created_at) return false;
  const diff = new Date(current.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff >= 60 * 60 * 1000; // 60 minutes
}

/**
 * Format a time divider label (includes date context).
 */
export function formatDividerLabel(dateStr: string | null): string {
  return formatSmartTimestamp(dateStr);
}
