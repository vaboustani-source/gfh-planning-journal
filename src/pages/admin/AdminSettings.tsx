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

        {/* ── OFF-SITE HOTELS ── */}
        <OffsiteHotelsSection />

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

/* ── Off-Site Hotels ── */
interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  distance_minutes: number | null;
  distance_description: string | null;
  amenities: string[] | null;
  notes: string | null;
  is_primary: boolean | null;
  coming_soon: boolean | null;
  active: boolean | null;
  sort_order: number | null;
}

function OffsiteHotelsSection() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchHotels = async () => {
    setLoading(true);
    const { data } = await supabase.from("offsite_hotels").select("*").order("sort_order", { ascending: true }).order("name");
    setHotels((data ?? []) as Hotel[]);
    setLoading(false);
  };

  useEffect(() => { fetchHotels(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this hotel? This cannot be undone.")) return;
    await supabase.from("offsite_hotels").delete().eq("id", id);
    fetchHotels();
  };

  const openNew = () => { setEditing(null); setShowModal(true); };
  const openEdit = (h: Hotel) => { setEditing(h); setShowModal(true); };

  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Section 3</p>
          <h2 className="font-display text-3xl font-light text-foreground">Off-Site Hotels</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">Hotels recommended to off-site guests across all events</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Add Hotel
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : hotels.length === 0 ? (
          <div className="p-8 text-center">
            <Hotel size={24} className="text-muted-foreground/40 mx-auto mb-2" />
            <p className="font-body text-sm text-muted-foreground">No hotels yet. Add your first off-site recommendation.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {hotels.map(h => (
              <li key={h.id} className={`p-5 flex items-start gap-4 hover:bg-muted/20 transition-colors ${h.is_primary ? "border-l-4 border-l-amber-400" : ""}`}>
                <div className="w-10 h-10 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center shrink-0">
                  <Hotel size={16} className="text-sage" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display text-lg font-light text-foreground">{h.name}</p>
                    {h.is_primary && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 font-body text-[10px] text-amber-700">
                        <Star size={9} className="fill-amber-500 text-amber-500" /> Principal
                      </span>
                    )}
                    {h.coming_soon && (
                      <span className="rounded-full bg-muted border border-border px-2 py-0.5 font-body text-[10px] text-muted-foreground uppercase tracking-wider">Coming Soon</span>
                    )}
                    {!h.active && (
                      <span className="rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 font-body text-[10px] text-destructive">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap font-body text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin size={11} /> {h.city}</span>
                    {h.distance_description && <span>· {h.distance_description}</span>}
                    {h.phone && <span className="flex items-center gap-1"><Phone size={11} /> {h.phone}</span>}
                    {h.website && <span className="flex items-center gap-1"><Globe size={11} /> {h.website.replace(/^https?:\/\//, "")}</span>}
                  </div>
                  {h.amenities && h.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {h.amenities.map((a, i) => (
                        <span key={i} className="rounded-full bg-sage/10 border border-sage/20 px-2 py-0.5 font-body text-[10px] text-sage-dark">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(h)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(h.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <HotelModal
          hotel={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchHotels(); }}
        />
      )}
    </section>
  );
}

function HotelModal({ hotel, onClose, onSaved }: { hotel: Hotel | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: hotel?.name ?? "",
    city: hotel?.city ?? "",
    address: hotel?.address ?? "",
    phone: hotel?.phone ?? "",
    website: hotel?.website ?? "",
    distance_minutes: hotel?.distance_minutes?.toString() ?? "",
    distance_description: hotel?.distance_description ?? "",
    amenities: (hotel?.amenities ?? []).join(", "),
    notes: hotel?.notes ?? "",
    is_primary: hotel?.is_primary ?? false,
    coming_soon: hotel?.coming_soon ?? false,
    active: hotel?.active ?? true,
    sort_order: hotel?.sort_order?.toString() ?? "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.city.trim()) { setError("Name and city are required."); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      distance_minutes: form.distance_minutes ? parseInt(form.distance_minutes, 10) : null,
      distance_description: form.distance_description.trim() || null,
      amenities: form.amenities.split(",").map(s => s.trim()).filter(Boolean),
      notes: form.notes.trim() || null,
      is_primary: form.is_primary,
      coming_soon: form.coming_soon,
      active: form.active,
      sort_order: parseInt(form.sort_order, 10) || 0,
    };
    const { error: err } = hotel
      ? await supabase.from("offsite_hotels").update(payload).eq("id", hotel.id)
      : await supabase.from("offsite_hotels").insert(payload);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
              <Hotel size={14} className="text-sage" />
            </div>
            <p className="font-display text-xl font-light text-foreground">{hotel ? "Edit Hotel" : "Add Hotel"}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Hotel Name *" value={form.name} onChange={v => set("name", v)} placeholder="The Otesaga" />
              <ModalField label="City *" value={form.city} onChange={v => set("city", v)} placeholder="Cooperstown, NY" />
            </div>
            <ModalField label="Address" value={form.address} onChange={v => set("address", v)} placeholder="60 Lake St" />
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Phone" value={form.phone} onChange={v => set("phone", v)} placeholder="(607) 555-1234" />
              <ModalField label="Website" value={form.website} onChange={v => set("website", v)} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Distance (minutes)" value={form.distance_minutes} onChange={v => set("distance_minutes", v)} type="number" placeholder="25" />
              <ModalField label="Distance Description" value={form.distance_description} onChange={v => set("distance_description", v)} placeholder="25 min drive" />
            </div>
            <div>
              <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Amenities (comma-separated)</p>
              <input
                type="text"
                value={form.amenities}
                onChange={e => set("amenities", e.target.value)}
                placeholder="Pool, Spa, Restaurant, Free WiFi"
                className="w-full border border-border rounded-lg px-3 py-2.5 font-body text-sm bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div>
              <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Notes</p>
              <textarea
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                rows={2}
                placeholder="Internal notes about this hotel…"
                className="w-full border border-border rounded-lg px-3 py-2.5 font-body text-sm bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors resize-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Toggle label="Principal" checked={form.is_primary} onChange={v => set("is_primary", v)} />
              <Toggle label="Coming Soon" checked={form.coming_soon} onChange={v => set("coming_soon", v)} />
              <Toggle label="Active" checked={form.active} onChange={v => set("active", v)} />
            </div>
            <ModalField label="Sort Order" value={form.sort_order} onChange={v => set("sort_order", v)} type="number" placeholder="0" />

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                <p className="font-body text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/10 sticky bottom-0">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : hotel ? "Save Changes" : "Add Hotel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border font-body text-sm transition-colors ${
        checked ? "bg-sage/10 border-sage/40 text-sage-dark" : "border-border text-muted-foreground bg-background hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <div className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${checked ? "bg-sage" : "bg-muted"}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
    </button>
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
