import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getSetPasswordUrl } from "@/lib/authUrls";


const LOGIN_TIMEOUT_MS = 10_000;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResetPassword = async () => {
    if (!email) {
      setError("Enter your email address first, then click this link.");
      return;
    }
    setResetLoading(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getSetPasswordUrl(),
      });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to send reset email.");
    } finally {
      setResetLoading(false);
    }
  };

  // Navigate once profile is loaded post-login
  useEffect(() => {
    if (profile) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      if (profile.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/portal", { replace: true });
      }
    }
  }, [profile, navigate]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Arm a timeout so the spinner never spins forever
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError("Connection timeout — please try again.");
    }, LOGIN_TIMEOUT_MS);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setLoading(false);
        // Show the real Supabase error message for easier debugging
        setError(signInError.message ?? "Invalid email or password. Please try again.");
      }
      // On success: loading stays true; profile useEffect above will clear it + redirect
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      setError(err?.message ?? "An unexpected error occurred.");
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col items-center justify-center bg-background px-8 py-16">
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
              Gilbertsville Farmhouse
            </h1>
            <p className="font-display text-xl italic text-muted-foreground font-light">
              Planning Journal
            </p>
            <div className="mt-4 h-px w-16 bg-sage/30 mx-auto" />
          </div>

          <div className="mb-8">
            <h2 className="font-display text-2xl font-light text-foreground text-center mb-1">
              Welcome back
            </h2>
            <p className="font-body text-sm text-muted-foreground text-center">
              Sign in to access your planning portal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <button
              type="button"
              onClick={async () => {
                setError("");
                const { error: oauthError } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${window.location.origin}/login` },
                });
                if (oauthError) setError(oauthError.message);
              }}
              className="w-full flex items-center justify-center gap-3 rounded bg-white border border-border px-6 py-3 font-body text-sm font-medium text-foreground hover:bg-sage/5 hover:border-sage/40 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="font-body text-xs tracking-widest uppercase text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <label className="font-body text-xs tracking-widest uppercase text-muted-foreground font-medium">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="your@email.com"
                className="w-full rounded bg-card border border-border px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="font-body text-xs tracking-widest uppercase text-muted-foreground font-medium">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
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
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Password setup / reset links */}
          <div className="mt-6 space-y-3 text-center">
            {resetSent ? (
              <div className="rounded bg-sage/10 border border-sage/20 px-4 py-3">
                <p className="font-body text-sm text-foreground">
                  Check your email for a password setup link.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="font-body text-sm text-primary/80 hover:text-primary underline underline-offset-4 transition-colors disabled:opacity-50"
              >
                {resetLoading ? "Sending link…" : "First time? Set your password"}
              </button>
            )}
          </div>

          <p className="mt-6 text-center font-body text-xs text-muted-foreground">
            Need access? Contact your coordinator for an invitation.
          </p>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setEmail("victoria@gilbertsvillefarmhouse.com")}
              className="font-body text-xs tracking-wide text-primary/70 hover:text-primary underline underline-offset-4 transition-colors"
            >
              Admin? Sign in here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
