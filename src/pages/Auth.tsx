import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function AuthPage() {
  const nav = useNavigate();
  const { enableGuest } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Welcome back"); nav("/app"); }
  }

  async function signUp() {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/app`, data: { display_name: name } },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Check your email to confirm — or sign in if confirmation is disabled."); }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/app` });
    if (r.error) toast.error("Google sign-in failed");
    else if (!r.redirected) nav("/app");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <Card className="w-full max-w-md p-6 shadow-card">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl gradient-primary grid place-items-center shadow-glow"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
          <span className="font-bold">SAMIR AI Tutor</span>
        </Link>
        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <Button className="w-full gradient-primary shadow-glow" onClick={signIn} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <Button className="w-full gradient-primary shadow-glow" onClick={signUp} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </Button>
          </TabsContent>
        </Tabs>
        <div className="my-4 text-center text-xs text-muted-foreground">or</div>
        <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
        <Button variant="ghost" className="w-full mt-2" onClick={() => { enableGuest(); nav("/app"); }}>Continue as guest</Button>
      </Card>
    </div>
  );
}