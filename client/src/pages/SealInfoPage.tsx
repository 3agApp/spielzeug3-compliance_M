/**
 * SealInfoPage – öffentliche Informationsseite für den Swiss Product Seal.
 * Erreichbar unter /seal-info (kein Login erforderlich).
 * Wird als QR-Code-Ziel im Beispiel-Siegel verwendet.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  QrCode,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Texte ────────────────────────────────────────────────────────────────────

const CONTENT = {
  de: {
    badge: "Swiss Product Seal",
    headline: "Was ist das Swiss Product Seal?",
    intro:
      "Das Swiss Product Seal ist ein digitales Qualitäts- und Transparenzsiegel für Produkte, die über offizielle Schweizer Distributoren in den Markt gebracht werden. Es bescheinigt, dass alle relevanten Compliance-Dokumente (Prüfberichte, Konformitätserklärungen, Sicherheitsnachweise) geprüft und hinterlegt sind.",
    howTitle: "Wie funktioniert das Siegel?",
    howSteps: [
      {
        icon: "qr",
        title: "QR-Code auf dem Produkt",
        desc: "Jedes zertifizierte Produkt trägt ein Siegel-Etikett mit einem eindeutigen QR-Code. Dieser Code ist produktspezifisch und kann nicht kopiert oder übertragen werden.",
      },
      {
        icon: "shield",
        title: "Online-Verifikation",
        desc: "Durch Scannen des QR-Codes gelangen Sie auf die produktspezifische Informationsseite. Dort sehen Sie den aktuellen Compliance-Status, verfügbare Dokumente und Angaben zum Importeur.",
      },
      {
        icon: "check",
        title: "Vertrauensstufen",
        desc: "VERIFIED bedeutet: alle Dokumente sind vollständig und geprüft. IN REVIEW bedeutet: die Prüfung läuft noch. NOT VERIFIED bedeutet: keine abgeschlossene Prüfung vorhanden.",
      },
    ],
    statusTitle: "Bedeutung der Siegel-Status",
    statuses: [
      {
        label: "VERIFIED",
        color: "bg-green-100 text-green-800 border-green-200",
        icon: "verified",
        desc: "Alle erforderlichen Compliance-Dokumente sind vorhanden, geprüft und gültig. Höchste Vertrauensstufe.",
      },
      {
        label: "IN REVIEW",
        color: "bg-amber-100 text-amber-800 border-amber-200",
        icon: "review",
        desc: "Die Compliance-Prüfung ist noch nicht abgeschlossen. Einige Dokumente fehlen oder werden noch geprüft.",
      },
      {
        label: "NOT VERIFIED",
        color: "bg-gray-100 text-gray-700 border-gray-200",
        icon: "not",
        desc: "Für dieses Produkt liegt noch keine abgeschlossene Compliance-Prüfung vor.",
      },
    ],
    warningTitle: "Wichtiger Hinweis: Produkt ohne Siegel erhalten?",
    warningText:
      "Sollten Sie ein Produkt bestellt haben, das laut Produktbeschreibung oder Händlerangabe das Swiss Product Seal tragen sollte, und Sie erhalten es ohne das Siegel-Etikett oder mit einem ungültigen QR-Code – dann handelt es sich möglicherweise um ein Produkt, das nicht über die offizielle Distribution in den Markt gebracht wurde.",
    warningConsequences: [
      "Der offizielle Distributor übernimmt keine Garantie oder Gewährleistung für dieses Produkt.",
      "Rückgabe- und Umtauschrechte gegenüber dem offiziellen Importeur bestehen nicht.",
      "Die Einhaltung von Sicherheits- und Qualitätsstandards kann nicht garantiert werden.",
      "Wenden Sie sich an den Händler und erkundigen Sie sich nach der Herkunft des Produkts.",
    ],
    faqTitle: "Häufige Fragen",
    faqs: [
      {
        q: "Ist das Swiss Product Seal staatlich anerkannt?",
        a: "Das Swiss Product Seal ist ein privates Qualitätssiegel. Es ersetzt keine gesetzlich vorgeschriebenen Kennzeichnungen, ergänzt diese aber durch zusätzliche Transparenz und digitale Dokumentation.",
      },
      {
        q: "Kann ein Siegel gefälscht werden?",
        a: "Jeder QR-Code ist eindeutig und produktspezifisch. Ein kopierter QR-Code führt immer auf dieselbe Produktseite – ein Fälschungsversuch ist daher sofort erkennbar, wenn Produkt und Seite nicht übereinstimmen.",
      },
      {
        q: "Was passiert, wenn ein Dokument abläuft?",
        a: "Das System überwacht Ablaufdaten automatisch. Abgelaufene Dokumente werden aus der öffentlichen Ansicht entfernt, und der Importeur wird aufgefordert, aktualisierte Unterlagen einzureichen.",
      },
      {
        q: "Wie kann ich ein Problem melden?",
        a: "Bei Fragen oder Problemen wenden Sie sich an den auf der Produktseite angezeigten Importeur oder an info@swiss-product-seal.ch.",
      },
    ],
    backToProduct: "Zurück zur Produktseite",
    footerText: "Swiss Product Seal Platform – Transparenz für den Schweizer Markt",
    langSwitch: "English",
  },
  en: {
    badge: "Swiss Product Seal",
    headline: "What is the Swiss Product Seal?",
    intro:
      "The Swiss Product Seal is a digital quality and transparency seal for products distributed through official Swiss distributors. It certifies that all relevant compliance documents (test reports, declarations of conformity, safety evidence) have been reviewed and are on file.",
    howTitle: "How does the seal work?",
    howSteps: [
      {
        icon: "qr",
        title: "QR code on the product",
        desc: "Every certified product carries a seal label with a unique QR code. This code is product-specific and cannot be copied or transferred.",
      },
      {
        icon: "shield",
        title: "Online verification",
        desc: "Scanning the QR code takes you to the product-specific information page, where you can see the current compliance status, available documents, and importer details.",
      },
      {
        icon: "check",
        title: "Trust levels",
        desc: "VERIFIED means all documents are complete and reviewed. IN REVIEW means the review is still in progress. NOT VERIFIED means no completed review is on file.",
      },
    ],
    statusTitle: "Seal status meanings",
    statuses: [
      {
        label: "VERIFIED",
        color: "bg-green-100 text-green-800 border-green-200",
        icon: "verified",
        desc: "All required compliance documents are present, reviewed, and valid. Highest trust level.",
      },
      {
        label: "IN REVIEW",
        color: "bg-amber-100 text-amber-800 border-amber-200",
        icon: "review",
        desc: "The compliance review is not yet complete. Some documents may be missing or still under review.",
      },
      {
        label: "NOT VERIFIED",
        color: "bg-gray-100 text-gray-700 border-gray-200",
        icon: "not",
        desc: "No completed compliance review is on file for this product.",
      },
    ],
    warningTitle: "Important notice: Received a product without a seal?",
    warningText:
      "If you ordered a product that was described as carrying the Swiss Product Seal and you received it without the seal label or with an invalid QR code, the product may not have been brought to market through the official distribution channel.",
    warningConsequences: [
      "The official distributor accepts no warranty or guarantee for this product.",
      "Return and exchange rights vis-à-vis the official importer do not apply.",
      "Compliance with safety and quality standards cannot be guaranteed.",
      "Contact the seller and ask about the product's origin.",
    ],
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        q: "Is the Swiss Product Seal officially recognised?",
        a: "The Swiss Product Seal is a private quality mark. It does not replace legally required labelling but supplements it with additional transparency and digital documentation.",
      },
      {
        q: "Can a seal be forged?",
        a: "Each QR code is unique and product-specific. A copied QR code always leads to the same product page – any forgery attempt is immediately apparent when the product and page do not match.",
      },
      {
        q: "What happens when a document expires?",
        a: "The system monitors expiry dates automatically. Expired documents are removed from the public view and the importer is prompted to submit updated records.",
      },
      {
        q: "How can I report a problem?",
        a: "For questions or concerns, contact the importer shown on the product page or write to info@swiss-product-seal.ch.",
      },
    ],
    backToProduct: "Back to product page",
    footerText: "Swiss Product Seal Platform – Transparency for the Swiss market",
    langSwitch: "Deutsch",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SealInfoPage() {
  const [lang, setLang] = useState<"de" | "en">("de");
  const [, setLocation] = useLocation();
  const t = CONTENT[lang];

  const stepIcons: Record<string, React.ReactNode> = {
    qr: <QrCode className="h-6 w-6 text-primary" />,
    shield: <Shield className="h-6 w-6 text-primary" />,
    check: <CheckCircle2 className="h-6 w-6 text-primary" />,
  };

  const statusIcons: Record<string, React.ReactNode> = {
    verified: <ShieldCheck className="h-5 w-5 text-green-600" />,
    review: <Shield className="h-5 w-5 text-amber-600" />,
    not: <ShieldAlert className="h-5 w-5 text-gray-500" />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/60 to-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-green-600" />
            <span className="font-semibold text-sm">Swiss Product Seal</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === "de" ? "en" : "de")}
            className="gap-1.5 text-xs"
          >
            <Globe className="h-3.5 w-3.5" />
            {t.langSwitch}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 border border-green-200 rounded-full px-4 py-1.5 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            {t.badge}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t.headline}</h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">{t.intro}</p>
        </section>

        {/* How it works */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t.howTitle}</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {t.howSteps.map((step, i) => (
              <Card key={i} className="border-0 shadow-sm bg-white">
                <CardContent className="pt-5 pb-5 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    {stepIcons[step.icon]}
                  </div>
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Status meanings */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t.statusTitle}</h2>
          <div className="space-y-3">
            {t.statuses.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border bg-white shadow-sm">
                <div className="mt-0.5">{statusIcons[s.icon]}</div>
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className={`text-xs font-semibold mb-1 ${s.color}`}>
                    {s.label}
                  </Badge>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Warning box */}
        <section>
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 font-semibold">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span>{t.warningTitle}</span>
            </div>
            <p className="text-sm text-amber-900 leading-relaxed">{t.warningText}</p>
            <ul className="space-y-1.5">
              {t.warningConsequences.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-600 flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t.faqTitle}</h2>
          <div className="space-y-3">
            {t.faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border bg-white shadow-sm p-4 space-y-1">
                <p className="font-medium text-sm">{faq.q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Back link */}
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setLocation("/about-seal")} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            {t.backToProduct}
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-10 py-6 text-center text-xs text-muted-foreground">
        {t.footerText}
      </footer>
    </div>
  );
}
