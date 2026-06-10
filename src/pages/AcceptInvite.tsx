import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Inv = {
  id: string;
  email: string;
  invite_type: "staff" | "couple" | "participant";
  assigned_role: string | null;
  event_id: string | null;
  invited_name: string | null;
  status: string;
  expires_at: string;
};

type EventInfo = { title: string | null };

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inv, setInv] = useState<Inv | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load invitation
  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id,email,invite_type,assigned_role,event_id,invited_name,status,expires_at")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setError("This invitation could not be found.");
      } else if (data.status === "accepted") {
        setError("This invitation has already been used. Please sign in instead.");
      } else if (data.status === "revoked") {
        setError("This invitation has been revoked. Please contact your coordinator.");
      } else if (new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired. Please contact your coordinator.");
      } else {
        setInv(data as Inv);
        if (data.invited_name) {
          const parts = data.invited_name.split(" ");
          setFirstName(parts[0] ?? "");
          setLastName(parts.slice(1).join(" "));
        }
        if (data.event_id) {
          const { data: ev } = await supabase
            .from("events").select("title").eq("id", data.event_id).single();
          setEvent(ev ?? null);
        }
      }
      setLoading(false);
    })();
  }, [token]);

  // If we landed back from Google with an active session, auto-accept.
  useEffect(() => {
    if (!inv) return;
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (session?.user) await acceptWithSession();
    });
    // Also check current session immediately
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) acceptWithSession();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv]);

  const acceptWithSession = async () => {
    if (!inv) return;
    setSubmitting(true);
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess.session?.access_token;
    const { data, error } = await supabase.functions.invoke("accept-invitation", {
      body: { token },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    setSubmitting(false);
    if (error || data?.error) {
      // Mismatched Google account: sign them out and show message
      const msg = (data?.error || error?.message || "").toString();
      if (msg.toLowerCase().includes("invitation was sent to")) {
        await supabase.auth.signOut();
        setError(msg);
        return;
      }
      setError(msg || "We couldn't complete the invitation.");
      return;
    }
    navigate(data.landing ?? "/login", { replace: true });
  };

  const handleGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/accept-invite/${token}` },
    });
    if (error) setError(error.message);
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inv) return;
    if (password.length < 8) { setError("Please choose a password with at least 8 characters."); return; }
    setError(null);
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("accept-invitation", {
      body: { token, password, first_name: firstName, last_name: lastName },
    });
    if (error || data?.error) {
      setSubmitting(false);
      setError(data?.error || error?.message || "Something went wrong");
      return;
    }
    // Sign them in with the new password so they land authenticated
    await supabase.auth.signInWithPassword({ email: inv.email, password });
    navigate(data.landing ?? "/login", { replace: true });
  };

  const heading = (() => {
    if (!inv) return "Welcome";
    if (inv.invite_type === "staff") return "Welcome to the team";
    if (inv.invite_type === "couple") return "Welcome — let's set up your wedding portal";
    return `You've been invited to help with ${event?.title ?? "this wedding"}`;
  })();

  const subline = (() => {
    if (!inv) return "";
    if (inv.invite_type === "staff")
      return "Set up your access to the Gilbertsville Farmhouse Planning Journal. This takes about a minute.";
    if (inv.invite_type === "couple")
      return "Your private planning portal is ready. Choose how you'd like to sign in and we'll bring you straight to it.";
    return "Choose how you'd like to sign in and we'll bring you straight to the parts of the portal that are yours to help with.";
  })();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FAF8F4" }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-light tracking-wide" style={{ color: "#2C3E2D" }}>
            Gilbertsville Farmhouse
          </h1>
          <p className="font-display text-lg italic text-muted-foreground font-light">Planning Journal</p>
          <div className="mt-4 h-px w-16 mx-auto" style={{ background: "rgba(91,111,86,0.3)" }} />
        </div>

        <div className="bg-white rounded-2xl border p-8 shadow-sm" style={{ borderColor: "#E8E2D9" }}>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <div className="text-center py-4">
              <h2 className="font-display text-2xl font-light mb-3" style={{ color: "#2C3E2D" }}>
                We can't open this invitation
              </h2>
              <p className="font-body text-sm text-muted-foreground mb-6">{error}</p>
              <button onClick={() => navigate("/login")}
                className="font-body text-sm underline text-sage hover:opacity-80">Go to sign in</button>
            </div>
          ) : inv ? (
            <>
              <h2 className="font-display text-2xl md:text-3xl font-light text-center mb-3" style={{ color: "#2C3E2D" }}>
                {heading}
              </h2>
              <p className="font-body text-sm text-muted-foreground text-center mb-1">
                {subline}
              </p>
              <p className="font-body text-xs text-muted-foreground text-center mb-7">
                Invitation for <span className="font-medium text-foreground">{inv.email}</span>
              </p>

              <button
                onClick={handleGoogle}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 rounded bg-white border px-6 py-3 font-body text-sm font-medium hover:bg-sage/5 transition-colors disabled:opacity-50"
                style={{ borderColor: "#E8E2D9", color: "#2C3E2D" }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-border" />
                <span className="font-body text-[11px] uppercase tracking-widest text-muted-foreground">Or set a password</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handlePassword} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name"
                    className="border rounded px-3 py-2.5 font-body text-sm" style={{ borderColor: "#E8E2D9" }} />
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name"
                    className="border rounded px-3 py-2.5 font-body text-sm" style={{ borderColor: "#E8E2D9" }} />
                </div>
                <input type="email" value={inv.email} readOnly
                  className="w-full border rounded px-3 py-2.5 font-body text-sm bg-stone-50 text-muted-foreground"
                  style={{ borderColor: "#E8E2D9" }} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a password (8+ characters)" required minLength={8}
                  className="w-full border rounded px-3 py-2.5 font-body text-sm" style={{ borderColor: "#E8E2D9" }} />
                <button type="submit" disabled={submitting}
                  className="w-full py-3 rounded font-body text-sm tracking-wide text-white hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#5b6f56" }}>
                  {submitting ? "Setting up your access…" : "Set Up Your Access"}
                </button>
              </form>

              <p className="font-body text-[11px] text-center text-muted-foreground mt-6">
                This invitation expires {new Date(inv.expires_at).toLocaleDateString()}.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
