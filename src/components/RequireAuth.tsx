import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, isGuest, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user && !isGuest) return <Navigate to="/auth" replace />;
  return children;
}