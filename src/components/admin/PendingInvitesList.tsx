import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, X, Clock, AlertCircle } from "lucide-react";

interface Invitation {
  id: string;
  email: string;
  invited_name: string | null;
  invite_type: "staff" | "couple" | "participant";
  assigned_role: string | null;
  role_in_event: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
  event_id: string | null;
}

interface Props {
  /** Filter to a specific invite_type, e.g. 'staff'. Omit to include all. */
  inviteType?: "staff" | "couple" | "participant";
  /** Filter to a specific event_id. Pass null to include only those without event_id. */
  eventId?: string;
  /** If passing event-scoped (couple+participant), limit to these types. */
  inviteTypes?: Array<"staff" | "couple" | "participant">;
  /** Title text shown above the table */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Render compact (used inside event panel) */
  compact?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  partner_1: "Partner",
  partner_2: "Partner",
  couple: "Partner",
  coordinator: "Coordinator",
  planner: "Planner",
  designer: "Designer",
  admin: "Admin",
  event_director: "Event Director",
  sales_manager: "Sales Manager",
  marketing: "Marketing",
  catering_manager: "Catering Manager",
  day_of_coordinator: "Day-of Coordinator",
};
const roleText = (inv: Invitation) => {
  const k = inv.assigned_role ?? inv.role_in_event ?? "";
  return ROLE_LABEL[k] ?? k.replace(/_/g, " ");
};

export default function PendingInvitesList({
  inviteType, eventId, inviteTypes, title = "Pending invitations", subtitle, compact,
}: Props) {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("invitations" as any)
      .select("id, email, invited_name, invite_type, assigned_role, role_in_event, status, expires_at, created_at, event_id")
      .in("status", ["pending", "expired"])
      .order("created_at", { ascending: false });
    if (inviteType) q = q.eq("invite_type", inviteType);
    if (inviteTypes && inviteTypes.length) q = q.in("invite_type", inviteTypes);
    if (eventId) q = q.eq("event_id", eventId);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    // Coerce expiry into "expired" on the fly for display
    const now = Date.now();
    const mapped: Invitation[] = ((data as any[]) ?? []).map((r: any) => ({
      ...r,
      status: r.status === "pending" && new Date(r.expires_at).getTime() < now ? "expired" : r.status,
    }));
    setInvites(mapped);
    setLoading(false);
  }, [inviteType, eventId, JSON.stringify(inviteTypes ?? [])]);

  useEffect(() => { load(); }, [load]);

  const resend = async (inv: Invitation) => {
    setBusyId(inv.id);
    const { data, error } = await supabase.functions.invoke("send-invitation", {
      body: { resend_id: inv.id, invite_type: inv.invite_type, email: inv.email },
    });
    setBusyId(null);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Resend failed"); return; }
    if (data?.emailDelivery?.sent === false) {
      toast.warning(`Token refreshed. Email could not be sent: ${data.emailDelivery.reason ?? "unknown"}`);
    } else {
      toast.success(`Invitation re-sent to ${inv.email}`);
    }
    load();
  };

  const revoke = async (inv: Invitation) => {
    if (!confirm(`Revoke invitation for ${inv.email}? The link will stop working immediately.`)) return;
    setBusyId(inv.id);
    const { error } = await supabase.from("invitations" as any).update({ status: "revoked" }).eq("id", inv.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Invitation revoked");
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invites.length) {
    return compact ? null : (
      <div className="rounded-xl border bg-white p-6" style={{ borderColor: "#E8E2D9" }}>
        <p className="font-display text-base font-light text-foreground">{title}</p>
        {subtitle && <p className="font-body text-xs text-muted-foreground mt-1">{subtitle}</p>}
        <p className="font-body text-sm text-muted-foreground mt-3">No outstanding invitations.</p>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "rounded-xl border bg-white overflow-hidden"} style={compact ? undefined : { borderColor: "#E8E2D9" }}>
      {!compact && (
        <div className="px-5 py-4 border-b" style={{ borderColor: "#E8E2D9" }}>
          <p className="font-display text-base font-light text-foreground">{title}</p>
          {subtitle && <p className="font-body text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="divide-y" style={{ borderColor: "#E8E2D9" }}>
        {invites.map((inv) => {
          const expired = inv.status === "expired";
          return (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF8F4]/60">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-body text-sm text-foreground truncate">
                    {inv.invited_name || inv.email}
                  </p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                    expired
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-sage/10 text-sage border-sage/25"
                  }`}>
                    {expired ? <AlertCircle size={9} /> : <Clock size={9} />}
                    {expired ? "Expired" : "Invited — pending"}
                  </span>
                  {(inv.assigned_role || inv.role_in_event) && (
                    <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                      {roleText(inv)}
                    </span>
                  )}
                </div>
                <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                  {inv.email} · invited {new Date(inv.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {!expired && ` · expires ${new Date(inv.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                </p>
              </div>
              <button
                onClick={() => resend(inv)}
                disabled={busyId === inv.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white font-body text-xs text-foreground hover:border-primary/40 disabled:opacity-50"
                title="Resend invitation"
              >
                {busyId === inv.id ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                Resend
              </button>
              <button
                onClick={() => revoke(inv)}
                disabled={busyId === inv.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white font-body text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 disabled:opacity-50"
                title="Revoke invitation"
              >
                <X size={12} />
                Revoke
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
