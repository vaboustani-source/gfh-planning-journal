import { useEffect, useState, useCallback } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
const supabase = supabaseTyped as any;
import { useAuth } from "@/hooks/useAuth";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";

type ParticipantRole = "partner" | "admin" | "planner" | "family" | "vendor" | "other";

interface Participant {
  id: string;
  event_id: string;
  user_id: string | null;
  email: string;
  display_name: string;
  role: ParticipantRole;
  color: string;
  created_at: string | null;
}

const ROLE_OPTIONS: { value: ParticipantRole; label: string }[] = [
  { value: "partner", label: "Partner" },
  { value: "admin", label: "Admin" },
  { value: "planner", label: "Planner" },
  { value: "family", label: "Family" },
  { value: "vendor", label: "Vendor" },
  { value: "other", label: "Other" },
];

const COLOR_PALETTE = [
  "#648857", "#C9A84C", "#8B6F47", "#5B7D6F",
  "#A67C52", "#4A6B5C", "#B59D6F", "#6B8A7A",
];

const ROLE_ORDER: Record<ParticipantRole, number> = {
  admin: 0, partner: 1, planner: 2, family: 3, vendor: 4, other: 5,
};

function sortParticipants(list: Participant[]): Participant[] {
  return [...list].sort((a, b) => {
    const r = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (r !== 0) return r;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

interface Props {
  eventId: string;
}

export default function PeopleTab({ eventId }: Props) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Participant | null>(null);
  const [deleting, setDeleting] = useState<Participant | null>(null);

  const fetchParticipants = useCallback(async () => {
    const { data, error } = await supabase
      .from("event_participants")
      .select("*")
      .eq("event_id", eventId);
    if (error) {
      toast.error("Couldn't load participants");
      setLoading(false);
      return;
    }
    setParticipants(sortParticipants((data ?? []) as Participant[]));
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-[32px] leading-tight font-light text-foreground">People</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Everyone on this event's Planning Hub.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-body text-sm px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus size={16} /> Add Participant
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" />
        </div>
      ) : participants.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-display italic text-[18px] text-muted-foreground mb-6">
            No people added yet. The table is quiet.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-body text-sm px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Add Participant
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {participants.map((p, idx) => (
            <ParticipantRow
              key={p.id}
              p={p}
              isLast={idx === participants.length - 1}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <ParticipantModal
          mode="add"
          eventId={eventId}
          adminId={user?.id ?? null}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); fetchParticipants(); }}
        />
      )}
      {editing && (
        <ParticipantModal
          mode="edit"
          eventId={eventId}
          adminId={user?.id ?? null}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchParticipants(); }}
        />
      )}
      {deleting && (
        <DeleteModal
          participant={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); fetchParticipants(); }}
        />
      )}
    </div>
  );
}

function ParticipantRow({
  p, isLast, onEdit, onDelete,
}: { p: Participant; isLast: boolean; onEdit: () => void; onDelete: () => void }) {
  const initial = (p.display_name?.trim()?.[0] ?? "?").toUpperCase();
  const invited = p.user_id === null;

  return (
    <div
      className={`group flex items-center gap-4 px-5 py-4 ${!isLast ? "border-b border-border" : ""}`}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: p.color }}
      >
        <span className="font-display font-bold text-base" style={{ color: "#FAF8F4" }}>
          {initial}
        </span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0">
          <p className="font-body text-base text-foreground truncate">{p.display_name}</p>
          <p className="font-body text-[12px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {p.role}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto sm:mr-3 mt-1 sm:mt-0 min-w-0">
          <p className="font-body text-[13px] text-muted-foreground truncate">{p.email}</p>
          {invited && (
            <span
              className="font-body text-[11px] px-2 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: "rgba(201, 168, 76, 0.15)", color: "#9C8138" }}
            >
              Invited
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          aria-label="Edit participant"
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onDelete}
          aria-label="Remove participant"
          className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

interface ModalProps {
  mode: "add" | "edit";
  eventId: string;
  adminId: string | null;
  initial?: Participant;
  onClose: () => void;
  onSaved: () => void;
}

function ParticipantModal({ mode, eventId, adminId, initial, onClose, onSaved }: ModalProps) {
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<ParticipantRole>(initial?.role ?? "family");
  const [color, setColor] = useState<string>(
    initial?.color ?? COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]
  );
  const [saving, setSaving] = useState(false);

  const canSubmit = displayName.trim() && isValidEmail(email) && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);

    try {
      if (mode === "add") {
        const { error } = await supabase.from("event_participants").insert({
          event_id: eventId,
          email: email.trim().toLowerCase(),
          display_name: displayName.trim(),
          role,
          color,
          user_id: null,
          added_by: adminId,
        });
        if (error) throw error;
        toast.success("Added to the event.");
      } else if (initial) {
        const { error } = await supabase
          .from("event_participants")
          .update({
            display_name: displayName.trim(),
            role,
            color,
          })
          .eq("id", initial.id);
        if (error) throw error;
        toast.success("Participant updated.");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Couldn't save participant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-forest/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-elevated w-full max-w-md mx-4 p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-[24px] font-light text-foreground leading-tight">
            {mode === "add" ? "Add someone to this event" : "Edit participant"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-body text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
              Display Name *
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="font-body text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={mode === "edit"}
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {mode === "edit" && (
              <p className="font-body text-[11px] text-muted-foreground mt-1">
                Email can't be changed — it's how we identify them.
              </p>
            )}
          </div>

          <div>
            <label className="font-body text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ParticipantRole)}
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-body text-[11px] text-muted-foreground uppercase tracking-wider block mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => {
                const selected = c.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Select color ${c}`}
                    className={`w-9 h-9 rounded-full transition-all ${
                      selected ? "ring-2 ring-offset-2 ring-primary scale-105" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {mode === "add" ? "Add Participant" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteModal({
  participant, onClose, onDeleted,
}: { participant: Participant; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("event_participants")
        .delete()
        .eq("id", participant.id);
      if (error) throw error;
      toast.success("Removed from the event.");
      onDeleted();
    } catch (err: any) {
      toast.error(err.message || "Couldn't remove participant");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-forest/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-elevated w-full max-w-md mx-4 p-6 animate-fade-up">
        <h2 className="font-display text-[22px] font-light text-foreground leading-tight mb-3">
          Remove {participant.display_name} from this event?
        </h2>
        <p className="font-body text-[15px] text-muted-foreground mb-6 leading-relaxed">
          They'll lose access to messages, documents, and the Planning Hub for this event. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {deleting ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
