import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLang } from "@/lib/i18n";
import { CheckCircle2, FileText, Globe, Shield } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { t, lang, setLang } = useLang();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-semibold text-sm">spielzeug3 AG</span>
            <p className="text-xs text-muted-foreground">Supplier Compliance Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(t.inline.en)}
            className="gap-1.5"
          >
            <Globe className="h-4 w-4" />
            {t.inline.en_1}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {t.auth.loginTitle}
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                {t.auth.loginSubtitle}
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: Shield,
                  title: t.inline.complianceworkflows,
                  desc: lang === "de"
                    ? "Strukturierter Prozess von Einreichung bis Genehmigung"
                    : "Structured process from submission to approval",
                },
                {
                  icon: FileText,
                  title: t.inline.dokumentenmanagement,
                  desc: lang === "de"
                    ? "Sicherer Upload und Versionierung aller Compliance-Dokumente"
                    : "Secure upload and versioning of all compliance documents",
                },
                {
                  icon: CheckCircle2,
                  title: t.inline.vollstaendigkeitspruefung,
                  desc: lang === "de"
                    ? "Automatische Prüfung aller Anforderungen"
                    : "Automatic verification of all requirements",
                },
                {
                  icon: Globe,
                  title: t.inline.kontor_erpintegration,
                  desc: lang === "de"
                    ? "Bidirektionale Synchronisation mit Kontor ERP"
                    : "Bidirectional synchronization with Kontor ERP",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-white border">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Login Card */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-sm bg-white rounded-2xl border shadow-sm p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">
                  {t.inline.anmelden}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === "de"
                    ? "Melden Sie sich mit Ihrem Manus-Konto an"
                    : "Sign in with your Manus account"}
                </p>
              </div>

              <a href={getLoginUrl()}>
                <Button className="w-full" size="lg">
                  {t.auth.loginButton}
                </Button>
              </a>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground text-center">
                  {lang === "de"
                    ? "Für Zugang wenden Sie sich an Ihren Administrator"
                    : "For access, contact your administrator"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t bg-white/60 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} spielzeug3 AG – Supplier Compliance Portal
        </p>
      </footer>
    </div>
  );
}
