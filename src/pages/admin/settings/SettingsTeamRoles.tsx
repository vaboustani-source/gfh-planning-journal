import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS, type Role, type Section } from "@/lib/permissions";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Loader2, Plus, Shield, Trash2, X } from "lucide-react";

const ASSIGNABLE_ROLES: { value: Role; label: string; tagline: string }[] = [
  { value: "admin", label: "Admin (Owner)", tagline: "Full control, including this role screen" },
  { value: "event_director", label: "Event Director", tagline: "Full operations across all events" },
  { value: "sales_manager", label: "Sales Manager", tagline: "Sales roster + view-only on projects" },
  { value: "marketing", label: "Marketing", tagline: "Marketing roster & creative sections" },
  { value: "planner", label: "Planner", tagline: "Event & planning, no business intelligence" },
];

const SECTION_LABELS: Record<Section, string> = {
  event_planning: "Event Planning",
  vendors_experiences_decor: "Vendors, Experiences & Décor",
  our_people: "Our People (guests, lodging)",
  financials: "Financials",
  sales_roster: "Sales Roster",
  marketing_roster: "Marketing Roster",
  preferred_vendors_catalog: "Preferred Vendors Catalog",
  other_catalogs: "Other Catalogs (décor, layouts, forms)",
  settings: "Settings",
  tasting_notes: "Tasting Notes",
  gmail_inbox: "Gmail Inbox",
};

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-[#2C3E2D] text-white border-[#2C3E2D]",
  event_director: "bg-sage/15 text-sage border-sage/30",
  sales_manager: "bg-amber-100 text-amber-800 border-amber-300",
  marketing: "bg-rose-100 text-rose-800 border-rose-300",
  planner: "bg-blue-100 text-blue-800 border-blue-300",
  couple: "bg-stone-100 text-stone-700 border-stone-300",
  vendor: "bg-stone-100 text-stone-700 border-stone-300",
};

interface StaffUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

