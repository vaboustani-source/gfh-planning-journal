/**
 * Shared "Midweek" badge. Renders only when wedding_date falls on
 * Monday, Tuesday, Wednesday, or Thursday. Weekend dates render nothing.
 * Do not pass styling overrides; the look must stay identical everywhere.
 */
export function isMidweek(weddingDate: string | null | undefined): boolean {
  if (!weddingDate) return false;
  const d = new Date(weddingDate + "T12:00:00");
  if (isNaN(d.getTime())) return false;
  const day = d.getDay(); // 0=Sun ... 6=Sat
  return day >= 1 && day <= 4;
}

export function MidweekBadge({ weddingDate, className = "" }: { weddingDate: string | null | undefined; className?: string }) {
  if (!isMidweek(weddingDate)) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider leading-none ${className}`}
      style={{
        backgroundColor: "#C9A84C",
        color: "#2C3E2D",
        fontFamily: "'Jost', sans-serif",
        letterSpacing: "0.08em",
      }}
    >
      Midweek
    </span>
  );
}
