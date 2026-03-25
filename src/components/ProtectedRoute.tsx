import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  redirectTo?: string;
}

export function ProtectedRoute({ children, requiredRole, redirectTo = "/login" }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();

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

  if (requiredRole && profile?.role !== requiredRole) {
    if (profile?.role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}
