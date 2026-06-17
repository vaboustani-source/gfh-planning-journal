import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  id: string;
  notes: string | null;
  item_id: string;
  item_name: string;
  item_sort: number | null;
  section_id: string;
  section_label: string;
  section_sort: number | null;
}

interface Props {
  eventId: string;
  className?: string;
}

export default function MenuSelectionsDisplay({ eventId, className }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("couple_selections")
        .select(
          `id, notes, menu_item_id, section_id,
           menu_items:menu_item_id ( name, sort_order ),
           menu_sections:section_id ( label, section_title, sort_order )`
        )
        .eq("event_id", eventId);
      if (cancelled) return;
      const mapped: Row[] = (data ?? []).map((r: any) => ({
        id: r.id,
        notes: r.notes,
        item_id: r.menu_item_id,
        item_name: r.menu_items?.name ?? "Item",
        item_sort: r.menu_items?.sort_order ?? null,
        section_id: r.section_id,
        section_label:
          r.menu_sections?.section_title ?? r.menu_sections?.label ?? r.section_id,
        section_sort: r.menu_sections?.sort_order ?? null,
      }));
      setRows(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (rows === null) {
    return (
      <div className={`flex justify-center py-6 ${className ?? ""}`}>
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className={`font-body text-sm italic text-muted-foreground ${className ?? ""}`}>
        No menu selections submitted yet.
      </p>
    );
  }

  // Group by section
  const grouped = new Map<string, { label: string; sort: number; items: Row[] }>();
  for (const r of rows) {
    const g = grouped.get(r.section_id);
    if (g) g.items.push(r);
    else
      grouped.set(r.section_id, {
        label: r.section_label,
        sort: r.section_sort ?? 999,
        items: [r],
      });
  }
  const sections = Array.from(grouped.entries()).sort(
    (a, b) => a[1].sort - b[1].sort
  );
  sections.forEach(([, g]) =>
    g.items.sort((a, b) => (a.item_sort ?? 999) - (b.item_sort ?? 999))
  );

  return (
    <div className={`space-y-5 ${className ?? ""}`}>
      {sections.map(([id, g]) => (
        <div key={id}>
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
            {g.label}
          </p>
          <ul className="space-y-1.5">
            {g.items.map((it) => (
              <li
                key={it.id}
                className="font-body text-sm text-foreground flex flex-col"
              >
                <span>{it.item_name}</span>
                {it.notes && (
                  <span className="font-body text-xs italic text-muted-foreground">
                    {it.notes}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
