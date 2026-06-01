import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Info, Plus, X, UtensilsCrossed, Pencil } from "lucide-react";
import { toast } from "sonner";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";

const db = supabase as any;

interface Guest {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  rsvp_status: string | null;
  dietary_restrictions: string[] | null;
  meal_preference: string | null;
  notes: string | null;
}

const DIET_OPTIONS = ["Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy", "Dairy-Free", "Shellfish Allergy", "Halal", "Kosher", "Other"];

export default function DietaryTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext: () => void }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [showAll, setShowAll] = useState(false);
  const autosave = useAutosaveStatus();

  useEffect(() => { if (eventId) load(); }, [eventId]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.from("guests")
      .select("id,event_id,first_name,last_name,rsvp_status,dietary_restrictions,meal_preference,notes")
      .eq("event_id", eventId)
      .order("last_name");
    if (error) toast.error("Could not load guests");
    setGuests((data ?? []) as Guest[]);
    setLoading(false);
  };

  const confirmedGuests = useMemo(
    () => guests.filter(g => g.rsvp_status === "confirmed"),
    [guests]
  );
  const withRestrictions = useMemo(
    () => confirmedGuests.filter(g => (g.dietary_restrictions ?? []).length > 0),
    [confirmedGuests]
  );

  const visible = showAll ? guests : withRestrictions;

  const save = async () => {
    if (!editing) return;
    const { error } = await db.from("guests").update({
      dietary_restrictions: editing.dietary_restrictions ?? [],
      meal_preference: editing.meal_preference,
      notes: editing.notes,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg bg-sage/10 border border-sage/20 px-4 py-3">
        <Info size={16} className="text-sage-dark shrink-0 mt-0.5" />
        <p className="font-body text-sm text-foreground">
          Guest dietary information is collected automatically when guests RSVP. You can also add guests
          and their dietary needs manually here. All edits update the shared guest list.
        </p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-white border border-border px-4 py-2">
          <p className="font-body text-sm text-foreground">
            <span className="font-medium">{withRestrictions.length}</span> with restrictions
          </p>
        </div>
        <div className="rounded-lg bg-white border border-border px-4 py-2">
          <p className="font-body text-sm text-foreground">
            <span className="font-medium">{confirmedGuests.length}</span> confirmed of {guests.length} invited
          </p>
        </div>
        <button
          onClick={() => setShowAll(s => !s)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border font-body text-sm hover:bg-muted/40"
        >
          {showAll ? "Show only with restrictions" : "Show all guests"}
        </button>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="bg-white border border-dashed border-border rounded-lg p-10 text-center">
          <p className="font-display text-lg italic text-muted-foreground">
            {guests.length === 0 ? "No guests added yet" : "No dietary restrictions logged yet"}
          </p>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Add guests in the Our People tab — their dietary info will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr className="text-left font-body text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">RSVP</th>
                <th className="px-4 py-3">Dietary</th>
                <th className="px-4 py-3">Meal preference</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(g => (
                <tr key={g.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm">{g.first_name} {g.last_name}</td>
                  <td className="px-4 py-3 font-body text-xs capitalize text-muted-foreground">{g.rsvp_status ?? "—"}</td>
                  <td className="px-4 py-3">
                    {(g.dietary_restrictions ?? []).length === 0 ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(g.dietary_restrictions ?? []).map(d => (
                          <span key={d} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-body text-[11px] text-secondary-foreground">
                            <UtensilsCrossed size={10} /> {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground">{g.meal_preference || "—"}</td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground max-w-[240px] truncate">{g.notes || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing({ ...g, dietary_restrictions: g.dietary_restrictions ?? [] })} className="p-1.5 text-muted-foreground hover:text-foreground">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-forest/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-border shadow-elevated w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">Edit dietary info — {editing.first_name} {editing.last_name}</h3>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs uppercase tracking-wider text-muted-foreground">Dietary restrictions</label>
              <div className="flex flex-wrap gap-2">
                {DIET_OPTIONS.map(d => {
                  const checked = (editing.dietary_restrictions ?? []).includes(d);
                  return (
                    <button key={d} type="button"
                      onClick={() => {
                        const cur = editing.dietary_restrictions ?? [];
                        setEditing({ ...editing, dietary_restrictions: checked ? cur.filter(x => x !== d) : [...cur, d] });
                      }}
                      className={`px-3 py-1.5 rounded-full font-body text-xs border transition-colors ${
                        checked ? "bg-sage text-primary-foreground border-sage" : "bg-white text-muted-foreground border-border hover:text-foreground"
                      }`}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs uppercase tracking-wider text-muted-foreground">Meal preference</label>
              <input
                className="w-full px-3 py-2 rounded-md border border-input bg-background font-body text-sm"
                value={editing.meal_preference ?? ""}
                onChange={e => setEditing({ ...editing, meal_preference: e.target.value })}
                placeholder="e.g. Beef, Fish, Vegetarian plate"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs uppercase tracking-wider text-muted-foreground">Notes (severity, cross-contamination, etc.)</label>
              <textarea
                className="w-full px-3 py-2 rounded-md border border-input bg-background font-body text-sm"
                rows={3}
                value={editing.notes ?? ""}
                onChange={e => setEditing({ ...editing, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border border-border font-body text-sm hover:bg-muted/40">Cancel</button>
              <button onClick={save} className="px-4 py-2 rounded-md bg-sage text-primary-foreground font-body text-sm hover:bg-sage-dark">Save</button>
            </div>
          </div>
        </div>
      )}

      <AdminStickyFooter status={autosave.status} onSave={async () => {}} onSaveAndContinue={async () => { onNavigateNext(); }} />
    </div>
  );
}
