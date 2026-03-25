import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function CouplePortal() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-sage">
                <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <span className="font-display text-lg font-light text-foreground tracking-wide">Gilbertsville Farmhouse</span>
          </div>
          <button
            onClick={() => signOut().then(() => navigate("/login"))}
            className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 text-center">
        <div className="animate-fade-up">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-3">
            Your Planning Portal
          </p>
          <h1 className="font-display text-5xl font-light text-foreground mb-4">
            Welcome{profile?.first_name ? `, ${profile.first_name}` : ""}
          </h1>
          <p className="font-body text-base text-muted-foreground max-w-md mx-auto">
            Your wedding planning portal is being set up. Check back soon for your personalized experience.
          </p>
        </div>
      </main>
    </div>
  );
}
