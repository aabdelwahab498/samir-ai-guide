import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Play } from "lucide-react";
import { toast } from "sonner";
import { streamChat, type ChatMode } from "@/services/aiService";

const MODES = ["tutor", "detective", "strict", "cloud"] as const;
const MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
];

type Setting = { mode: string; system_prompt: string; model: string };

export default function Admin() {
  const { isAdmin, loading } = useIsAdmin();
  const { t } = useTranslation();
  const [items, setItems] = useState<Record<string, Setting>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testQ, setTestQ] = useState<Record<string, string>>({});
  const [testA, setTestA] = useState<Record<string, string>>({});

  async function load() {
    const { data, error } = await supabase.from("prompt_settings").select("mode, system_prompt, model");
    if (error) { toast.error(error.message); return; }
    const map: Record<string, Setting> = {};
    (data ?? []).forEach((r: any) => { map[r.mode] = r; });
    setItems(map);
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <div className="p-10 text-muted-foreground">{t("common.loading")}</div>;
  if (!isAdmin) return <Navigate to="/app" replace />;

  async function save(mode: string) {
    const it = items[mode]; if (!it) return;
    setBusy(mode);
    const { error } = await supabase.from("prompt_settings")
      .update({ system_prompt: it.system_prompt, model: it.model })
      .eq("mode", mode);
    setBusy(null);
    if (error) toast.error(error.message); else toast.success(t("admin.saved"));
  }

  async function runTest(mode: string) {
    const q = (testQ[mode] ?? "").trim();
    if (!q) { toast.error(t("admin.testEmpty")); return; }
    // Save first so the edge function uses the latest prompt/model
    await save(mode);
    setTesting(mode);
    setTestA(p => ({ ...p, [mode]: "" }));
    let acc = "";
    try {
      await streamChat(
        { mode: mode as ChatMode, messages: [{ role: "user", content: q }] },
        (delta) => { acc += delta; setTestA(p => ({ ...p, [mode]: acc })); }
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed");
    } finally { setTesting(null); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.subtitle")}</p>
      </div>
      <Tabs defaultValue="tutor">
        <TabsList>
          {MODES.map(m => <TabsTrigger key={m} value={m}>{m}</TabsTrigger>)}
        </TabsList>
        {MODES.map(m => {
          const it = items[m];
          return (
            <TabsContent key={m} value={m}>
              <Card className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("admin.model")}</label>
                  <Select
                    value={it?.model ?? ""}
                    onValueChange={v => setItems(p => ({ ...p, [m]: { ...(p[m] ?? { mode: m, system_prompt: "" }), model: v } }))}
                  >
                    <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
                    <SelectContent>
                      {MODELS.map(mo => <SelectItem key={mo} value={mo}>{mo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("admin.systemPrompt")}</label>
                  <Textarea
                    rows={14}
                    value={it?.system_prompt ?? ""}
                    onChange={e => setItems(p => ({ ...p, [m]: { ...(p[m] ?? { mode: m, model: MODELS[0] }), system_prompt: e.target.value } }))}
                  />
                </div>
                <Button onClick={() => save(m)} disabled={busy === m} className="gradient-primary shadow-glow">
                  {busy === m ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {t("common.save")}
                </Button>
                <div className="border-t pt-4 space-y-2">
                  <label className="text-sm font-medium">{t("admin.testPrompt")}</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("admin.testPlaceholder")}
                      value={testQ[m] ?? ""}
                      onChange={e => setTestQ(p => ({ ...p, [m]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") runTest(m); }}
                    />
                    <Button onClick={() => runTest(m)} disabled={testing === m} variant="secondary">
                      {testing === m ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                      {t("admin.runTest")}
                    </Button>
                  </div>
                  {(testA[m] || testing === m) && (
                    <Card className="p-3 bg-secondary/30 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {testA[m] || "…"}
                    </Card>
                  )}
                </div>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}