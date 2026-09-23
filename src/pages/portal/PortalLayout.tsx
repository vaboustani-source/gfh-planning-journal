import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PortalDataProvider, usePortalData } from "@/hooks/usePortalData";
import { tabKeyForPath, TabKey } from "@/lib/tabAccess";
import { RSVP_ENABLED } from "@/lib/featureFlags";
import { LogOut, Menu, X, User } from "lucide-react";
import { ALL_PORTAL_ITEMS, PORTAL_MOBILE_SLUGS, type PortalNavItem } from "@/lib/portalNav";
import PortalSidebarNav from "@/components/portal/PortalSidebarNav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { GlobalSearchTrigger } from "@/components/search/GlobalSearch";

function MobileNavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-2 py-1.5 transition-colors ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`
      }
    >
      <Icon size={20} strokeWidth={1.75} />
      <span className="font-body text-[10px] leading-tight">{label}</span>
    </NavLink>
  );
}

export default function PortalLayout() {
  return (
    <PortalDataProvider>
      <PortalLayoutInner />
    </PortalDataProvider>
  );
}

function PortalLayoutInner() {
  const { profile, signOut } = useAuth();
  const { accessTier, tabAccess, isPreviewMode, eventId } = usePortalData();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Tier 2 = messages only; others filter by tier array AND tab_access
  const visible = useCallback((item: PortalNavItem) => {
    if (accessTier === 2) return item.slug === "messages";
    if (!item.tiers.includes(accessTier)) return false;
    if (!isPreviewMode && !RSVP_ENABLED && item.slug === "rsvp") return false;
    return isPreviewMode || !!tabAccess[item.tab];
  }, [accessTier, tabAccess, isPreviewMode]);

  const mobileItems = useMemo(
    () => PORTAL_MOBILE_SLUGS
      .map(slug => ALL_PORTAL_ITEMS.find(i => i.slug === slug))
      .filter((i): i is PortalNavItem => !!i && visible(i)),
    [visible],
  );

  // Guard: redirect away from blocked tabs and feature-flagged routes
  useEffect(() => {
    if (isPreviewMode) return;
    if (location.pathname === "/portal" || location.pathname === "/portal/today") return;
    if (!RSVP_ENABLED && location.pathname === "/portal/rsvp") {
      navigate("/portal/today", { replace: true });
      return;
    }
    const tab = tabKeyForPath(location.pathname);
    if (tab && !tabAccess[tab]) {
      toast.error("You don't have access to this section");
      navigate("/portal/today", { replace: true });
    }
  }, [location.pathname, tabAccess, isPreviewMode, navigate]);

  return (
      <div className="min-h-screen bg-background flex">

        {/* ── Desktop sidebar ─────────────────────── */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-sidebar sticky top-0 h-screen">
          {/* Brand */}
          <NavLink to="/portal/today" className="block px-5 py-6 border-b border-border hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-sage">
                  <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </div>
              <div>
                <p className="font-display text-base font-light leading-tight text-foreground">Gilbertsville Farmhouse</p>
                <p className="font-body text-[10px] text-muted-foreground -mt-0.5 pt-[2px]">Planning Journal</p>
              </div>
            </div>
          </NavLink>

          {/* Nav */}
          <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col gap-1">
            <PortalSidebarNav basePath="/portal" visible={visible} />
          </nav>

          {/* Profile + Sign out */}
          <div className="shrink-0 px-5 py-4 border-t border-border">
            <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-0.5">Signed in as</p>
            <p className="font-body text-sm font-medium text-foreground truncate mb-3">
              {profile?.first_name && profile?.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : profile?.email}
            </p>
            <button
              onClick={() => signOut().then(() => navigate("/login"))}
              className="flex items-center gap-3 px-0 py-1 w-full font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={16} strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Mobile drawer overlay ─────────────── */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-forest/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative w-72 bg-sidebar border-r border-border flex flex-col h-full shadow-elevated">
              <div className="px-5 py-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-sage">
                      <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <p className="font-display text-base font-light text-foreground">Gilbertsville Farmhouse</p>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col gap-1">
                <PortalSidebarNav basePath="/portal" visible={visible} onNavigate={() => setMobileMenuOpen(false)} />
              </nav>
              <div className="px-3 py-4 border-t border-border">
                <button
                  onClick={() => signOut().then(() => navigate("/login"))}
                  className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg font-body text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <LogOut size={16} strokeWidth={1.75} />
                  Sign out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* ── Main content area ─────────────────── */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {/* Mobile top bar */}
          <header className="lg:hidden sticky top-0 z-30 bg-card/90 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 h-14">
            <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 -ml-1.5 text-foreground">
              <Menu size={20} strokeWidth={1.75} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-sage">
                  <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </div>
              <span className="font-display text-base font-light text-foreground">Gilbertsville Farmhouse</span>
            </div>
            <GlobalSearchTrigger scope="couple" eventId={eventId} variant="icon" />
          </header>

          {/* Desktop search bar */}
          <div className="hidden lg:flex sticky top-0 z-20 bg-background/85 backdrop-blur-sm border-b border-border px-8 py-2.5">
            <GlobalSearchTrigger scope="couple" eventId={eventId} variant="bar" />
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto pb-24 lg:pb-20">
            <Outlet />
          </main>


          {/* ── Mobile bottom nav ──────────────── */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border flex justify-around overflow-x-auto pb-16">
            {mobileItems.map(item => (
              <MobileNavItem key={item.slug} to={`/portal/${item.slug}`} label={item.label} icon={item.icon} />
            ))}
            <button onClick={() => setMobileMenuOpen(true)} className="flex flex-col items-center gap-1 px-2 py-1.5 text-muted-foreground">
              <Menu size={20} strokeWidth={1.75} />
              <span className="font-body text-[10px] leading-tight">More</span>
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center gap-1 px-2 py-1.5 text-muted-foreground">
                  <User size={20} strokeWidth={1.75} />
                  <span className="font-body text-[10px] leading-tight">Account</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl pb-10">
                <div className="pt-2 pb-4 flex flex-col items-center gap-4">
                  <div className="text-center">
                    <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-0.5">Signed in as</p>
                    <p className="font-body text-base font-medium text-foreground">
                      {profile?.first_name && profile?.last_name
                        ? `${profile.first_name} ${profile.last_name}`
                        : profile?.email}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut().then(() => navigate("/login"))}
                    className="flex items-center gap-2 rounded-xl bg-muted px-6 py-2.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut size={16} strokeWidth={1.75} />
                    Sign out
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </nav>
        </div>

      </div>
  );
}