export default function SettingsTeamRoles() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState<{ user: StaffUser; newRole: Role } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<StaffUser | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const adminCount = useMemo(() => users.filter(u => u.role === "admin").length, [users]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, role")
      .not("role", "in", "(couple,vendor)")
      .order("first_name");
    if (error) { toast.error(error.message); }
    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="font-body text-sm text-muted-foreground">
        You don't have access to this section.
      </div>
    );
  }

  const displayName = (u: StaffUser) =>
    [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;

  const applyRoleChange = async (user: StaffUser, newRole: Role) => {
    setSavingId(user.id);
    const { error } = await supabase.from("users").update({ role: newRole }).eq("id", user.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Role updated for ${displayName(user)}`);
    load();
  };

  const handleRoleSelect = (user: StaffUser, newRole: Role) => {
    if (newRole === user.role) return;
    // Last-admin guard (client mirror; DB also enforces)
    if (user.role === "admin" && newRole !== "admin" && adminCount <= 1) {
      toast.error("At least one Admin must remain.");
      return;
    }
    if (user.id === profile?.id) {
      toast.error("You cannot change your own role.");
      return;
    }
    // Confirm when granting/removing Admin
    if (newRole === "admin" || user.role === "admin") {
      setPendingChange({ user, newRole });
      return;
    }
    applyRoleChange(user, newRole);
  };

  const handleRemove = async (user: StaffUser) => {
    if (user.role === "admin" && adminCount <= 1) {
      toast.error("At least one Admin must remain.");
      return;
    }
    if (user.id === profile?.id) {
      toast.error("You cannot remove yourself.");
      return;
    }
    setSavingId(user.id);
    const { error } = await supabase.from("users").delete().eq("id", user.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Removed ${displayName(user)}`);
    setPendingRemove(null);
    load();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">
            Admin only
          </p>
          <h1 className="font-display text-3xl font-light text-foreground">Team & Roles</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            App-wide role assignments. Changes apply instantly across every section.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2C3E2D] text-white font-body text-sm hover:opacity-90"
        >
          <Plus size={14} /> Invite Team Member
        </button>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E8E2D9" }}>
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center font-body text-sm text-muted-foreground">No team members yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[#FAF8F4]" style={{ borderColor: "#E8E2D9" }}>
                <th className="px-5 py-3 text-left font-body text-[10px] tracking-widest uppercase text-muted-foreground">Member</th>
                <th className="px-5 py-3 text-left font-body text-[10px] tracking-widest uppercase text-muted-foreground">Email</th>
                <th className="px-5 py-3 text-left font-body text-[10px] tracking-widest uppercase text-muted-foreground">Role</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "#E8E2D9" }}>
              {users.map(u => (
                <tr key={u.id} className="hover:bg-[#FAF8F4]/60">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
                        <span className="font-body text-xs text-sage font-medium">
                          {(u.first_name?.[0] ?? u.email[0]).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-body text-sm text-foreground">{displayName(u)}</span>
                      {u.id === profile?.id && (
                        <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">you</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-body text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 border font-body text-xs capitalize ${ROLE_BADGE[u.role] ?? "bg-stone-100 text-stone-700 border-stone-300"}`}>
                        <Shield size={10} />
                        {u.role.replace("_", " ")}
                      </span>
                      <select
                        disabled={u.id === profile?.id || savingId === u.id}
                        value={u.role}
                        onChange={(e) => handleRoleSelect(u, e.target.value as Role)}
                        className="font-body text-xs border rounded px-2 py-1 bg-white disabled:opacity-50"
                        style={{ borderColor: "#E8E2D9" }}
                      >
                        {ASSIGNABLE_ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                        {!ASSIGNABLE_ROLES.find(r => r.value === u.role) && (
                          <option value={u.role}>{u.role}</option>
                        )}
                      </select>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setPendingRemove(u)}
                      disabled={u.id === profile?.id}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                      title="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Role reference */}
      <section>
        <h2 className="font-display text-xl font-light text-foreground mb-3">Role reference</h2>
        <p className="font-body text-sm text-muted-foreground mb-4">
          What each role can access across the app. Pulled from the unified permission matrix.
        </p>
        <div className="space-y-2">
          {ASSIGNABLE_ROLES.map(r => (
            <Collapsible key={r.value}>
              <div className="rounded-xl border bg-white" style={{ borderColor: "#E8E2D9" }}>
                <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 border font-body text-xs ${ROLE_BADGE[r.value]}`}>
                        <Shield size={10} /> {r.label}
                      </span>
                    </div>
                    <p className="font-body text-xs text-muted-foreground mt-1">{r.tagline}</p>
                  </div>
                  <ChevronDown size={16} className="text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 border-t pt-4" style={{ borderColor: "#E8E2D9" }}>
                    {(Object.keys(SECTION_LABELS) as Section[]).map(section => {
                      const level = PERMISSIONS[section][r.value];
                      const tone = level === "full" ? "text-sage" : level === "view" ? "text-amber-700" : "text-stone-400";
                      const dot = level === "full" ? "bg-sage" : level === "view" ? "bg-amber-500" : "bg-stone-300";
                      return (
                        <div key={section} className="flex items-center gap-2 font-body text-xs">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
                          <span className="text-foreground flex-1">{SECTION_LABELS[section]}</span>
                          <span className={`uppercase tracking-widest text-[10px] ${tone}`}>{level}</span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </section>

      {/* Confirm admin grant/remove */}
      <AlertDialog open={!!pendingChange} onOpenChange={(o) => !o && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingChange?.newRole === "admin" ? "Grant Admin (Owner)?" : "Remove Admin (Owner)?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange && (
                <>
                  This will change <strong>{displayName(pendingChange.user)}</strong>'s role from{" "}
                  <em>{pendingChange.user.role}</em> to <em>{pendingChange.newRole}</em>. Admin (Owner)
                  has full control of the app including this role screen.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingChange) applyRoleChange(pendingChange.user, pendingChange.newRole);
              setPendingChange(null);
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm remove */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove && <>This will remove <strong>{displayName(pendingRemove)}</strong> from the team. They will lose all access immediately.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingRemove && handleRemove(pendingRemove)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onDone={() => { setShowInvite(false); load(); }} />
      )}
    </div>
  );
}

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("planner");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("invite-admin-user", {
      body: { first_name: firstName, last_name: lastName, email, role },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Invitation sent to ${email}`);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
        <h3 className="font-display text-2xl font-light text-foreground mb-1">Invite team member</h3>
        <p className="font-body text-xs text-muted-foreground mb-5">They'll get an email to set their password.</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name"
              className="border rounded px-3 py-2 font-body text-sm" style={{ borderColor: "#E8E2D9" }} />
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name"
              className="border rounded px-3 py-2 font-body text-sm" style={{ borderColor: "#E8E2D9" }} />
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required
            className="w-full border rounded px-3 py-2 font-body text-sm" style={{ borderColor: "#E8E2D9" }} />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}
            className="w-full border rounded px-3 py-2 font-body text-sm bg-white" style={{ borderColor: "#E8E2D9" }}>
            {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-[#2C3E2D] text-white font-body text-sm hover:opacity-90 disabled:opacity-50">
            {submitting ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
