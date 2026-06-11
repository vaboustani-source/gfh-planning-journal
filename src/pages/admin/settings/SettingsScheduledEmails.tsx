import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Pencil } from "lucide-react";

interface ScheduledEmail {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  anchor: "wedding_date" | "due_date";
  direction: "before" | "after";
  offset_days: number[];
  description: string | null;
  updated_at: string;
}

function anchorLabel(a: ScheduledEmail["anchor"]): string {
  return a === "wedding_date" ? "wedding date" : "payment due date";
}

export default function SettingsScheduledEmails() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("*")
        .order("name");
      if (error) toast({ title: "Could not load", description: error.message, variant: "destructive" });
      setRows((data as ScheduledEmail[]) ?? []);
      setLoading(false);
    })();
  }, [toast]);

  async function updateRow(id: string, patch: Partial<ScheduledEmail>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("scheduled_emails").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    }
  }

  function parseOffsets(input: string): number[] | null {
    const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
    const nums = parts.map((p) => parseInt(p, 10));
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
    return nums;
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <p className="font-body" style={{ color: "#6B6B6B" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h2 className="font-display text-3xl font-light" style={{ color: "#2C3E2D" }}>
        Automated Emails
      </h2>
      <p className="font-body mt-2" style={{ color: "#6B6B6B", fontSize: "14px" }}>
        Date-based emails the Hub can send to couples automatically. These emails are off until you turn
        them on, and once on they send automatically to couples based on the timing below.
      </p>

      <div
        className="mt-6 rounded-xl px-5 py-4"
        style={{ backgroundColor: "#FAF8F4", border: "1px solid #E8E2D9" }}
      >
        <p className="font-body" style={{ color: "#2C3E2D", fontSize: "13px" }}>
          The scheduler runs once a day. To test, enable a row on an event whose couple email you control,
          set the relevant date so it qualifies, then run the function manually.
        </p>
      </div>

      <div
        className="mt-6 rounded-xl overflow-hidden"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2D9" }}
      >
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="px-5 py-5"
            style={{ borderTop: i === 0 ? "none" : "1px solid #F0EDE6" }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="font-display text-xl font-light" style={{ color: "#1A1A1A" }}>
                  {r.name}
                </p>
                {r.description && (
                  <p className="font-body mt-1" style={{ color: "#6B6B6B", fontSize: "13px" }}>
                    {r.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className="font-body"
                  style={{ color: r.enabled ? "#2C3E2D" : "#9aa097", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}
                >
                  {r.enabled ? "On" : "Off"}
                </span>
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(v) => updateRow(r.id, { enabled: v })}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="font-body block mb-1.5" style={{ color: "#2C3E2D", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  When
                </label>
                <select
                  value={r.direction}
                  onChange={(e) => updateRow(r.id, { direction: e.target.value as "before" | "after" })}
                  className="w-full rounded-md border px-3 py-2 font-body text-sm"
                  style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF" }}
                >
                  <option value="before">Before</option>
                  <option value="after">After</option>
                </select>
              </div>
              <div>
                <label className="font-body block mb-1.5" style={{ color: "#2C3E2D", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Days
                </label>
                <input
                  defaultValue={r.offset_days.join(", ")}
                  onBlur={(e) => {
                    const next = parseOffsets(e.target.value);
                    if (!next || next.length === 0) {
                      toast({ title: "Enter one or more whole numbers separated by commas", variant: "destructive" });
                      e.target.value = r.offset_days.join(", ");
                      return;
                    }
                    if (JSON.stringify(next) !== JSON.stringify(r.offset_days)) {
                      updateRow(r.id, { offset_days: next });
                    }
                  }}
                  className="w-full rounded-md border px-3 py-2 font-body text-sm"
                  style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF" }}
                />
                <p className="font-body mt-1" style={{ color: "#9aa097", fontSize: "11px" }}>
                  e.g. 7 or 60, 30
                </p>
              </div>
              <div>
                <label className="font-body block mb-1.5" style={{ color: "#2C3E2D", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Anchor
                </label>
                <div
                  className="rounded-md px-3 py-2 font-body text-sm"
                  style={{ border: "1px solid #E8E2D9", backgroundColor: "#FAF8F4", color: "#6B6B6B" }}
                >
                  the {anchorLabel(r.anchor)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <p className="font-body" style={{ color: "#6B6B6B", fontSize: "13px" }}>
                Sends {r.offset_days.join(", ")} day{r.offset_days.length === 1 && r.offset_days[0] === 1 ? "" : "s"}{" "}
                {r.direction} the {anchorLabel(r.anchor)}.
              </p>
              <Link
                to="/admin/settings/email-copy"
                className="font-body inline-flex items-center gap-1.5 hover:underline ml-auto"
                style={{ color: "#C9A84C", fontSize: "13px" }}
              >
                <Pencil size={13} /> Edit wording
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
