import { EventParticipant, hexToRgba, darkenHex } from "@/lib/messageUtils";

interface MentionChipProps {
  participant: EventParticipant | null | undefined;
  /** When true, renders without margin/inline-block tweaks for use inside contentEditable */
  compact?: boolean;
}

export function MentionChip({ participant }: MentionChipProps) {
  if (!participant) {
    return (
      <span
        className="inline-flex items-center rounded-full font-body"
        style={{
          fontSize: "13px",
          padding: "2px 6px",
          backgroundColor: "rgba(107,107,107,0.12)",
          borderLeft: "2px solid #6B6B6B",
          color: "#6B6B6B",
        }}
      >
        @Unknown
      </span>
    );
  }
  const color = participant.color ?? "#648857";
  return (
    <span
      className="inline-flex items-center rounded-full font-body"
      style={{
        fontSize: "13px",
        padding: "2px 6px",
        backgroundColor: hexToRgba(color, 0.15),
        borderLeft: `2px solid ${color}`,
        color: darkenHex(color, 0.35),
      }}
    >
      @{participant.display_name ?? "Unknown"}
    </span>
  );
}
