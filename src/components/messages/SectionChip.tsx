import { getSectionByKey } from "@/lib/messageUtils";

interface SectionChipProps {
  section: string;
  onClick?: () => void;
}

/**
 * Gold styled chip for #section tags.
 * Clickable when onClick provided.
 */
export function SectionChip({ section, onClick }: SectionChipProps) {
  const meta = getSectionByKey(section);
  const label = meta?.label.toLowerCase() ?? section;
  const Element: any = onClick ? "button" : "span";
  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center rounded-full font-body align-baseline ${
        onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
      }`}
      style={{
        fontSize: "13px",
        padding: "2px 6px",
        backgroundColor: "rgba(196, 154, 64, 0.15)",
        borderLeft: "2px solid #C49A40",
        color: "#8A6A1F",
        margin: "0 1px",
      }}
    >
      #{label}
    </Element>
  );
}
