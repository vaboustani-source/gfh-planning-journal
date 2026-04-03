import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ROLES = [
  { value: "catering_manager", label: "Catering Manager" },
  { value: "day_of_coordinator", label: "Day-of Coordinator" },
  { value: "parent_p1_1", label: "Parent of Partner 1 #1" },
  { value: "parent_p1_2", label: "Parent of Partner 1 #2" },
  { value: "parent_p2_1", label: "Parent of Partner 2 #1" },
  { value: "parent_p2_2", label: "Parent of Partner 2 #2" },
  { value: "planner", label: "Planner" },
  { value: "designer", label: "Designer" },
];

const TIERS = [
  { value: 1, label: "View Only", desc: "Can see the portal but not edit anything" },
  { value: 2, label: "Messages Only", desc: "Can only send and receive messages" },
  { value: 3, label: "Full Couple Access", desc: "Same as the couple, can fill out forms" },
  { value: 4, label: "Admin Light", desc: "Sees everything except financials" },
];

interface Props {
  eventId: string;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddParticipantModal({ eventId, onClose, onAdded }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("planner");
  const [tier, setTier] = useState(3);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !firstName.trim()) return;
    setSaving(true);

    try {
      // Use service role via edge function to create user
      const { data, error } = await supabase.functions.invoke("invite-participant", {
        body: {
          event_id: eventId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          role_in_event: role,
          access_tier: tier,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Participant added successfully");
      onAdded();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to add participant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-forest/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-elevated w-full max-w-md mx-4 p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <p className="font-display text-lg font-light text-foreground">Add Participant</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-body text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">First Name *</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="font-body text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Last Name</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="font-body text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="font-body text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <label className="font-body text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Access Level</label>
            <div className="space-y-2">
              {TIERS.map(t => (
                <label
                  key={t.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    tier === t.value ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    checked={tier === t.value}
                    onChange={() => setTier(t.value)}
                    className="mt-0.5 accent-[hsl(var(--primary))]"
                  />
                  <div>
                    <p className="font-body text-sm font-medium text-foreground">{t.label}</p>
                    <p className="font-body text-[11px] text-muted-foreground">{t.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !email.trim() || !firstName.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Add Participant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
