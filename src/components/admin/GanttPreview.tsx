import { GanttBlock, GanttAxis, buildAxis, resolveBlocks, formatTime } from "@/lib/ganttTimeline";

const FOH_COLOR = "#2C3E2D";
const BOH_COLOR = "#4A6FA5";
const INT_COLOR = "#C9A84C";

interface DayInput {
  id: string;
  label: string;
  blocks: { time: string; foh: string; boh: string; internal: string; highlight: string | null; duration_minutes?: number | null }[];
}

interface Props {
  day: DayInput;
  showFoh: boolean;
  showBoh: boolean;
  showInternal: boolean;
  audience?: string;
  coupleNames?: string;
  dayHeading?: string;
  /** smaller scale for inline preview */
  compact?: boolean;
}

function Bar({
  block, axis, color, textLight, compact,
}: { block: GanttBlock; axis: GanttAxis; color: string; textLight: boolean; compact: boolean }) {
  const leftPct = ((block.startMin - axis.startMin) / axis.totalMin) * 100;
  const widthPct = (block.durationMin / axis.totalMin) * 100;
  const isVeryShort = block.durationMin < 20;
  const label = block.foh || block.boh || block.internal;
  const height = compact ? 28 : 40;
  const fontSize = compact ? 10 : 12;

  if (isVeryShort) {
    return (
      <div
        title={`${block.time} — ${label}`}
        style={{
          position: "absolute",
          left: `${leftPct}%`,
          width: `${Math.max(widthPct, 0.6)}%`,
          height,
          background: color,
          borderRadius: 4,
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        }}
      />
    );
  }

  return (
    <div
      title={`${block.time} — ${label}`}
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        height,
        background: color,
        color: textLight ? "#fff" : "#2d2410",
        borderRadius: 4,
        padding: compact ? "2px 6px" : "4px 10px",
        fontSize,
        lineHeight: 1.2,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label || "—"}
      </div>
      <div style={{ fontSize: fontSize - 2, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {block.time} · {block.durationMin}m
      </div>
    </div>
  );
}

export default function GanttPreview({
  day, showFoh, showBoh, showInternal, audience, coupleNames, dayHeading, compact = false,
}: Props) {
  const blocks = resolveBlocks(day.blocks);
  const axis = buildAxis(blocks);

  if (!axis || blocks.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "#888",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 13,
          background: "#faf8f3",
          borderRadius: 8,
        }}
      >
        No timed entries to chart for {day.label}.
      </div>
    );
  }

  const rowHeight = compact ? 28 : 40;
  const rowGap = compact ? 6 : 10;
  const rows: { color: string; textLight: boolean; key: string }[] = [];
  if (showFoh) rows.push({ color: FOH_COLOR, textLight: true, key: "foh" });
  if (showBoh) rows.push({ color: BOH_COLOR, textLight: true, key: "boh" });
  if (showInternal) rows.push({ color: INT_COLOR, textLight: false, key: "internal" });

  const innerHeight = rows.length * rowHeight + Math.max(0, rows.length - 1) * rowGap;
  const labelColWidth = compact ? 72 : 110;

  return (
    <div
      style={{
        background: "#FBF9F3",
        border: "1px solid #E5E1D6",
        borderRadius: 10,
        padding: compact ? 14 : 22,
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#2d2d2d",
        breakInside: "avoid",
        pageBreakInside: "avoid",
      }}
    >
      {/* Day header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: compact ? 10 : 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: compact ? 18 : 24, fontWeight: 300, color: "#2C3E2D", lineHeight: 1.1 }}>
            {dayHeading || day.label}
          </div>
          {audience && (
            <div style={{ fontSize: compact ? 10 : 12, color: "#888", marginTop: 4 }}>
              Prepared for: {audience}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", fontSize: compact ? 9 : 11, color: "#8a8a82", letterSpacing: 1, textTransform: "uppercase" }}>
          {coupleNames && <div style={{ marginBottom: 2 }}>{coupleNames}</div>}
          <div>Gilbertsville Farmhouse</div>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ display: "flex", gap: compact ? 8 : 12 }}>
        {/* Row labels */}
        <div style={{ width: labelColWidth, flexShrink: 0, paddingTop: compact ? 24 : 32 }}>
          {rows.map((r, i) => (
            <div
              key={r.key}
              style={{
                height: rowHeight,
                marginTop: i === 0 ? 0 : rowGap,
                fontSize: compact ? 9 : 11,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: r.color,
                display: "flex",
                alignItems: "center",
              }}
            >
              {r.key === "foh" ? "Couple" : r.key === "boh" ? "Vendor" : "Internal"}
            </div>
          ))}
        </div>

        {/* Plot */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {/* Time axis (top) */}
          <div style={{ position: "relative", height: compact ? 22 : 28, borderBottom: "1px solid #D8D2C2" }}>
            {axis.ticks.map((t, i) => {
              const leftPct = ((t.min - axis.startMin) / axis.totalMin) * 100;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${leftPct}%`,
                    transform: "translateX(-50%)",
                    fontSize: compact ? 8 : 10,
                    color: "#7a7a72",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div style={{ position: "relative", height: innerHeight, marginTop: compact ? 4 : 6 }}>
            {/* Vertical gridlines */}
            {axis.ticks.map((t, i) => {
              const leftPct = ((t.min - axis.startMin) / axis.totalMin) * 100;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${leftPct}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: i === 0 || i === axis.ticks.length - 1 ? "#D8D2C2" : "#ECE7D7",
                  }}
                />
              );
            })}

            {/* Rows */}
            {rows.map((r, ri) => {
              const top = ri * (rowHeight + rowGap);
              return (
                <div
                  key={r.key}
                  style={{ position: "absolute", left: 0, right: 0, top, height: rowHeight }}
                >
                  {blocks.map((b, bi) => {
                    const text =
                      r.key === "foh" ? b.foh :
                      r.key === "boh" ? b.boh :
                      b.internal;
                    if (!text) return null;
                    const blockForRow: GanttBlock = { ...b, foh: r.key === "foh" ? b.foh : "", boh: r.key === "boh" ? b.boh : "", internal: r.key === "internal" ? b.internal : "" };
                    // Override the label resolution by passing only the relevant text
                    blockForRow.foh = r.key === "foh" ? text : "";
                    blockForRow.boh = r.key === "boh" ? text : "";
                    blockForRow.internal = r.key === "internal" ? text : "";
                    return (
                      <Bar
                        key={bi}
                        block={blockForRow}
                        axis={axis}
                        color={r.color}
                        textLight={r.textLight}
                        compact={compact}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Range footer */}
          <div style={{ marginTop: compact ? 6 : 10, fontSize: compact ? 9 : 10, color: "#9a9a92", textAlign: "right" }}>
            {formatTime(axis.startMin)} – {formatTime(axis.endMin)}
          </div>
        </div>
      </div>
    </div>
  );
}
