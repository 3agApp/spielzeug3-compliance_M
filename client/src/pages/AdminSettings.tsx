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
  Building2,
  Database,
  Globe,
  RefreshCw,
  Save,
  Settings,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminSettings() {
  const { t, lang, setLang } = useLang();

  // Kontor API settings (local state – in production these would be persisted via tRPC)
  const [kontorApiUrl, setKontorApiUrl] = useState("https://api.kontor.example.com/v1");
  const [kontorApiKey, setKontorApiKey] = useState("••••••••••••••••");
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState("60");

  // Notification settings
  const [notifyOnSubmit, setNotifyOnSubmit] = useState(true);
  const [notifyOnApprove, setNotifyOnApprove] = useState(true);
  const [notifyOnReject, setNotifyOnReject] = useState(true);
  const [notifyOnClarification, setNotifyOnClarification] = useState(true);

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
        <TabsList className="grid w-full grid-cols-4">
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
