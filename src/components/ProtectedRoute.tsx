import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { canView, defaultLandingFor, type Section } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Legacy: simple role match. Prefer `section`. */
  requiredRole?: string;
  /** Unified permission check against the central matrix. */
  section?: Section;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  section,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();

  const sectionDenied =
    !loading && !!section && !!profile && !canView(profile.role, section);

  useEffect(() => {
    if (sectionDenied) toast.error("You don't have access to this section");
  }, [sectionDenied]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="font-body text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to={redirectTo} replace />;

  if (sectionDenied) {
    return <Navigate to={defaultLandingFor(profile?.role)} replace />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    // Treat admin + GFH-internal roles as equivalent for legacy admin-gated routes.
    const internal = ["admin", "event_director", "ceo_owner", "sales_manager", "marketing", "planner"];
    if (requiredRole === "admin" && profile?.role && internal.includes(profile.role)) {
      return <>{children}</>;
    }
    return <Navigate to={defaultLandingFor(profile?.role)} replace />;
  }

  return <>{children}</>;
}
