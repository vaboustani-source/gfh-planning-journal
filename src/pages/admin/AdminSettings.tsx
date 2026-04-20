import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, UserCog, Plus, X, Loader2, Mail, Shield, Hotel, Pencil, Trash2, Star, MapPin, Phone, Globe } from "lucide-react";

interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

interface CoupleUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  event_title: string | null;
  event_id: string | null;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "coordinator", label: "Coordinator" },
];

export default function AdminSettings() {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [couples, setCouples] = useState<CoupleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: adminData }, { data: coupleData }] = await Promise.all([
        supabase.from("users").select("id, first_name, last_name, email, role").eq("role", "admin").order("first_name"),
        supabase.from("users").select("id, first_name, last_name, email").eq("role", "couple").order("first_name"),
      ]);

      setAdmins(adminData ?? []);

      // Enrich couples with their event
      const coupleIds = (coupleData ?? []).map(u => u.id);
      let enriched: CoupleUser[] = (coupleData ?? []).map(u => ({ ...u, event_title: null, event_id: null }));

      if (coupleIds.length > 0) {
        const { data: euData } = await supabase
          .from("event_users")
          .select("user_id, event_id")
          .in("user_id", coupleIds);

        const eventIds = [...new Set((euData ?? []).map(e => e.event_id).filter(Boolean))] as string[];

        if (eventIds.length > 0) {
          const { data: eventsData } = await supabase
            .from("events")
            .select("id, title")
            .in("id", eventIds);

          const eventMap = Object.fromEntries((eventsData ?? []).map(e => [e.id, e.title]));
          const userEventMap = Object.fromEntries((euData ?? []).map(e => [e.user_id, e.event_id]));

          enriched = enriched.map(u => ({
            ...u,
            event_id: userEventMap[u.id] ?? null,
            event_title: userEventMap[u.id] ? (eventMap[userEventMap[u.id]] ?? null) : null,
          }));
        }
      }

      setCouples(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const displayName = (u: { first_name: string | null; last_name: string | null; email: string }) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
    return name || u.email;
  };

  const initials = (u: { first_name: string | null; last_name: string | null; email: string }) => {
    if (u.first_name) return (u.first_name[0] + (u.last_name?.[0] ?? "")).toUpperCase();
    return u.email[0].toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
              <UserCog size={12} className="text-sage" />
            </div>
            <span className="font-display text-xl font-light text-foreground">Settings</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* ── TEAM ACCOUNTS ── */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Section 1</p>
              <h2 className="font-display text-3xl font-light text-foreground">Team Accounts</h2>
              <p className="font-body text-sm text-muted-foreground mt-1">Staff with admin-level access to all events</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity"
            >
              <Plus size={14} />
              Add Team Member
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : admins.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-body text-sm text-muted-foreground">No team members found.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-5 py-3 text-left font-body text-[10px] tracking-widest uppercase text-muted-foreground">Name</th>
                    <th className="px-5 py-3 text-left font-body text-[10px] tracking-widest uppercase text-muted-foreground">Email</th>
                    <th className="px-5 py-3 text-left font-body text-[10px] tracking-widest uppercase text-muted-foreground">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {admins.map(user => (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center shrink-0">
                            <span className="font-body text-xs text-sage font-medium">{initials(user)}</span>
                          </div>
                          <span className="font-body text-sm text-foreground">{displayName(user)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Mail size={12} className="text-muted-foreground shrink-0" />
                          <span className="font-body text-sm text-muted-foreground">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Shield size={12} className="text-sage shrink-0" />
                          <span className="inline-flex items-center rounded-full bg-sage/8 border border-sage/20 px-2.5 py-0.5 font-body text-xs text-sage capitalize">
                            {user.role}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── COUPLE ACCOUNTS ── */}
        <section>
          <div className="mb-6">
            <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Section 2</p>
            <h2 className="font-display text-3xl font-light text-foreground">Couple Accounts</h2>
            <p className="font-body text-sm text-muted-foreground mt-1">All couples with portal access — manage via their event record</p>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : couples.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-body text-sm text-muted-foreground">No couple accounts yet. Create a new event to invite a couple.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-5 py-3 text-left font-body text-[10px] tracking-widest uppercase text-muted-foreground">Name</th>
                    <th className="px-5 py-3 text-left font-body text-[10px] tracking-widest uppercase text-muted-foreground">Email</th>
                    <th className="px-5 py-3 text-left font-body text-[10px] tracking-widest uppercase text-muted-foreground">Linked Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {couples.map(user => (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <span className="font-body text-xs text-primary font-medium">{initials(user)}</span>
                          </div>
                          <span className="font-body text-sm text-foreground">{displayName(user)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Mail size={12} className="text-muted-foreground shrink-0" />
                          <span className="font-body text-sm text-muted-foreground">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {user.event_id ? (
                          <button
                            onClick={() => navigate(`/admin/events/${user.event_id}`)}
                            className="font-body text-sm text-sage hover:text-sage-dark underline-offset-2 hover:underline transition-colors"
                          >
                            {user.event_title ?? "View event"}
                          </button>
                        ) : (
                          <span className="font-body text-sm text-muted-foreground/50 italic">Unlinked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </main>

      {/* Add Team Member Modal */}
      {showModal && (
        <AddTeamMemberModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}

/* ── Modal ── */
function AddTeamMemberModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", role: "admin" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = (field: keyof typeof form, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.email) { setError("Email is required."); return; }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("invite-admin-user", { body: form });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setSuccess(true);
      setTimeout(onSuccess, 1400);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
              <Users size={14} className="text-sage" />
            </div>
            <div>
              <p className="font-display text-xl font-light text-foreground">Add Team Member</p>
              <p className="font-body text-xs text-muted-foreground">They'll receive a login link by email</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {success ? (
              <div className="rounded-lg bg-sage/10 border border-sage/25 px-4 py-4 text-center">
                <p className="font-body text-sm text-sage font-medium">✓ Invitation sent successfully!</p>
                <p className="font-body text-xs text-muted-foreground mt-1">{form.email} will receive a login link.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <ModalField label="First Name" value={form.first_name} onChange={v => set("first_name", v)} placeholder="Jane" />
                  <ModalField label="Last Name" value={form.last_name} onChange={v => set("last_name", v)} placeholder="Smith" />
                </div>
                <ModalField label="Email Address *" value={form.email} onChange={v => set("email", v)} type="email" placeholder="jane@example.com" />
                <div>
                  <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Role</p>
                  <div className="flex gap-2">
                    {ROLE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set("role", opt.value)}
                        className={`flex-1 py-2.5 rounded-lg border font-body text-sm transition-colors ${
                          form.role === opt.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground bg-background"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                    <p className="font-body text-sm text-destructive">{error}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {!success && (
            <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/10">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : "Send Invitation"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function ModalField({
  label, value, onChange, type = "text", placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-lg px-3 py-2.5 font-body text-sm bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
      />
    </div>
  );
}
