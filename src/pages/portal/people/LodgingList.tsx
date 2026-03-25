import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Save, Check, Loader2 } from "lucide-react";

interface Room {
  room_name: string;
  room_type: string;
  nightly_rate: number | null;
}

interface Assignment {
  id: string;
  assigned_guest_name: string;
  assigned_guest_email: string;
  host_pays: boolean;
  room: Room | null;
}

function formatRoomType(type: string) {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function LodgingList() {
  const { eventId } = usePortalData();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("lodging_assignments")
      .select(`id, assigned_guest_name, assigned_guest_email, host_pays, lodging_rooms(room_name, room_type, nightly_rate)`)
      .eq("event_id", eventId)
      .then(({ data }) => {
        if (data) {
          setAssignments(
            data.map((a) => ({
              id: a.id,
              assigned_guest_name: a.assigned_guest_name ?? "",
              assigned_guest_email: a.assigned_guest_email ?? "",
              host_pays: a.host_pays ?? false,
              room: a.lodging_rooms as Room | null,
            }))
          );
        }
        setLoading(false);
      });
  }, [eventId]);

  const update = (id: string, field: keyof Assignment, value: string | boolean) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(
      assignments.map((a) =>
        supabase
          .from("lodging_assignments")
          .update({
            assigned_guest_name: a.assigned_guest_name || null,
            assigned_guest_email: a.assigned_guest_email || null,
            host_pays: a.host_pays,
          })
          .eq("id", a.id)
      )
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const assignedCount = assignments.filter((a) => a.assigned_guest_name.trim()).length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-xl bg-sage/6 border border-sage/15 px-5 py-4">
        <p className="font-body text-sm text-foreground font-medium">
          {assignedCount} of {assignments.length} rooms assigned
        </p>
        <p className="font-body text-xs text-muted-foreground mt-1">
          Fill in your guests' names and emails below. We'll handle the rest — they'll hear from us directly if needed.
        </p>
      </div>

      {assignments.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground text-center py-8">
          Lodging rooms will be listed here once your coordinator sets them up.
        </p>
      ) : (
        <>
          {assignments.map((a) => (
            <div key={a.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
              {/* Room header */}
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-light text-foreground">{a.room?.room_name ?? "Room"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-body text-[10px] tracking-wide uppercase text-muted-foreground">
                      {a.room ? formatRoomType(a.room.room_type) : ""}
                    </span>
                    {a.room?.nightly_rate && (
                      <>
                        <span className="text-border">·</span>
                        <span className="font-body text-[10px] text-muted-foreground">
                          ${a.room.nightly_rate.toLocaleString()}/night
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Fields */}
              <div className="px-5 py-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">
                    Guest Name
                  </label>
                  <input
                    type="text"
                    value={a.assigned_guest_name}
                    onChange={(e) => update(a.id, "assigned_guest_name", e.target.value)}
                    placeholder="Full name"
                    maxLength={120}
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">
                    Guest Email
                  </label>
                  <input
                    type="email"
                    value={a.assigned_guest_email}
                    onChange={(e) => update(a.id, "assigned_guest_email", e.target.value)}
                    placeholder="email@example.com"
                    maxLength={255}
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>

                {/* Who pays toggle */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="font-body text-sm text-foreground">Who covers this room?</p>
                    <p className="font-body text-xs text-muted-foreground mt-0.5">
                      {a.host_pays ? "You're covering this room" : "Guest pays directly"}
                    </p>
                  </div>
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs font-body shrink-0 ml-4">
                    <button
                      onClick={() => update(a.id, "host_pays", false)}
                      className={`px-3 py-1.5 transition-colors ${!a.host_pays ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                    >
                      Guest
                    </button>
                    <button
                      onClick={() => update(a.id, "host_pays", true)}
                      className={`px-3 py-1.5 transition-colors ${a.host_pays ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                    >
                      Host
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-body text-sm font-medium text-primary-foreground hover:bg-sage-dark transition-colors disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 size={15} className="animate-spin" /> Saving…</>
            ) : saved ? (
              <><Check size={15} /> Saved!</>
            ) : (
              <><Save size={15} /> Save Guest List</>
            )}
          </button>
        </>
      )}
    </div>
  );
}
