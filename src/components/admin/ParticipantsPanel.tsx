import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Check, ChevronDown, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import AddParticipantModal from "./AddParticipantModal";
import { getSetPasswordUrl } from "@/lib/authUrls";

interface Participant {
  id: string;
  user_id: string | null;
  role_in_event: string;
  access_tier: number | null;
  user?: { first_name: string | null; last_name: string | null; email: string };
}

const TIER_CONFIG: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: "View Only", color: "text-muted-foreground", bg: "bg-muted/60", border: "border-border" },
  2: { label: "Messages Only", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  3: { label: "Full Access", color: "text-sage-dark", bg: "bg-sage/10", border: "border-sage/30" },
  4: { label: "Admin Light", color: "text-forest", bg: "bg-forest/10", border: "border-forest/30" },
};

export function getRoleLabel(role: string, partner1Name?: string, partner2Name?: string): string {
  const p1 = partner1Name || "Partner 1";
  const p2 = partner2Name || "Partner 2";
  const map: Record<string, string> = {
    partner_1: "Partner",
    partner_2: "Partner",
    couple: "Partner",
    coordinator: "Coordinator",
    catering_manager: "Catering Manager",
    day_of_coordinator: "Day-of Coordinator",
    parent_p1_1: `Parent of ${p1} #1`,
    parent_p1_2: `Parent of ${p1} #2`,
    parent_p2_1: `Parent of ${p2} #1`,
    parent_p2_2: `Parent of ${p2} #2`,
    planner: "Planner",
    designer: "Designer",
  };
  return map[role] || role;
}

function TierBadge({ tier, onChangeTier }: { tier: number; onChangeTier: (t: number) => void }) {
  const [open, setOpen] = useState(false);
  const config = TIER_CONFIG[tier] || TIER_CONFIG[1];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${config.bg} ${config.border} ${config.color} hover:opacity-80 transition-opacity`}
      >
        {config.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
            {[1, 2, 3, 4].map(t => {
              const c = TIER_CONFIG[t];
              return (
                <button
                  key={t}
                  onClick={() => { onChangeTier(t); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 font-body text-xs hover:bg-muted/60 flex items-center gap-2 ${tier === t ? "font-medium" : ""}`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.bg} ${c.border} border`} />
                  {c.label}
                  {tier === t && <Check size={10} className="ml-auto text-primary" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function ParticipantsPanel({ eventId }: { eventId: string }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [partnerNames, setPartnerNames] = useState<{ p1: string; p2: string }>({ p1: "", p2: "" });

  const fetchParticipants = async () => {
    const { data: euData } = await supabase
      .from("event_users")
      .select("id, user_id, role_in_event, access_tier")
      .eq("event_id", eventId);

    if (!euData || euData.length === 0) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    const userIds = euData.map(r => r.user_id).filter(Boolean) as string[];
    const { data: usersData } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", userIds);

    const userMap = new Map((usersData || []).map(u => [u.id, u]));
    const mapped = euData.map(eu => ({
      ...eu,
      user: eu.user_id ? userMap.get(eu.user_id) : undefined,
    }));

    // Extract partner names
    const p1 = mapped.find(p => p.role_in_event === "partner_1");
    const p2 = mapped.find(p => p.role_in_event === "partner_2");
    setPartnerNames({
      p1: p1?.user ? `${p1.user.first_name || ""} ${p1.user.last_name || ""}`.trim() : "",
      p2: p2?.user ? `${p2.user.first_name || ""} ${p2.user.last_name || ""}`.trim() : "",
    });

    // Sort: partners first, then coordinator, then rest
    const order = ["partner_1", "partner_2", "coordinator"];
    mapped.sort((a, b) => {
      const ai = order.indexOf(a.role_in_event);
      const bi = order.indexOf(b.role_in_event);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    setParticipants(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchParticipants(); }, [eventId]);

  const handleChangeTier = async (euId: string, tier: number) => {
    await supabase.from("event_users").update({ access_tier: tier }).eq("id", euId);
    setParticipants(prev => prev.map(p => p.id === euId ? { ...p, access_tier: tier } : p));
  };

  const handleRemove = async (euId: string) => {
    await supabase.from("event_users").delete().eq("id", euId);
    setParticipants(prev => prev.filter(p => p.id !== euId));
  };

  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResend = async (p: Participant) => {
    if (!p.user?.email) {
      toast.error("No email on file for this participant");
      return;
    }
    setResendingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("invite-participant", {
        body: {
          event_id: eventId,
          first_name: p.user.first_name || "",
          last_name: p.user.last_name || "",
          email: p.user.email,
          role_in_event: p.role_in_event,
          access_tier: p.access_tier || 3,
          redirect_to: getSetPasswordUrl(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.emailDelivery?.sent === false) {
        throw new Error(
          data.emailDelivery.rateLimited
            ? "Email wasn't sent because Supabase hit its rate limit. Wait a few minutes, then try again."
            : data.emailDelivery.reason || "Invite email was not sent."
        );
      }

      toast.success(`Invite email re-sent to ${p.user.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend invite");
    } finally {
      setResendingId(null);
    }
  };

  const isProtected = (role: string) => ["partner_1", "partner_2", "couple", "coordinator"].includes(role);

  return (
    <div className="rounded-xl bg-card border border-border p-6 space-y-4">
      <p className="font-display text-lg font-light text-foreground">Participants</p>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
      ) : participants.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">No participants yet.</p>
      ) : (
        <div className="space-y-2">
          {participants.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm text-foreground truncate">
                  {p.user ? `${p.user.first_name || ""} ${p.user.last_name || ""}`.trim() || p.user.email : "Unknown"}
                </p>
                <p className="font-body text-[11px] text-muted-foreground">
                  {getRoleLabel(p.role_in_event, partnerNames.p1, partnerNames.p2)}
                  {p.user?.email ? ` · ${p.user.email}` : ""}
                </p>
              </div>
              <TierBadge tier={p.access_tier || 3} onChangeTier={t => handleChangeTier(p.id, t)} />
              {p.user?.email && (
                <button
                  onClick={() => handleResend(p)}
                  disabled={resendingId === p.id}
                  title="Resend invite email"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary p-1 disabled:opacity-100"
                >
                  {resendingId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                </button>
              )}
              {!isProtected(p.role_in_event) && (
                <button
                  onClick={() => handleRemove(p.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 font-body text-sm text-primary hover:text-primary/80 transition-colors"
      >
        <Plus size={14} />
        Add Participant
      </button>

      {modalOpen && (
        <AddParticipantModal
          eventId={eventId}
          onClose={() => setModalOpen(false)}
          onAdded={fetchParticipants}
        />
      )}
    </div>
  );
}
