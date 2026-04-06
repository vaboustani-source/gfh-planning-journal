import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import farmhouseHero from "@/assets/farmhouse-hero.jpg";

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
        redirectTo: `${window.location.origin}/set-password`,
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
      {/* Left: illustration */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src={farmhouseHero}
          alt="Gilbertsville Farmhouse"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest/30 to-transparent px-0" />
        <div className="absolute bottom-12 left-12 text-primary-foreground">
          <p className="font-body text-xs tracking-widest uppercase opacity-70 mb-2">
            EST. SOUTH NEW BERLIN, NY
          </p>
          <p className="font-display text-2xl italic text-primary-foreground/90">
            Where every detail is<br />tended with care.
          </p>
        </div>
      </div>

      {/* Right: login form */}
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
