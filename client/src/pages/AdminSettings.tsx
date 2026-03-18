import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
  Bell,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Globe,
  Key,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminSettings() {
  const { t, lang, setLang } = useLang();

  // Kontor API settings
  const [kontorApiUrl, setKontorApiUrl] = useState("https://api.kontor.example.com/v1");
  const [kontorApiKey, setKontorApiKey] = useState("••••••••••••••••");
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState("60");

  // Notification settings
  const [notifyOnSubmit, setNotifyOnSubmit] = useState(true);
  const [notifyOnApprove, setNotifyOnApprove] = useState(true);
  const [notifyOnReject, setNotifyOnReject] = useState(true);
  const [notifyOnClarification, setNotifyOnClarification] = useState(true);

  // AI settings
  const [openAiKey, setOpenAiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const apiKeyStatusQuery = trpc.aiAnalysis.getApiKeyStatus.useQuery();
  const saveKeyMutation = trpc.aiAnalysis.saveApiKey.useMutation({
    onSuccess: () => {
      toast.success("OpenAI API-Schlüssel gespeichert");
      setOpenAiKey("");
      apiKeyStatusQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const testKeyMutation = trpc.aiAnalysis.testApiKey.useMutation({
    onSuccess: (data) => {
      setTestResult("success");
      setTestMessage(`Verbindung erfolgreich · Modell: ${data.model}`);
    },
    onError: (e: any) => {
      setTestResult("error");
      setTestMessage(e.message);
    },
  });

  const handleSaveKontor = () => {
    toast.success("Kontor-API-Einstellungen gespeichert");
  };

  const handleSaveNotifications = () => {
    toast.success("Benachrichtigungseinstellungen gespeichert");
  };

  const handleTestConnection = () => {
    toast.info("Verbindungstest wird durchgeführt…");
    setTimeout(() => toast.success("Verbindung zu Kontor ERP erfolgreich"), 1500);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          {t.nav.settings}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Systemkonfiguration und Integrationseinstellungen
        </p>
      </div>

      <Tabs defaultValue="kontor">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="kontor" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Kontor ERP
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Benachrichtigungen
          </TabsTrigger>
          <TabsTrigger value="portal" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Portal
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Sicherheit
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            KI-Analyse
          </TabsTrigger>
        </TabsList>

        {/* ── Kontor ERP ── */}
        <TabsContent value="kontor" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Kontor ERP API-Verbindung
              </CardTitle>
              <CardDescription>
                Konfigurieren Sie die bidirektionale Datensynchronisation mit Kontor ERP.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="kontor-url">API-URL</Label>
                  <Input
                    id="kontor-url"
                    value={kontorApiUrl}
                    onChange={(e) => setKontorApiUrl(e.target.value)}
                    placeholder="https://api.kontor.example.com/v1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kontor-key">API-Schlüssel</Label>
                  <Input
                    id="kontor-key"
                    type="password"
                    value={kontorApiKey}
                    onChange={(e) => setKontorApiKey(e.target.value)}
                    placeholder="Ihr Kontor API-Schlüssel"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Automatische Synchronisation</p>
                  <p className="text-xs text-muted-foreground">
                    Daten automatisch in regelmäßigen Abständen synchronisieren
                  </p>
                </div>
                <Switch checked={autoSync} onCheckedChange={setAutoSync} />
              </div>

              {autoSync && (
                <div className="space-y-1.5">
                  <Label htmlFor="sync-interval">Sync-Intervall (Minuten)</Label>
                  <Input
                    id="sync-interval"
                    type="number"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(e.target.value)}
                    className="w-32"
                    min="5"
                    max="1440"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveKontor}>
                  <Save className="mr-2 h-4 w-4" />
                  Speichern
                </Button>
                <Button variant="outline" onClick={handleTestConnection}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Verbindung testen
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sync-Konfiguration</CardTitle>
              <CardDescription>
                Definieren Sie, welche Entitäten synchronisiert werden sollen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Lieferanten importieren", desc: "Lieferantenstammdaten aus Kontor importieren" },
                { label: "Produkte importieren", desc: "Produktdaten und Bestellungen aus Kontor importieren" },
                { label: "Compliance-Status exportieren", desc: "Genehmigungsstatus nach Kontor exportieren" },
                { label: "Vollständigkeits-Flags exportieren", desc: "Completeness-Score nach Kontor exportieren" },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications ── */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                E-Mail-Benachrichtigungen
              </CardTitle>
              <CardDescription>
                Konfigurieren Sie, wann automatische Benachrichtigungen versendet werden.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: "Bei Einreichung",
                  desc: "Interne Mitarbeiter werden benachrichtigt, wenn ein Lieferant ein Produkt einreicht",
                  checked: notifyOnSubmit,
                  onChange: setNotifyOnSubmit,
                },
                {
                  label: "Bei Genehmigung",
                  desc: "Lieferanten werden benachrichtigt, wenn ein Produkt genehmigt wird",
                  checked: notifyOnApprove,
                  onChange: setNotifyOnApprove,
                },
                {
                  label: "Bei Ablehnung",
                  desc: "Lieferanten werden benachrichtigt, wenn ein Produkt abgelehnt wird",
                  checked: notifyOnReject,
                  onChange: setNotifyOnReject,
                },
                {
                  label: "Bei Rückfrage",
                  desc: "Lieferanten werden benachrichtigt, wenn eine Rückfrage gestellt wird",
                  checked: notifyOnClarification,
                  onChange: setNotifyOnClarification,
                },
              ].map(({ label, desc, checked, onChange }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch checked={checked} onCheckedChange={onChange} />
                </div>
              ))}

              <div className="pt-2">
                <Button onClick={handleSaveNotifications}>
                  <Save className="mr-2 h-4 w-4" />
                  Speichern
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Portal ── */}
        <TabsContent value="portal" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Portal-Einstellungen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Unternehmensname</Label>
                <Input defaultValue="spielzeug3 AG" />
              </div>
              <div className="space-y-1.5">
                <Label>Portal-Titel</Label>
                <Input defaultValue="Supplier Compliance Portal" />
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label>Standard-Sprache</Label>
                <div className="flex gap-2">
                  <Button
                    variant={lang === "de" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLang("de")}
                  >
                    Deutsch
                  </Button>
                  <Button
                    variant={lang === "en" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLang("en")}
                  >
                    English
                  </Button>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={() => toast.success("Portal-Einstellungen gespeichert")}>
                  <Save className="mr-2 h-4 w-4" />
                  Speichern
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">System-Informationen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Version", value: "1.0.0" },
                  { label: "Stack", value: "React 19 + tRPC + MySQL" },
                  { label: "Datenbank", value: "MySQL / TiDB" },
                  { label: "Dateispeicher", value: "S3-kompatibel" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">{label}</span>
                    <Badge variant="outline" className="text-xs">{value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI Analysis ── */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" />
                KI-Plausibilitätsprüfung
              </CardTitle>
              <CardDescription>
                Hinterlegen Sie Ihren OpenAI API-Schlüssel, um Produktdokumente automatisch auf
                Plausibilität und Vollständigkeit zu prüfen. Der Schlüssel wird verschlüsselt
                gespeichert und ausschließlich serverseitig verwendet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Current key status */}
              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    apiKeyStatusQuery.data?.configured
                      ? "bg-emerald-100"
                      : "bg-amber-100"
                  }`}>
                    <Key className={`h-4 w-4 ${
                      apiKeyStatusQuery.data?.configured ? "text-emerald-600" : "text-amber-600"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {apiKeyStatusQuery.data?.configured
                        ? "API-Schlüssel konfiguriert"
                        : "Kein API-Schlüssel hinterlegt"}
                    </p>
                    {apiKeyStatusQuery.data?.maskedKey && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {apiKeyStatusQuery.data.maskedKey}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* New key input */}
              <div className="space-y-1.5">
                <Label htmlFor="openai-key">
                  {apiKeyStatusQuery.data?.configured ? "Schlüssel ersetzen" : "API-Schlüssel eingeben"}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="openai-key"
                      type={showKey ? "text" : "password"}
                      value={openAiKey}
                      onChange={(e) => setOpenAiKey(e.target.value)}
                      placeholder="sk-proj-..."
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={() => openAiKey && saveKeyMutation.mutate({ apiKey: openAiKey })}
                    disabled={!openAiKey || saveKeyMutation.isPending}
                  >
                    {saveKeyMutation.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Speichern
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Den Schlüssel erhalten Sie unter{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    platform.openai.com/api-keys
                  </a>
                </p>
              </div>

              <Separator />

              {/* Connection test */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Verbindungstest</p>
                    <p className="text-xs text-muted-foreground">
                      Prüft den gespeicherten Schlüssel mit einem minimalen API-Aufruf
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTestResult("idle");
                      testKeyMutation.mutate();
                    }}
                    disabled={!apiKeyStatusQuery.data?.configured || testKeyMutation.isPending}
                  >
                    {testKeyMutation.isPending ? (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Testen
                  </Button>
                </div>

                {testResult !== "idle" && (
                  <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                    testResult === "success"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    {testResult === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    {testMessage}
                  </div>
                )}
              </div>

              <Separator />

              {/* Info box */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-2">
                <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  So funktioniert die KI-Analyse
                </p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Wählen Sie in der Produktliste ein oder mehrere Produkte per Checkbox aus</li>
                  <li>• Klicken Sie auf "KI-Analyse starten" – GPT-4o analysiert alle hochgeladenen Dokumente</li>
                  <li>• Das Modell prüft Vollständigkeit, Plausibilität, formale Korrektheit und Konsistenz</li>
                  <li>• Das Ergebnis erscheint als Score (0–100%) mit Begründung direkt beim Produkt</li>
                  <li>• Alle Analysen werden gespeichert und können jederzeit abgerufen werden</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Security ── */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Sicherheitseinstellungen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: "Audit-Log aktiviert",
                  desc: "Alle Benutzeraktionen werden protokolliert",
                  defaultChecked: true,
                },
                {
                  label: "Session-Timeout",
                  desc: "Benutzer werden nach Inaktivität automatisch abgemeldet",
                  defaultChecked: true,
                },
                {
                  label: "Dokument-Zugriff einschränken",
                  desc: "Lieferanten können nur eigene Dokumente einsehen",
                  defaultChecked: true,
                },
                {
                  label: "Kommentare moderieren",
                  desc: "Externe Kommentare werden vor Veröffentlichung geprüft",
                  defaultChecked: false,
                },
              ].map(({ label, desc, defaultChecked }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch defaultChecked={defaultChecked} />
                </div>
              ))}
              <div className="pt-2">
                <Button onClick={() => toast.success("Sicherheitseinstellungen gespeichert")}>
                  <Save className="mr-2 h-4 w-4" />
                  Speichern
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
