import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

interface DietaryGuest {
  id: string;
  guest_name: string | null;
  is_onsite: boolean;
  reception_only: boolean;
  other_meals: string | null;
  has_restriction: boolean;
  restriction_type: string | null;
  severity: string | null;
  notes: string | null;
  is_child: boolean;
  child_age: number | null;
  sort_order: number;
}

export default function DietaryTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext: () => void }) {
  const [guests, setGuests] = useState<DietaryGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const autosave = useAutosaveStatus();

  useEffect(() => {
    supabase
      .from("dietary_restrictions")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setGuests(data.map(g => ({ ...g, is_onsite: g.is_onsite ?? false, reception_only: g.reception_only ?? false, has_restriction: g.has_restriction ?? false, is_child: g.is_child ?? false })));
        setLoading(false);
      });
  }, [eventId]);

  const restrictionCount = guests.filter(g => g.has_restriction).length;
  const childCount = guests.filter(g => g.is_child).length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  if (guests.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="font-display text-xl italic text-muted-foreground">No dietary info submitted yet</p>
        <p className="font-body text-sm text-muted-foreground mt-1">The couple hasn't added any dietary restrictions or kids meals.</p>
        <AdminStickyFooter status={autosave.status} onSave={async () => {}} onSaveAndContinue={async () => { onNavigateNext(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-card border border-border px-4 py-2">
          <p className="font-body text-sm text-foreground"><span className="font-medium">{restrictionCount}</span> with restrictions</p>
        </div>
        <div className="rounded-lg bg-card border border-border px-4 py-2">
          <p className="font-body text-sm text-foreground"><span className="font-medium">{childCount}</span> children</p>
        </div>
        <div className="rounded-lg bg-card border border-border px-4 py-2">
          <p className="font-body text-sm text-foreground"><span className="font-medium">{guests.length}</span> total guests listed</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 font-body text-[10px] tracking-widest uppercase text-muted-foreground">Guest</th>
                <th className="px-4 py-3 font-body text-[10px] tracking-widest uppercase text-muted-foreground">Attendance</th>
                <th className="px-4 py-3 font-body text-[10px] tracking-widest uppercase text-muted-foreground">Restriction</th>
                <th className="px-4 py-3 font-body text-[10px] tracking-widest uppercase text-muted-foreground">Severity</th>
                <th className="px-4 py-3 font-body text-[10px] tracking-widest uppercase text-muted-foreground">Child</th>
                <th className="px-4 py-3 font-body text-[10px] tracking-widest uppercase text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {guests.map(g => (
                <tr key={g.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-body text-sm text-foreground">{g.guest_name || "—"}</td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground">
                    {g.is_onsite ? "On-site" : g.reception_only ? "Reception only" : g.other_meals || "—"}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">
                    {g.has_restriction ? (
                      <span className="flex items-center gap-1">
                        <AlertCircle size={12} className="text-amber-500" />
                        {g.restriction_type || "Yes"}
                      </span>
                    ) : "None"}
                  </td>
                  <td className="px-4 py-3">
                    {g.severity && (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-medium ${
                        g.severity === "Allergy" ? "bg-red-100 text-red-700" :
                        g.severity === "Severe" ? "bg-orange-100 text-orange-700" :
                        g.severity === "Moderate" ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {g.severity}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">
                    {g.is_child ? `Yes (age ${g.child_age ?? "?"})` : "No"}
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground max-w-[200px] truncate">{g.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AdminStickyFooter status={autosave.status} onSave={async () => {}} onSaveAndContinue={async () => { onNavigateNext(); }} />
    </div>
  );
}
