import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import farmhouseHero from "@/assets/farmhouse-hero.jpg";

export default function SetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  // Supabase recovery links land here either as:
  //   - PKCE flow: ?code=... in the query string (needs exchangeCodeForSession)
  //   - Implicit flow: #access_token=...&type=recovery in the hash (auto-handled by client)
  // Handle both, then mark the session ready so the form unlocks.
  useEffect(() => {
    let cancelled = false;

    // Safety: stop "Verifying your link…" from spinning forever.
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setError((prev) => prev || "This link could not be verified. It may have expired — please request a new one.");
      }
    }, 12000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setSessionReady(true);
        }
      }
    });

    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const queryErrDesc = url.searchParams.get("error_description");

      // Errors can also arrive in the hash fragment (#error_description=...)
      const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
      const hashParams = new URLSearchParams(hash);
      const hashErrDesc = hashParams.get("error_description");
      const errDesc = queryErrDesc || hashErrDesc;

      if (errDesc) {
        clearTimeout(timeoutId);
        if (!cancelled) setError(decodeURIComponent(errDesc.replace(/\+/g, " ")));
        return;
      }

      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          clearTimeout(timeoutId);
          if (!cancelled) setError(exErr.message || "This link is invalid or has expired.");
          return;
        }
        window.history.replaceState({}, "", url.pathname);
        if (!cancelled) {
          clearTimeout(timeoutId);
          setSessionReady(true);
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session && !cancelled) {
        clearTimeout(timeoutId);
        setSessionReady(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);

      // Decide post-success destination: portal for couples, admin for admins,
      // login as fallback if profile lookup fails.
      let dest = "/login";
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          dest = profile?.role === "admin" ? "/admin" : "/portal";
        }
      } catch {
        dest = "/login";
      }
      setTimeout(() => navigate(dest, { replace: true }), 1800);
    } catch (err: any) {
      setError(err.message ?? "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left: illustration */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src={farmhouseHero}
          alt="Gilbertsville Farmhouse"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest/30 to-transparent" />
        <div className="absolute bottom-12 left-12 text-primary-foreground">
          <p className="font-body text-xs tracking-widest uppercase opacity-70 mb-2">
            Est. Gilbertsville, PA
          </p>
          <p className="font-display text-2xl italic text-primary-foreground/90">
            Where every detail is<br />tended with care.
          </p>
        </div>
      </div>

      {/* Right: set password form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-background px-8 py-16">
        <div className="w-full max-w-md animate-fade-up">
          {/* Wordmark */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-sage/10 border border-sage/20 mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sage">
                <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <h1 className="font-display text-4xl font-light tracking-wide text-foreground mb-1">
              Gilbertsville
            </h1>
            <p className="font-display text-xl italic text-muted-foreground font-light">
              Farmhouse
            </p>
            <div className="mt-4 h-px w-16 bg-sage/30 mx-auto" />
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-sage/15 border border-sage/25 mb-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sage">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="font-display text-2xl font-light text-foreground">
                Password set!
              </h2>
              <p className="font-body text-sm text-muted-foreground">
                Redirecting you to sign in…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="font-display text-2xl font-light text-foreground text-center mb-1">
                  Set your password
                </h2>
                <p className="font-body text-sm text-muted-foreground text-center">
                  Choose a password to access your planning portal
                </p>
              </div>

              {!sessionReady ? (
                <div className="text-center space-y-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-sage border-t-transparent mx-auto" />
                  <p className="font-body text-sm text-muted-foreground">
                    Verifying your link…
                  </p>
                  <p className="font-body text-xs text-muted-foreground/60">
                    If this takes too long, the link may have expired.{" "}
                    <button
                      onClick={() => navigate("/login")}
                      className="text-primary underline underline-offset-2"
                    >
                      Return to login
                    </button>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="font-body text-xs tracking-widest uppercase text-muted-foreground font-medium">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      className="w-full rounded bg-card border border-border px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-body text-xs tracking-widest uppercase text-muted-foreground font-medium">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      className="w-full rounded bg-card border border-border px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>

                  {error && (
                    <div className="rounded bg-destructive/8 border border-destructive/20 px-4 py-3">
                      <p className="font-body text-sm text-destructive">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded bg-primary px-6 py-3.5 font-body text-sm tracking-wide font-medium text-primary-foreground hover:bg-sage-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Setting password…
                      </span>
                    ) : (
                      "Set Password"
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          <p className="mt-10 text-center">
            <button
              onClick={() => navigate("/login")}
              className="font-body text-xs tracking-wide text-primary/70 hover:text-primary underline underline-offset-4 transition-colors"
            >
              ← Back to sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
