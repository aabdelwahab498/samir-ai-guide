import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { Home, GraduationCap, Search, ListChecks, BarChart3, MessagesSquare, Calendar, Users, Globe, Info, LogOut, Sparkles, LogIn, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import SettingsMenu from "@/components/SettingsMenu";

const NAV = [
  { to: "/app", labelKey: "nav.home", icon: Home, end: true },
  { to: "/app/tutor", labelKey: "nav.tutor", icon: GraduationCap },
  { to: "/app/detective", labelKey: "nav.detective", icon: Search },
  { to: "/app/quiz", labelKey: "nav.quiz", icon: ListChecks },
  { to: "/app/tracker", labelKey: "nav.tracker", icon: BarChart3 },
  { to: "/app/chats", labelKey: "nav.chats", icon: MessagesSquare },
  { to: "/app/schedule", labelKey: "nav.schedule", icon: Calendar },
  { to: "/app/groups", labelKey: "nav.groups", icon: Users },
  { to: "/app/community", labelKey: "nav.community", icon: Globe },
  { to: "/app/about", labelKey: "nav.about", icon: Info },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
      {NAV.map((n) => (
        <NavLink
          key={n.to} to={n.to} end={n.end} onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? "gradient-primary text-primary-foreground shadow-glow" : "hover:bg-secondary text-foreground/80"
            }`
          }
        >
          <n.icon className="h-4 w-4" /> {t(n.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  const { t } = useTranslation();
  return (
    <div className="p-5 flex items-center gap-2">
      <div className="h-9 w-9 rounded-xl gradient-primary grid place-items-center shadow-glow">
        <Sparkles className="h-5 w-5 text-primary-foreground" />
      </div>
      <div>
        <div className="font-bold leading-tight">{t("app.name")}</div>
        <div className="text-xs text-muted-foreground">{t("app.tagline")}</div>
      </div>
    </div>
  );
}

function FooterAuth({ onAction }: { onAction?: () => void }) {
  const { user, isGuest, signOut, disableGuest } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="p-3 border-t">
      <div className="text-xs text-muted-foreground mb-2 truncate">
        {user ? user.email : isGuest ? t("auth.guest") : t("auth.notSignedIn")}
      </div>
      {isGuest && !user ? (
        <>
          <Button size="sm" className="w-full justify-start gradient-primary shadow-glow mb-1" asChild>
            <Link to="/auth" onClick={onAction}><LogIn className="h-4 w-4 mr-2" /> {t("auth.signIn")} / {t("auth.signUp")}</Link>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { disableGuest(); onAction?.(); navigate("/"); }}>
            <LogOut className="h-4 w-4 mr-2" /> {t("auth.exitGuest")}
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { onAction?.(); signOut(); }}>
          <LogOut className="h-4 w-4 mr-2" /> {t("auth.signOut")}
        </Button>
      )}
    </div>
  );
}

export default function AppShell() {
  const { user, isGuest, disableGuest } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex bg-background">
      {isGuest && !user && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-2 text-sm flex items-center justify-center gap-3 shadow-glow flex-wrap">
          <span>👋 {t("auth.guestBanner")}</span>
          <Button size="sm" variant="secondary" onClick={() => { disableGuest(); navigate("/auth"); }}>
            <LogIn className="h-3 w-3 mr-1" /> {t("auth.signIn")}
          </Button>
          <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => { disableGuest(); navigate("/"); }}>
            {t("auth.exitGuest")}
          </Button>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <Brand />
        <NavList />
        <div className="px-3 pb-2"><SettingsMenu /></div>
        <FooterAuth />
      </aside>

      {/* Mobile top bar */}
      <div className={`md:hidden fixed left-0 right-0 z-40 bg-card border-b flex items-center justify-between px-3 h-14 ${isGuest && !user ? "top-10" : "top-0"}`}>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 flex flex-col">
            <Brand />
            <NavList onNavigate={() => setOpen(false)} />
            <div className="px-3 pb-2"><SettingsMenu /></div>
            <FooterAuth onAction={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg gradient-primary grid place-items-center"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
          <span className="font-bold">{t("app.name")}</span>
        </div>
        <SettingsMenu />
      </div>

      <main className={`flex-1 min-w-0 overflow-y-auto ${isGuest && !user ? "pt-10" : ""} md:pt-0 pt-14`}>
        <Outlet />
      </main>
    </div>
  );
}
