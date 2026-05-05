import { NavLink, Outlet } from "react-router-dom";
import { Home, GraduationCap, Search, ListChecks, BarChart3, MessagesSquare, Calendar, Users, Globe, Info, LogOut, Sparkles, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";

const NAV = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/tutor", label: "Tutor", icon: GraduationCap },
  { to: "/app/detective", label: "Detective", icon: Search },
  { to: "/app/quiz", label: "Quiz", icon: ListChecks },
  { to: "/app/tracker", label: "Tracker", icon: BarChart3 },
  { to: "/app/chats", label: "Multi Chats", icon: MessagesSquare },
  { to: "/app/schedule", label: "Schedule", icon: Calendar },
  { to: "/app/groups", label: "Groups", icon: Users },
  { to: "/app/community", label: "Community", icon: Globe },
  { to: "/app/about", label: "About", icon: Info },
];

export default function AppShell() {
  const { user, isGuest, signOut, disableGuest } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex bg-background">
      {isGuest && !user && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-2 text-sm flex items-center justify-center gap-3 shadow-glow">
          <span>👋 You're in Guest mode — sign up to upload PDFs and save your work.</span>
          <Button size="sm" variant="secondary" onClick={() => { disableGuest(); navigate("/auth"); }}>
            <LogIn className="h-3 w-3 mr-1" /> Sign up / Sign in
          </Button>
          <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => { disableGuest(); navigate("/"); }}>
            Exit guest
          </Button>
        </div>
      )}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-5 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold leading-tight">SAMIR</div>
            <div className="text-xs text-muted-foreground">AI Tutor</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? "gradient-primary text-primary-foreground shadow-glow" : "hover:bg-secondary text-foreground/80"
                }`}>
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t">
          <div className="text-xs text-muted-foreground mb-2 truncate">
            {user ? user.email : isGuest ? "Guest mode" : "Not signed in"}
          </div>
          {isGuest && !user ? (
            <>
              <Button size="sm" className="w-full justify-start gradient-primary shadow-glow mb-1" asChild>
                <Link to="/auth"><LogIn className="h-4 w-4 mr-2" /> Sign up / Sign in</Link>
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { disableGuest(); navigate("/"); }}>
                <LogOut className="h-4 w-4 mr-2" /> Exit guest mode
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          )}
        </div>
      </aside>
      <main className={`flex-1 min-w-0 overflow-y-auto ${isGuest && !user ? "pt-12" : ""}`}>
        <Outlet />
      </main>
    </div>
  );
}