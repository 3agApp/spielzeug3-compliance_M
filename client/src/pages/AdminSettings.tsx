import { SealPreview } from "@/components/SealPreview";
import { SealAssetUpload } from "@/components/SealAssetUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { trpc } from "@/lib/trpc";
import {
  Bell,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  FileSignature,
  Globe,
  ImagePlus,
  Download,
  ExternalLink,
  Info,
  Key,
  Mail,
  RefreshCw,
  Save,
  Send,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
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
  // Seal auto-activate setting
  const [sealAutoActivate, setSealAutoActivate] = useState(true);
  const [sealAutoActivateLoaded, setSealAutoActivateLoaded] = useState(false);
  const sealSettingQuery = trpc.admin.getSystemSetting.useQuery({ key: "SEAL_AUTO_ACTIVATE" });

  // Auto-revoke expired public docs setting
  const [autoRevokeExpired, setAutoRevokeExpired] = useState(true);
  const [autoRevokeLoaded, setAutoRevokeLoaded] = useState(false);
  const autoRevokeQuery = trpc.admin.getSystemSetting.useQuery({ key: "AUTO_REVOKE_EXPIRED_PUBLIC_DOCS" });
  const autoRevokeValue = autoRevokeQuery.data?.settingValue;
  if (!autoRevokeLoaded && autoRevokeValue !== null && autoRevokeValue !== undefined) {
    setAutoRevokeExpired(autoRevokeValue !== "false" && autoRevokeValue !== "0");
    setAutoRevokeLoaded(true);
  }
  // Auto risk re-assessment on document upload setting
  const [riskAutoReassess, setRiskAutoReassess] = useState(true);
  const [riskAutoReassessLoaded, setRiskAutoReassessLoaded] = useState(false);
  const riskAutoReassessQuery = trpc.admin.getSystemSetting.useQuery({ key: "RISK_AUTO_REASSESS" });
  const riskAutoReassessValue = riskAutoReassessQuery.data?.settingValue;
  if (!riskAutoReassessLoaded && riskAutoReassessValue !== null && riskAutoReassessValue !== undefined) {
    setRiskAutoReassess(riskAutoReassessValue !== "false" && riskAutoReassessValue !== "0");
    setRiskAutoReassessLoaded(true);
  }

  const revokeNowMutation = trpc.documents.revokeExpiredPublic.useMutation({
    onSuccess: (data) => {
      if (data.skipped) {
        toast.info(lang === "de" ? "Auto-Revoke ist deaktiviert – keine Aktion ausgeführt." : "Auto-Revoke is disabled – no action performed.");
      } else {
        toast.success(
          data.revokedCount > 0
            ? (lang === "de" ? `${data.revokedCount} abgelaufene${data.revokedCount === 1 ? "s" : ""} Dokument${data.revokedCount === 1 ? "" : "e"} aus der öffentlichen Freigabe entfernt.` : `${data.revokedCount} expired document${data.revokedCount === 1 ? "" : "s"} removed from public access.`)
            : (lang === "de" ? "Keine abgelaufenen Dokumente gefunden." : "No expired documents found.")
        );
      }
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });
  const tenantQuery = trpc.tenant.getCurrent.useQuery();
  const tenantName = (tenantQuery.data as any)?.name ?? "Spielzeug 3 AG";
  const tenantSlug = (tenantQuery.data as any)?.slug ?? "swiss-product-seal.ch";
  const tenantWebsiteUrl = (tenantQuery.data as any)?.websiteUrl ?? "swiss-product-seal.ch";
  const tenantId = (tenantQuery.data as any)?.id ?? 1;

  // Portal settings state (editable)
  const [portalName, setPortalName] = useState("");
  const [portalWebsiteUrl, setPortalWebsiteUrl] = useState("");
  const [portalContactEmail, setPortalContactEmail] = useState("");
  const [portalPrimaryColor, setPortalPrimaryColor] = useState("#C8102E");
  const [portalColorHex, setPortalColorHex] = useState("#C8102E");
  const [portalLoaded, setPortalLoaded] = useState(false);
  if (!portalLoaded && tenantQuery.data) {
    setPortalName((tenantQuery.data as any).name ?? "");
    setPortalWebsiteUrl((tenantQuery.data as any).websiteUrl ?? "swiss-product-seal.ch");
    setPortalContactEmail((tenantQuery.data as any).contactEmail ?? "");
    const savedColor = (tenantQuery.data as any).primaryColor ?? "#C8102E";
    setPortalPrimaryColor(savedColor);
    setPortalColorHex(savedColor);
    setPortalLoaded(true);
  }
  const utils = trpc.useUtils();
  const updateMyTenantMutation = trpc.tenant.updateMyTenant.useMutation({
    onSuccess: () => {
      toast.success("Portal-Einstellungen gespeichert");
      utils.tenant.getCurrent.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  // Logo upload state
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const currentLogoUrl = (tenantQuery.data as any)?.logoUrl ?? null;

  const uploadLogoMutation = trpc.tenant.uploadLogo.useMutation({
    onSuccess: (data) => {
      toast.success("Logo hochgeladen", { description: "Das Logo erscheint jetzt auf dem Siegel-Etikett." });
      setLogoPreview(null);
      utils.tenant.getCurrent.invalidate();
    },
    onError: (e: any) => {
      toast.error("Upload fehlgeschlagen", { description: translateError(e.message, t) });
      setLogoUploading(false);
    },
  });

  const removeLogoMutation = trpc.tenant.updateMyTenant.useMutation({
    onSuccess: () => {
      toast.success("Logo entfernt");
      setLogoPreview(null);
      utils.tenant.getCurrent.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(lang === "de" ? "Ungültiges Format" : "Invalid format", { description: lang === "de" ? "Erlaubt: PNG, JPG, WebP, SVG" : "Allowed: PNG, JPG, WebP, SVG" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(lang === "de" ? "Datei zu groß" : "File too large", { description: lang === "de" ? "Maximale Dateigröße: 5 MB" : "Maximum file size: 5 MB" });
      return;
    }
    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Upload
    setLogoUploading(true);
    const base64Reader = new FileReader();
    base64Reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      try {
        await uploadLogoMutation.mutateAsync({
          fileBase64: base64,
          mimeType: file.type as any,
          fileName: file.name,
        });
      } finally {
        setLogoUploading(false);
        if (logoInputRef.current) logoInputRef.current.value = "";
      }
    };
    base64Reader.readAsDataURL(file);
  }
  const saveSealSettingMutation = trpc.admin.setSystemSetting.useMutation({
    onSuccess: () => toast.success("Siegel-Einstellungen gespeichert"),
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });
  // Sync state when query resolves (only once on first load)
  const sealSettingValue = sealSettingQuery.data?.settingValue;
  if (!sealAutoActivateLoaded && sealSettingValue !== null && sealSettingValue !== undefined) {
    setSealAutoActivate(sealSettingValue !== "false" && sealSettingValue !== "0");
    setSealAutoActivateLoaded(true);
  }

  const [aiKey, setAiKey] = useState("");
  const [aiProvider, setAiProvider] = useState<"openai" | "anthropic" | "gemini">("openai");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const apiKeyStatusQuery = trpc.aiAnalysis.getApiKeyStatus.useQuery();
  // Pre-select the saved provider when loaded
  const savedProvider = (apiKeyStatusQuery.data as any)?.provider;
  if (savedProvider && savedProvider !== aiProvider && aiKey === "") {
    setAiProvider(savedProvider);
  }
  const saveKeyMutation = trpc.aiAnalysis.saveApiKey.useMutation({
    onSuccess: () => {
      const providerNames: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Google Gemini" };
      toast.success(lang === "de" ? `${providerNames[aiProvider]} API-Schlüssel gespeichert` : `${providerNames[aiProvider]} API key saved`);
      setAiKey("");
      apiKeyStatusQuery.refetch();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });
  const testKeyMutation = trpc.aiAnalysis.testApiKey.useMutation({
    onSuccess: (data: any) => {
      setTestResult("success");
      setTestMessage(`Connection successful · Provider: ${data.provider} · Model: ${data.model}`);
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
    toast.info(lang === "de" ? "Verbindungstest wird durchgeführt…" : "Testing connection...");
    setTimeout(() => toast.success(lang === "de" ? "Verbindung zu Kontor ERP erfolgreich" : "Connection to Kontor ERP successful"), 1500);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          {t.nav.settings}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {lang === "de" ? "Systemkonfiguration und Integrationseinstellungen" : "System configuration and integration settings"}
        </p>
      </div>

      <Tabs defaultValue="kontor">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="kontor" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Kontor ERP
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            {lang === "de" ? "Benachrichtigungen" : "Notifications"}
          </TabsTrigger>
          <TabsTrigger value="portal" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Portal
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            {lang === "de" ? "Sicherheit" : "Security"}
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {lang === "de" ? "KI-Analyse" : "AI Analysis"}
          </TabsTrigger>
          <TabsTrigger value="bunnydoc" className="gap-1.5">
            <FileSignature className="h-3.5 w-3.5" />
            {lang === "de" ? "Signaturen" : "Signatures"}
          </TabsTrigger>
          <TabsTrigger value="seal" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            {lang === "de" ? "Siegel" : "Seal"}
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Email
          </TabsTrigger>
        </TabsList>

        {/* ── Kontor ERP ── */}
        <TabsContent value="kontor" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                {lang === "de" ? "Kontor ERP API-Verbindung" : "Kontor ERP API Connection"}
              </CardTitle>
              <CardDescription>
                {lang === "de" ? "Konfigurieren Sie die bidirektionale Datensynchronisation mit Kontor ERP." : "Configure the bidirectional data synchronisation with Kontor ERP."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="kontor-url">{lang === "de" ? "API-URL" : "API URL"}</Label>
                  <Input
                    id="kontor-url"
                    value={kontorApiUrl}
                    onChange={(e) => setKontorApiUrl(e.target.value)}
                    placeholder="https://api.kontor.example.com/v1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kontor-key">{lang === "de" ? "API-Schlüssel" : "API Key"}</Label>
                  <Input
                    id="kontor-key"
                    type="password"
                    value={kontorApiKey}
                    onChange={(e) => setKontorApiKey(e.target.value)}
                    placeholder={lang === "de" ? "Ihr Kontor API-Schlüssel" : "Your Kontor API key"}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{lang === "de" ? "Automatische Synchronisation" : "Automatic Synchronisation"}</p>
                  <p className="text-xs text-muted-foreground">
                    {lang === "de" ? "Daten automatisch in regelmäßigen Abständen synchronisieren" : "Automatically synchronise data at regular intervals"}
                  </p>
                </div>
                <Switch checked={autoSync} onCheckedChange={setAutoSync} />
              </div>

              {autoSync && (
                <div className="space-y-1.5">
                  <Label htmlFor="sync-interval">{lang === "de" ? "Sync-Intervall (Minuten)" : "Sync interval (minutes)"}</Label>
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
                  {t.action.save}
                </Button>
                <Button variant="outline" onClick={handleTestConnection}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {lang === "de" ? "Verbindung testen" : "Test connection"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{lang === "de" ? "Sync-Konfiguration" : "Sync Configuration"}</CardTitle>
              <CardDescription>
                {lang === "de" ? "Definieren Sie, welche Entitäten synchronisiert werden sollen." : "Define which entities should be synchronised."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: lang === "de" ? "Lieferanten importieren" : "Import suppliers", desc: lang === "de" ? "Lieferantenstammdaten aus Kontor importieren" : "Import supplier master data from Kontor" },
                { label: lang === "de" ? "Produkte importieren" : "Import products", desc: lang === "de" ? "Produktdaten und Bestellungen aus Kontor importieren" : "Import product data and orders from Kontor" },
                { label: lang === "de" ? "Compliance-Status exportieren" : "Export compliance status", desc: lang === "de" ? "Genehmigungsstatus nach Kontor exportieren" : "Export approval status to Kontor" },
                { label: lang === "de" ? "Vollständigkeits-Flags exportieren" : "Export completeness flags", desc: lang === "de" ? "Completeness-Score nach Kontor exportieren" : "Export completeness score to Kontor" },
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
                  label: lang === "de" ? "Bei Einreichung" : "On submission",
                  desc: lang === "de" ? "Interne Mitarbeiter werden benachrichtigt, wenn ein Lieferant ein Produkt einreicht" : "Internal staff are notified when a supplier submits a product",
                  checked: notifyOnSubmit,
                  onChange: setNotifyOnSubmit,
                },
                {
                  label: lang === "de" ? "Bei Genehmigung" : "On approval",
                  desc: lang === "de" ? "Lieferanten werden benachrichtigt, wenn ein Produkt genehmigt wird" : "Suppliers are notified when a product is approved",
                  checked: notifyOnApprove,
                  onChange: setNotifyOnApprove,
                },
                {
                  label: lang === "de" ? "Bei Ablehnung" : "On rejection",
                  desc: lang === "de" ? "Lieferanten werden benachrichtigt, wenn ein Produkt abgelehnt wird" : "Suppliers are notified when a product is rejected",
                  checked: notifyOnReject,
                  onChange: setNotifyOnReject,
                },
                {
                  label: lang === "de" ? "Bei Rückfrage" : "On clarification request",
                  desc: lang === "de" ? "Lieferanten werden benachrichtigt, wenn eine Rückfrage gestellt wird" : "Suppliers are notified when a clarification is requested",
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
                  {t.action.save}
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
              <p className="text-sm text-muted-foreground">
                Diese Angaben erscheinen auf dem Siegel-Etikett (HTML-Vorschau &amp; PDF-Ausdruck).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="portal-name">Unternehmensname</Label>
                <Input
                  id="portal-name"
                  value={portalName}
                  onChange={(e) => setPortalName(e.target.value)}
                  placeholder="z. B. Spielzeug 3 AG"
                />
                <p className="text-xs text-muted-foreground">
                  Erscheint als „Imported by“ auf dem Siegel-Etikett.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portal-website">Website-URL (Siegel-Etikett)</Label>
                <Input
                  id="portal-website"
                  value={portalWebsiteUrl}
                  onChange={(e) => setPortalWebsiteUrl(e.target.value)}
                  placeholder="z. B. swiss-product-seal.ch"
                />
                <p className="text-xs text-muted-foreground">
                  Diese URL erscheint unter dem Unternehmensnamen auf dem Siegel-Etikett.
                </p>
              </div>
              <div className="space-y-1.5">
                  <Label htmlFor="portal-email">{lang === "de" ? "Kontakt-E-Mail" : "Contact email"}</Label>
                <Input
                  id="portal-email"
                  type="email"
                  value={portalContactEmail}
                  onChange={(e) => setPortalContactEmail(e.target.value)}
                    placeholder={lang === "de" ? "z. B. compliance@spielzeug3.ch" : "e.g. compliance@spielzeug3.ch"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "de" ? "Primärfarbe (Siegel-Rahmen & Akzent)" : "Primary colour (seal frame & accent)"}</Label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={portalPrimaryColor}
                      onChange={(e) => {
                        setPortalPrimaryColor(e.target.value);
                        setPortalColorHex(e.target.value);
                      }}
                      className="w-10 h-10 rounded-lg border cursor-pointer p-0.5 bg-white"
                      title={lang === "de" ? "Farbe wählen" : "Choose colour"}
                    />
                  </div>
                  <Input
                    value={portalColorHex}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPortalColorHex(val);
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) setPortalPrimaryColor(val);
                    }}
                    placeholder="#C8102E"
                    className="w-32 font-mono text-sm"
                    maxLength={7}
                  />
                  <div
                    className="w-8 h-8 rounded-full border shadow-sm shrink-0"
                    style={{ backgroundColor: portalPrimaryColor }}
                    title="Vorschau"
                  />
                  <button
                    type="button"
                    onClick={() => { setPortalPrimaryColor("#C8102E"); setPortalColorHex("#C8102E"); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {lang === "de" ? "Zurücksetzen" : "Reset"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === "de" ? "Diese Farbe wird für den Rahmen und die Akzente des Siegel-Etiketts (HTML & PDF) verwendet." : "This colour is used for the frame and accents of the seal label (HTML & PDF)."}
                </p>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label>{lang === "de" ? "Standard-Sprache" : "Default language"}</Label>
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
                <Button
                  onClick={() =>
                    updateMyTenantMutation.mutate({
                      name: portalName || undefined,
                      websiteUrl: portalWebsiteUrl || null,
                      contactEmail: portalContactEmail || null,
                      primaryColor: /^#[0-9A-Fa-f]{6}$/.test(portalPrimaryColor) ? portalPrimaryColor : "#C8102E",
                    })
                  }
                  disabled={updateMyTenantMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateMyTenantMutation.isPending ? "Wird gespeichert…" : "Speichern"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Logo Upload ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Firmenlogo
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Das Logo erscheint auf dem Siegel-Etikett unterhalb des Unternehmensnamens.
                Empfohlen: quadratisches Format, mind. 300×300 px, PNG oder SVG.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current / preview logo */}
              {(logoPreview || currentLogoUrl) && (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={logoPreview ?? currentLogoUrl}
                      alt="Firmenlogo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {logoPreview ? "Vorschau (noch nicht gespeichert)" : "Aktuelles Logo"}
                    </p>
                    {!logoPreview && currentLogoUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive gap-1.5"
                        onClick={() => removeLogoMutation.mutate({ logoUrl: null })}
                        disabled={removeLogoMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Logo entfernen
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Upload area */}
              <div
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                onClick={() => logoInputRef.current?.click()}
              >
                <ImagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {logoUploading ? "Wird hochgeladen…" : "Logo hochladen"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WebP oder SVG · max. 5 MB
                </p>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoFileChange}
                disabled={logoUploading}
              />
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
                {lang === "de" ? "KI-Analyse – API-Konfiguration" : "AI Analysis – API Configuration"}
              </CardTitle>
              <CardDescription>
                {lang === "de"
                  ? "Wählen Sie Ihren KI-Anbieter und hinterlegen Sie den zugehörigen API-Schlüssel. Ohne gültigen Schlüssel stehen keine KI-Funktionen zur Verfügung. Der Schlüssel wird verschlüsselt gespeichert und ausschließlich serverseitig verwendet."
                  : "Choose your AI provider and enter the corresponding API key. Without a valid key, no AI features are available. The key is stored encrypted and used exclusively server-side."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Current key status */}
              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    apiKeyStatusQuery.data?.configured ? "bg-emerald-100" : "bg-amber-100"
                  }`}>
                    <Key className={`h-4 w-4 ${
                      apiKeyStatusQuery.data?.configured ? "text-emerald-600" : "text-amber-600"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {apiKeyStatusQuery.data?.configured
                        ? (lang === "de" ? "API-Schlüssel konfiguriert" : "API key configured")
                        : (lang === "de" ? "Kein API-Schlüssel hinterlegt – KI-Funktionen deaktiviert" : "No API key configured – AI features disabled")}
                    </p>
                    {apiKeyStatusQuery.data?.configured && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lang === "de" ? "Anbieter" : "Provider"}: <span className="font-medium capitalize">{(apiKeyStatusQuery.data as any)?.provider ?? "–"}</span>
                        {apiKeyStatusQuery.data?.maskedKey && (
                          <span className="font-mono ml-2">{apiKeyStatusQuery.data.maskedKey}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Provider selection + key input */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{lang === "de" ? "KI-Anbieter" : "AI Provider"}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["openai", "anthropic", "gemini"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setAiProvider(p)}
                        className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                          aiProvider === p
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p === "openai" && "OpenAI (GPT-4o)"}
                        {p === "anthropic" && "Anthropic (Claude)"}
                        {p === "gemini" && "Google (Gemini)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ai-key">
                    {apiKeyStatusQuery.data?.configured ? (lang === "de" ? "Schlüssel ersetzen" : "Replace key") : (lang === "de" ? "API-Schlüssel eingeben" : "Enter API key")}
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="ai-key"
                        type={showKey ? "text" : "password"}
                        value={aiKey}
                        onChange={(e) => setAiKey(e.target.value)}
                        placeholder={aiProvider === "openai" ? "sk-proj-..." : aiProvider === "anthropic" ? "sk-ant-..." : "AIza..."}
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
                      onClick={() => aiKey && saveKeyMutation.mutate({ apiKey: aiKey, provider: aiProvider })}
                      disabled={!aiKey || saveKeyMutation.isPending}
                    >
                      {saveKeyMutation.isPending ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {lang === "de" ? "Speichern" : "Save"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lang === "de" ? "Schlüssel erhalten Sie unter" : "Get your key at"}:{" "}
                    {aiProvider === "openai" && <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">platform.openai.com/api-keys</a>}
                    {aiProvider === "anthropic" && <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">console.anthropic.com</a>}
                    {aiProvider === "gemini" && <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">aistudio.google.com</a>}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Connection test */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{lang === "de" ? "Verbindungstest" : "Connection test"}</p>
                    <p className="text-xs text-muted-foreground">
                      {lang === "de" ? "Prüft den gespeicherten Schlüssel mit einem minimalen API-Aufruf" : "Tests the stored key with a minimal API call"}
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
                    {lang === "de" ? "Testen" : "Test"}
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
                  {lang === "de" ? "So funktioniert die KI-Analyse" : "How AI analysis works"}
                </p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• {lang === "de" ? "Wählen Sie in der Produktliste ein oder mehrere Produkte per Checkbox aus" : "Select one or more products in the product list using the checkbox"}</li>
                  <li>• {lang === "de" ? "Klicken Sie auf \"KI-Analyse starten\" – GPT-4o analysiert alle hochgeladenen Dokumente" : "Click \"Start AI analysis\" – GPT-4o analyses all uploaded documents"}</li>
                  <li>• {lang === "de" ? "Das Modell prüft Vollständigkeit, Plausibilität, formale Korrektheit und Konsistenz" : "The model checks completeness, plausibility, formal correctness and consistency"}</li>
                  <li>• {lang === "de" ? "Das Ergebnis erscheint als Score (0–100%) mit Begründung direkt beim Produkt" : "The result appears as a score (0–100%) with reasoning directly on the product"}</li>
                  <li>• {lang === "de" ? "Alle Analysen werden gespeichert und können jederzeit abgerufen werden" : "All analyses are saved and can be retrieved at any time"}</li>
                </ul>
               </div>
            </CardContent>
          </Card>

          {/* ─── Automatische Risikobewertung ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {lang === "de" ? "Automatische Risikobewertung" : "Automatic Risk Assessment"}
              </CardTitle>
              <CardDescription>
                {lang === "de"
                  ? "Steuert, ob nach jedem Dokument-Upload automatisch eine neue KI-Risikobewertung für das betroffene Produkt gestartet wird."
                  : "Controls whether a new AI risk assessment is automatically triggered for the affected product after every document upload."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">
                    {lang === "de" ? "Risikobewertung bei Dokument-Upload automatisch neu berechnen" : "Recalculate risk assessment automatically on document upload"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lang === "de"
                      ? "Die Bewertung läuft im Hintergrund (fire-and-forget) und blockiert den Upload nicht. Der aktuelle Score wird im Risiko-Tab des Produkts angezeigt."
                      : "The assessment runs in the background (fire-and-forget) and does not block the upload. The current score is displayed in the product's Risk tab."}
                  </p>
                </div>
                <Switch
                  checked={riskAutoReassess}
                  onCheckedChange={setRiskAutoReassess}
                  disabled={riskAutoReassessQuery.isLoading}
                />
              </div>
              <Button
                onClick={() =>
                  saveSealSettingMutation.mutate({
                    key: "RISK_AUTO_REASSESS",
                    value: riskAutoReassess ? "true" : "false",
                  })
                }
                disabled={saveSealSettingMutation.isPending}
                variant="outline"
              >
                {saveSealSettingMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {lang === "de" ? "Speichern" : "Save"}
              </Button>
              <div className="rounded-lg border p-3 bg-muted/20 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  {lang === "de" ? "Wann wird die Bewertung ausgelöst?" : "When is the assessment triggered?"}
                </p>
                <p>
                  {lang === "de"
                    ? "Jedes Mal, wenn ein interner Nutzer oder ein Lieferant ein neues Dokument für ein Produkt hochlädt, wird im Hintergrund automatisch eine neue Risikobewertung gestartet. Die Bewertung berücksichtigt alle vorliegenden Dokumente, Komponenten, offene Anforderungen und die letzte KI-Analyse."
                    : "Every time an internal user or supplier uploads a new document for a product, a new risk assessment is automatically started in the background. The assessment takes into account all available documents, components, open requirements and the latest AI analysis."}
                </p>
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
                {lang === "de" ? "Sicherheitseinstellungen" : "Security settings"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: lang === "de" ? "Audit-Log aktiviert" : "Audit log enabled",
                  desc: lang === "de" ? "Alle Benutzeraktionen werden protokolliert" : "All user actions are logged",
                  defaultChecked: true,
                },
                {
                  label: lang === "de" ? "Session-Timeout" : "Session timeout",
                  desc: lang === "de" ? "Benutzer werden nach Inaktivität automatisch abgemeldet" : "Users are automatically signed out after inactivity",
                  defaultChecked: true,
                },
                {
                  label: lang === "de" ? "Dokument-Zugriff einschränken" : "Restrict document access",
                  desc: lang === "de" ? "Lieferanten können nur eigene Dokumente einsehen" : "Suppliers can only view their own documents",
                  defaultChecked: true,
                },
                {
                  label: lang === "de" ? "Kommentare moderieren" : "Moderate comments",
                  desc: lang === "de" ? "Externe Kommentare werden vor Veröffentlichung geprüft" : "External comments are reviewed before publication",
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
                <Button onClick={() => toast.success(lang === "de" ? "Sicherheitseinstellungen gespeichert" : "Security settings saved")}>
                  <Save className="mr-2 h-4 w-4" />
                  {t.action.save}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BunnyDoc Digitale Signaturen ── */}
        <BunnyDocSettingsTab />

        {/* ── Siegel-Einstellungen ── */}
        <TabsContent value="seal" className="space-y-4 mt-4">
          {/* Siegel-Grafiken Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {lang === "de" ? "Siegel-Grafiken verwalten" : "Manage seal graphics"}
              </CardTitle>
              <CardDescription>
                {lang === "de" ? "Laden Sie eigene Grafiken für jeden Prüfstatus hoch. Die Grafiken werden in der Vorschau, im PDF-Export und im Einbettungscode verwendet. Mit „Standard wiederherstellen“ kehren Sie zur Original-Grafik zurück." : "Upload custom graphics for each review status. The graphics are used in the preview, PDF export and embed code. Use \"Restore default\" to revert to the original graphic."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SealAssetUpload />
            </CardContent>
          </Card>

          {/* Siegel-Vorschau */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {lang === "de" ? "Siegel-Vorschau" : "Seal preview"}
              </CardTitle>
              <CardDescription>
                {lang === "de" ? "So sieht das Etikett auf einer Produktverpackung aus. Klicken Sie auf die Status-Buttons, um alle Varianten zu sehen." : "This is how the label looks on a product package. Click the status buttons to see all variants."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SealPreview
                tenantName={tenantName}
                tenantUrl={tenantWebsiteUrl}
                tenantLogoUrl={currentLogoUrl}
                tenantPrimaryColor={portalPrimaryColor}
                tenantId={tenantId}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {lang === "de" ? "Swiss Product Seal – Automatisierung" : "Swiss Product Seal – Automation"}
              </CardTitle>
              <CardDescription>
                {lang === "de" ? "Steuern Sie, wann das Siegel und der QR-Code automatisch generiert werden." : "Control when the seal and QR code are automatically generated."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">
                    {lang === "de" ? "Siegel bei Genehmigung automatisch aktivieren" : "Automatically activate seal on approval"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lang === "de" ? "Wenn ein Produkt genehmigt wird, wird das Siegel und der QR-Code automatisch generiert – ohne manuellen Schritt im Siegel-Tab." : "When a product is approved, the seal and QR code are automatically generated – without a manual step in the seal tab."}
                  </p>
                </div>
                <Switch
                  checked={sealAutoActivate}
                  onCheckedChange={setSealAutoActivate}
                  disabled={sealSettingQuery.isLoading}
                />
              </div>

              <div className="rounded-lg border p-3 bg-muted/20 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">{lang === "de" ? "Wie funktioniert das?" : "How does it work?"}</p>
                <p>
                  {lang === "de" ? "Sobald ein Compliance Manager oder Administrator ein Produkt genehmigt, wird automatisch ein eindeutiger QR-Code generiert und auf der öffentlichen Produktlandingpage unter" : "As soon as a Compliance Manager or Administrator approves a product, a unique QR code is automatically generated and published on the public product landing page at"}{" "}
                  <code className="font-mono text-xs bg-background border rounded px-1">
                    {window.location.origin}/p/:uuid
                  </code>{" "}
                  {lang === "de" ? "veröffentlicht. Das Siegel kann jederzeit im Siegel-Tab des Produkts manuell deaktiviert werden." : "The seal can be manually deactivated at any time in the product's seal tab."}
                </p>
              </div>

              <Button
                onClick={() =>
                  saveSealSettingMutation.mutate({
                    key: "SEAL_AUTO_ACTIVATE",
                    value: sealAutoActivate ? "true" : "false",
                  })
                }
                disabled={saveSealSettingMutation.isPending}
              >
                {saveSealSettingMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Speichern
              </Button>

              {/* ─── Auto-Revoke abgelaufener öffentlicher Dokumente ─── */}
              <div className="border-t pt-5 mt-2">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {lang === "de" ? "Abgelaufene Dokumente automatisch aus der öffentlichen Freigabe entfernen" : "Automatically remove expired documents from public access"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lang === "de" ? "Dokumente mit abgelaufenem Gültigkeitsdatum werden täglich automatisch aus der Endkunden-Landingpage entfernt (publicDownload = false). Der Cron-Job läuft täglich um 02:00 Uhr." : "Documents with an expired validity date are automatically removed from the customer landing page daily (publicDownload = false). The cron job runs daily at 02:00."}
                    </p>
                  </div>
                  <Switch
                    checked={autoRevokeExpired}
                    onCheckedChange={setAutoRevokeExpired}
                    disabled={autoRevokeQuery.isLoading}
                  />
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <Button
                    onClick={() =>
                      saveSealSettingMutation.mutate({
                        key: "AUTO_REVOKE_EXPIRED_PUBLIC_DOCS",
                        value: autoRevokeExpired ? "true" : "false",
                      })
                    }
                    disabled={saveSealSettingMutation.isPending}
                    variant="outline"
                  >
                    {saveSealSettingMutation.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Speichern
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => revokeNowMutation.mutate({ force: true })}
                    disabled={revokeNowMutation.isPending}
                    title={lang === "de" ? "Jetzt alle abgelaufenen Dokumente aus der öffentlichen Freigabe entfernen" : "Remove all expired documents from public access now"}
                  >
                    {revokeNowMutation.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="mr-2 h-4 w-4" />
                    )}
                    {t.action.runNow}
                  </Button>
                </div>

                <div className="rounded-lg border p-3 bg-muted/20 text-sm text-muted-foreground mt-3">
                  <p className="font-medium text-foreground mb-1">{lang === "de" ? "Was passiert dabei?" : "What happens?"}</p>
                  <p>
                    {lang === "de" ? "Alle Dokumente, bei denen das Ablaufdatum überschritten ist und" : "All documents where the expiry date has passed and"}
                    <code className="font-mono text-xs bg-background border rounded px-1 mx-1">publicDownload = true</code>
                    {lang === "de" ? "gesetzt ist, werden automatisch auf" : "is set will be automatically reset to"}
                    <code className="font-mono text-xs bg-background border rounded px-1 mx-1">publicDownload = false</code>
                    {lang === "de" ? "zurückgesetzt. Jede Änderung wird im Audit-Log protokolliert. Das Dokument bleibt im System erhalten und kann jederzeit manuell wieder freigegeben werden." : "Every change is logged in the audit log. The document remains in the system and can be manually re-released at any time."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Beispiel-Siegel Download ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                {lang === "de" ? "Beispiel-Siegel herunterladen" : "Download sample seal"}
              </CardTitle>
              <CardDescription>
                {lang === "de"
                  ? "Laden Sie ein generisches VERIFIED-Siegel als PDF herunter. Der enthaltene QR-Code führt auf eine öffentliche Informationsseite, die das Swiss Product Seal System erklärt – ohne einen produktspezifischen Code preiszugeben."
                  : "Download a generic VERIFIED seal as PDF. The embedded QR code leads to a public information page explaining the Swiss Product Seal system – without revealing a product-specific code."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info-Box */}
              <div className="rounded-lg border bg-blue-50 border-blue-200 p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  {lang === "de" ? "Wozu dient das Beispiel-Siegel?" : "What is the sample seal for?"}
                </div>
                <ul className="space-y-1.5 text-sm text-blue-900">
                  {(lang === "de" ? [
                    "Das Siegel enthält einen QR-Code, der auf eine allgemeine Informationsseite führt – nicht auf ein konkretes Produkt.",
                    "Es kann manuell in ein Produktbild eingebunden werden, um das Siegel-Konzept zu kommunizieren, bevor das echte Siegel aktiviert ist.",
                    "Die verlinkte Seite erklärt das Swiss Product Seal und enthält einen Hinweis: Produkte ohne Siegel wurden möglicherweise nicht über die offizielle Distribution vertrieben.",
                  ] : [
                    "The seal contains a QR code leading to a general information page – not a specific product.",
                    "It can be manually embedded in a product image to communicate the seal concept before the real seal is activated.",
                    "The linked page explains the Swiss Product Seal and includes a notice: products without a seal may not have been sold through official distribution.",
                  ]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* QR-Ziel-Vorschau */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  {lang === "de" ? "QR-Code-Ziel (öffentliche Informationsseite):" : "QR code target (public information page):"}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-xs bg-background border rounded px-2 py-1">
                    {window.location.origin}/seal-info
                  </code>
                  <a
                    href="/seal-info"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {lang === "de" ? "Seite ansehen" : "View page"}
                  </a>
                </div>
              </div>

              {/* Download-Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  onClick={() => {
                    const url = `/api/reports/seal-label-example?tenantId=${tenantId}&format=pdf`;
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Swiss-Product-Seal_BEISPIEL_verified_${new Date().toISOString().slice(0, 10)}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {lang === "de" ? "Als PDF herunterladen" : "Download as PDF"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = `/api/reports/seal-label-example?tenantId=${tenantId}&format=png`;
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Swiss-Product-Seal_BEISPIEL_verified_${new Date().toISOString().slice(0, 10)}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {lang === "de" ? "Als PNG herunterladen" : "Download as PNG"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {lang === "de" ? "Status: VERIFIED · A6-Format · PDF + PNG (300 dpi)" : "Status: VERIFIED · A6 format · PDF + PNG (300 dpi)"}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── Email ── */}
        <TabsContent value="email" className="space-y-4 mt-4">
          <EmailSettingsTab />
        </TabsContent>

      </Tabs>
    </div>
  );
}

function BunnyDocSettingsTab() {
  const { lang } = useLang();
  const settingsQuery = trpc.bunnydoc.getSettings.useQuery();
  const saveSettingsMutation = trpc.bunnydoc.saveSettings.useMutation({
    onSuccess: () => {
      toast.success(lang === "de" ? "BunnyDoc-Einstellungen gespeichert" : "BunnyDoc settings saved");
      settingsQuery.refetch();
      setBunnyApiKey("");
      setBunnyTemplateId("");
    },
    onError: (e: any) => toast.error(translateError(e.message, lang)),
  });

  const [bunnyApiKey, setBunnyApiKey] = useState("");
  const [bunnyTemplateId, setBunnyTemplateId] = useState("");
  const [showBunnyKey, setShowBunnyKey] = useState(false);

  return (
    <TabsContent value="bunnydoc" className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            {lang === "de" ? "BunnyDoc – Digitale Signaturen" : "BunnyDoc – Digital Signatures"}
          </CardTitle>
          <CardDescription>
            {lang === "de" ? "Verbinden Sie BunnyDoc, um Compliance-Dokumente automatisch zur digitalen Unterzeichnung zu versenden." : "Connect BunnyDoc to automatically send compliance documents for digital signing."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status */}
          <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
              settingsQuery.data?.hasApiKey ? "bg-emerald-100" : "bg-amber-100"
            }`}>
              <Key className={`h-4 w-4 ${
                settingsQuery.data?.hasApiKey ? "text-emerald-600" : "text-amber-600"
              }`} />
            </div>
            <div>
              <p className="text-sm font-medium">
                {settingsQuery.data?.hasApiKey ? (lang === "de" ? "API-Schlüssel konfiguriert" : "API key configured") : (lang === "de" ? "Kein API-Schlüssel hinterlegt" : "No API key stored")}
              </p>
              {settingsQuery.data?.templateId && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Template-ID: {settingsQuery.data.templateId}
                </p>
              )}
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label htmlFor="bunny-api-key">
              {settingsQuery.data?.hasApiKey ? (lang === "de" ? "API-Schlüssel ersetzen" : "Replace API key") : (lang === "de" ? "API-Schlüssel eingeben" : "Enter API key")}
            </Label>
            <div className="relative">
              <Input
                id="bunny-api-key"
                type={showBunnyKey ? "text" : "password"}
                value={bunnyApiKey}
                onChange={(e) => setBunnyApiKey(e.target.value)}
                placeholder={lang === "de" ? "Ihr BunnyDoc API-Schlüssel" : "Your BunnyDoc API key"}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowBunnyKey(!showBunnyKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showBunnyKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "de" ? "Den Schlüssel finden Sie unter" : "Find your key at"}{" "}
              <a href="https://bunnydoc.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                bunnydoc.com
              </a>{" "}
              {lang === "de" ? "→ Einstellungen → API" : "→ Settings → API"}
            </p>
          </div>

          {/* Template ID */}
          <div className="space-y-1.5">
              <Label htmlFor="bunny-template-id">{lang === "de" ? "Template-ID" : "Template ID"}</Label>
            <Input
              id="bunny-template-id"
              value={bunnyTemplateId}
              onChange={(e) => setBunnyTemplateId(e.target.value)}
              placeholder={settingsQuery.data?.templateId ?? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {lang === "de" ? "Die UUID der BunnyDoc-Vorlage, die für Compliance-Dokumente verwendet werden soll." : "The UUID of the BunnyDoc template to be used for compliance documents."}
            </p>
          </div>

          <Separator />

          {/* Webhook Info */}
          <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
            <p className="text-sm font-medium">{lang === "de" ? "Webhook-URL" : "Webhook URL"}</p>
            <p className="text-xs text-muted-foreground">
              {lang === "de" ? "Tragen Sie diese URL in Ihrem BunnyDoc-Konto unter Einstellungen → Webhooks ein, damit Signatur-Status-Updates automatisch synchronisiert werden:" : "Enter this URL in your BunnyDoc account under Settings → Webhooks so that signature status updates are automatically synchronised:"}
            </p>
            <code className="block text-xs font-mono bg-background border rounded px-2 py-1 mt-1 break-all">
              {window.location.origin}/api/webhooks/bunnydoc
            </code>
          </div>

          <Button
            onClick={() => {
              if (!bunnyApiKey || !bunnyTemplateId) {
                toast.error(lang === "de" ? "Bitte API-Schlüssel und Template-ID eingeben." : "Please enter API key and template ID.");
                return;
              }
              saveSettingsMutation.mutate({ apiKey: bunnyApiKey, templateId: bunnyTemplateId });
            }}
            disabled={saveSettingsMutation.isPending}
          >
            {saveSettingsMutation.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

// ─── Email Settings Tab ───────────────────────────────────────────────────────

function EmailSettingsTab() {
  const { lang } = useLang();
  const utils = trpc.useUtils();

  const settingsQuery = trpc.email.getSettings.useQuery();

  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [htmlSignature, setHtmlSignature] = useState("");
  const [testAddress, setTestAddress] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load existing settings once
  const data = settingsQuery.data;
  if (!settingsLoaded && data) {
    setFromName(data.fromName ?? "");
    setFromAddress(data.fromAddress ?? "");
    setHtmlSignature(data.htmlSignature ?? "");
    setSettingsLoaded(true);
  }

  const updateMutation = trpc.email.updateSettings.useMutation({
    onSuccess: () => {
      toast.success(lang === "de" ? "E-Mail-Einstellungen gespeichert" : "Email settings saved");
      setApiKey("");
      utils.email.getSettings.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, lang)),
  });

  const testMutation = trpc.email.testConnection.useMutation({
    onSuccess: () => toast.success(lang === "de" ? "Test-E-Mail erfolgreich gesendet!" : "Test email sent successfully!"),
    onError: (e: any) => toast.error(translateError(e.message, lang)),
  });

  function handleSave() {
    const updates: Record<string, string> = {};
    if (apiKey) updates.apiKey = apiKey;
    if (fromName !== (data?.fromName ?? "")) updates.fromName = fromName;
    if (fromAddress !== (data?.fromAddress ?? "")) updates.fromAddress = fromAddress;
    if (htmlSignature !== (data?.htmlSignature ?? "")) updates.htmlSignature = htmlSignature;
    if (Object.keys(updates).length === 0) {
      toast.info(lang === "de" ? "Keine Änderungen erkannt." : "No changes detected.");
      return;
    }
    updateMutation.mutate(updates);
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${data?.configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {data?.configured ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <Info className="h-4 w-4 shrink-0" />
        )}
        {data?.configured
          ? (lang === "de" ? "Emailit ist konfiguriert und bereit." : "Emailit is configured and ready.")
          : (lang === "de" ? "Emailit ist noch nicht konfiguriert. Bitte API-Schlüssel und Absender-Adresse eingeben." : "Emailit is not yet configured. Please enter an API key and sender address.")}
      </div>

      {/* API Key */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            {lang === "de" ? "Emailit API-Schlüssel" : "Emailit API Key"}
          </CardTitle>
          <CardDescription>
            {lang === "de"
              ? "Den API-Schlüssel finden Sie in Ihrem Emailit-Dashboard unter API Keys."
              : "Find your API key in your Emailit dashboard under API Keys."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.maskedApiKey && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono text-muted-foreground">
              <Key className="h-3.5 w-3.5 shrink-0" />
              {data.maskedApiKey}
              <Badge variant="outline" className="ml-auto text-xs text-emerald-700 bg-emerald-50 border-emerald-200">
                {lang === "de" ? "Gespeichert" : "Saved"}
              </Badge>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="emailit-key">
              {data?.maskedApiKey
                ? (lang === "de" ? "API-Schlüssel ersetzen" : "Replace API key")
                : (lang === "de" ? "API-Schlüssel eingeben" : "Enter API key")}
            </Label>
            <div className="relative">
              <Input
                id="emailit-key"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="em_live_..."
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "de" ? "Erhältlich unter" : "Available at"}{" "}
              <a href="https://emailit.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                emailit.com
              </a>{" "}
              → {lang === "de" ? "Dashboard → API Keys" : "Dashboard → API Keys"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sender settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {lang === "de" ? "Absender-Einstellungen" : "Sender Settings"}
          </CardTitle>
          <CardDescription>
            {lang === "de"
              ? "Die Absender-Adresse muss in Ihrem Emailit-Konto als verifizierte Domain hinterlegt sein."
              : "The sender address must be registered as a verified domain in your Emailit account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from-name">{lang === "de" ? "Absender-Name" : "Sender Name"}</Label>
              <Input
                id="from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="spielzeug3 AG Compliance"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from-address">{lang === "de" ? "Absender-E-Mail" : "Sender Email"}</Label>
              <Input
                id="from-address"
                type="email"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="compliance@spielzeug3.ch"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HTML Signature */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            {lang === "de" ? "HTML-Signatur" : "HTML Signature"}
          </CardTitle>
          <CardDescription>
            {lang === "de"
              ? "Diese HTML-Signatur wird automatisch an alle ausgehenden E-Mails angehängt. HTML-Code direkt einfügen."
              : "This HTML signature is automatically appended to all outgoing emails. Paste HTML code directly."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="html-signature">
              {lang === "de" ? "HTML-Code der Signatur" : "Signature HTML Code"}
            </Label>
            <textarea
              id="html-signature"
              value={htmlSignature}
              onChange={(e) => setHtmlSignature(e.target.value)}
              placeholder={`<table style="font-family:sans-serif;font-size:13px;color:#374151;">\n  <tr>\n    <td>\n      <strong>Max Mustermann</strong><br>\n      Compliance Manager<br>\n      spielzeug3 AG<br>\n      <a href="mailto:compliance@spielzeug3.ch">compliance@spielzeug3.ch</a>\n    </td>\n  </tr>\n</table>`}
              rows={10}
              className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              {lang === "de"
                ? "Tipp: Verwenden Sie Inline-Styles für maximale E-Mail-Client-Kompatibilität."
                : "Tip: Use inline styles for maximum email client compatibility."}
            </p>
          </div>

          {/* Signature preview */}
          {htmlSignature && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {lang === "de" ? "Vorschau" : "Preview"}
              </Label>
              <div
                className="rounded-md border bg-white p-3 text-sm min-h-[60px]"
                dangerouslySetInnerHTML={{ __html: htmlSignature }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test connection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            {lang === "de" ? "Verbindung testen" : "Test Connection"}
          </CardTitle>
          <CardDescription>
            {lang === "de"
              ? "Senden Sie eine Test-E-Mail, um die Konfiguration zu überprüfen."
              : "Send a test email to verify the configuration."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
              placeholder={lang === "de" ? "test@beispiel.ch" : "test@example.com"}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => {
                if (!testAddress) {
                  toast.error(lang === "de" ? "Bitte eine E-Mail-Adresse eingeben." : "Please enter an email address.");
                  return;
                }
                testMutation.mutate({ toAddress: testAddress });
              }}
              disabled={testMutation.isPending || !data?.configured}
              className="gap-2 shrink-0"
            >
              {testMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {lang === "de" ? "Test senden" : "Send Test"}
            </Button>
          </div>
          {!data?.configured && (
            <p className="text-xs text-amber-600">
              {lang === "de"
                ? "Bitte zuerst API-Schlüssel und Absender-Adresse speichern."
                : "Please save API key and sender address first."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
          {updateMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {lang === "de" ? "Einstellungen speichern" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
