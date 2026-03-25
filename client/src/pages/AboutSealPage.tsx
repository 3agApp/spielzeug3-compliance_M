import { useState } from "react";
import { Link } from "wouter";
import {
  ShieldCheck, CheckCircle2, FileText, Globe, ArrowLeft,
  Building2, Package, QrCode, ClipboardCheck, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type Lang = "de" | "en";

const content: Record<Lang, {
  back: string;
  title: string;
  subtitle: string;
  whatTitle: string;
  whatText: string;
  howTitle: string;
  steps: { icon: React.ReactNode; title: string; text: string }[];
  statusTitle: string;
  statuses: { label: string; color: string; desc: string }[];
  faqTitle: string;
  faqs: { q: string; a: string }[];
  footerText: string;
}> = {
  de: {
    back: "Zurück",
    title: "Was ist das Swiss Product Seal?",
    subtitle: "Transparenz und Vertrauen für Produkte auf dem Schweizer Markt",
    whatTitle: "Das Siegel erklärt",
    whatText: `Das Swiss Product Seal ist ein digitales Compliance-Zertifikat für Produkte, die in die Schweiz importiert werden. Es bestätigt, dass der Importeur alle relevanten Sicherheits- und Konformitätsdokumente hinterlegt hat – von CE-Zertifikaten über Sicherheitsdatenblätter bis hin zu Produktkennzeichnungen.

Konsumenten können über den QR-Code auf der Verpackung jederzeit den aktuellen Compliance-Status eines Produkts einsehen. Importeure nutzen die Plattform, um ihre Dokumentation zu verwalten und Transparenz zu schaffen.`,
    howTitle: "Wie funktioniert es?",
    steps: [
      { icon: <Building2 size={20} />, title: "Importeur registriert sich", text: "Schweizer Importeure registrieren sich auf der Swiss Product Seal Plattform und hinterlegen ihre Unternehmensinfos." },
      { icon: <Package size={20} />, title: "Produkt wird angelegt", text: "Für jedes Produkt wird ein Datensatz erstellt mit EAN, Marke, Lieferant und allen relevanten Compliance-Anforderungen." },
      { icon: <FileText size={20} />, title: "Dokumente werden hochgeladen", text: "Der Importeur lädt alle erforderlichen Dokumente hoch: CE-Zertifikate, Sicherheitsdatenblätter, Konformitätserklärungen etc." },
      { icon: <ClipboardCheck size={20} />, title: "Compliance wird geprüft", text: "Das System prüft automatisch die Vollständigkeit aller Dokumente und berechnet einen Compliance-Score." },
      { icon: <QrCode size={20} />, title: "QR-Code wird generiert", text: "Bei vollständiger Compliance wird ein eindeutiger QR-Code generiert, der auf die öffentliche Produktseite verweist." },
      { icon: <Globe size={20} />, title: "Konsumenten können scannen", text: "Konsumenten scannen den QR-Code und sehen sofort den aktuellen Compliance-Status des Produkts." },
    ],
    statusTitle: "Was bedeuten die Status?",
    statuses: [
      { label: "VERIFIED", color: "bg-green-100 text-green-800 border-green-200", desc: "Alle erforderlichen Dokumente sind vorhanden und das Produkt wurde genehmigt. Höchste Vertrauensstufe." },
      { label: "IN PROGRESS", color: "bg-amber-100 text-amber-800 border-amber-200", desc: "Die Compliance-Prüfung läuft noch. Einige Dokumente fehlen möglicherweise noch." },
      { label: "NOT VERIFIED", color: "bg-gray-100 text-gray-700 border-gray-200", desc: "Für dieses Produkt liegt noch keine abgeschlossene Compliance-Prüfung vor." },
    ],
    faqTitle: "Häufige Fragen",
    faqs: [
      { q: "Ist das Swiss Product Seal staatlich anerkannt?", a: "Das Swiss Product Seal ist ein privates Qualitätssiegel. Es ersetzt keine gesetzlich vorgeschriebenen Kennzeichnungen, ergänzt diese aber durch zusätzliche Transparenz." },
      { q: "Wer kann das Siegel nutzen?", a: "Das Siegel steht Schweizer Importeuren offen, die ihre Compliance-Dokumentation digital verwalten und Konsumenten gegenüber transparent sein möchten." },
      { q: "Was passiert, wenn ein Dokument abläuft?", a: "Das System überwacht Ablaufdaten automatisch und sendet Erinnerungen an den Importeur. Der Status wird entsprechend aktualisiert." },
      { q: "Wie kann ich ein Problem melden?", a: "Bei Fragen oder Problemen wenden Sie sich direkt an den auf der Produktseite angezeigten Importeur oder an info@swiss-product-seal.ch." },
    ],
    footerText: "Swiss Product Seal Platform – Transparenz für den Schweizer Markt",
  },
  en: {
    back: "Back",
    title: "What is the Swiss Product Seal?",
    subtitle: "Transparency and trust for products on the Swiss market",
    whatTitle: "The Seal Explained",
    whatText: `The Swiss Product Seal is a digital compliance certificate for products imported into Switzerland. It confirms that the importer has filed all relevant safety and conformity documents – from CE certificates to safety data sheets and product labeling.

Consumers can use the QR code on the packaging to check the current compliance status of a product at any time. Importers use the platform to manage their documentation and create transparency.`,
    howTitle: "How does it work?",
    steps: [
      { icon: <Building2 size={20} />, title: "Importer registers", text: "Swiss importers register on the Swiss Product Seal platform and provide their company information." },
      { icon: <Package size={20} />, title: "Product is created", text: "A record is created for each product with EAN, brand, supplier and all relevant compliance requirements." },
      { icon: <FileText size={20} />, title: "Documents are uploaded", text: "The importer uploads all required documents: CE certificates, safety data sheets, declarations of conformity, etc." },
      { icon: <ClipboardCheck size={20} />, title: "Compliance is verified", text: "The system automatically checks the completeness of all documents and calculates a compliance score." },
      { icon: <QrCode size={20} />, title: "QR code is generated", text: "When compliance is complete, a unique QR code is generated that links to the public product page." },
      { icon: <Globe size={20} />, title: "Consumers can scan", text: "Consumers scan the QR code and immediately see the current compliance status of the product." },
    ],
    statusTitle: "What do the statuses mean?",
    statuses: [
      { label: "VERIFIED", color: "bg-green-100 text-green-800 border-green-200", desc: "All required documents are present and the product has been approved. Highest level of trust." },
      { label: "IN PROGRESS", color: "bg-amber-100 text-amber-800 border-amber-200", desc: "The compliance review is still ongoing. Some documents may still be missing." },
      { label: "NOT VERIFIED", color: "bg-gray-100 text-gray-700 border-gray-200", desc: "No completed compliance review exists for this product yet." },
    ],
    faqTitle: "Frequently Asked Questions",
    faqs: [
      { q: "Is the Swiss Product Seal officially recognized?", a: "The Swiss Product Seal is a private quality seal. It does not replace legally required labeling but complements it with additional transparency." },
      { q: "Who can use the seal?", a: "The seal is available to Swiss importers who want to manage their compliance documentation digitally and be transparent with consumers." },
      { q: "What happens when a document expires?", a: "The system automatically monitors expiry dates and sends reminders to the importer. The status is updated accordingly." },
      { q: "How can I report a problem?", a: "For questions or problems, contact the importer shown on the product page directly or reach us at info@swiss-product-seal.ch." },
    ],
    footerText: "Swiss Product Seal Platform – Transparency for the Swiss market",
  },
};

export default function AboutSealPage() {
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("sps_lang") as Lang) ?? "de"; } catch { return "de"; }
  });
  const c = content[lang];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
            <ArrowLeft size={16} />
            {c.back}
          </Link>
          <button
            onClick={() => setLang(lang === "de" ? "en" : "de")}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 transition-colors"
          >
            <Globe size={12} />
            {lang === "de" ? "EN" : "DE"}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-[#C8102E] rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{c.title}</h1>
          <p className="text-gray-500 text-sm">{c.subtitle}</p>
        </div>

        {/* What is it */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="text-lg font-bold text-gray-900">{c.whatTitle}</h2>
            {c.whatText.split("\n\n").map((para, i) => (
              <p key={i} className="text-gray-600 text-sm leading-relaxed">{para}</p>
            ))}
          </CardContent>
        </Card>

        {/* How it works */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">{c.howTitle}</h2>
          <div className="space-y-3">
            {c.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="w-9 h-9 bg-[#C8102E]/10 rounded-lg flex items-center justify-center text-[#C8102E] shrink-0">
                  {step.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-[#C8102E]">{i + 1}</span>
                    <h3 className="font-semibold text-gray-900 text-sm">{step.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status explanation */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">{c.statusTitle}</h2>
          <div className="space-y-3">
            {c.statuses.map((s, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <Badge className={`${s.color} border text-xs font-bold shrink-0 mt-0.5`}>{s.label}</Badge>
                <p className="text-sm text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">{c.faqTitle}</h2>
          <div className="space-y-3">
            {c.faqs.map((faq, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-[#C8102E] shrink-0 mt-0.5" />
                    <h3 className="font-semibold text-gray-900 text-sm">{faq.q}</h3>
                  </div>
                  <p className="text-sm text-gray-600 pl-6">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Warning note */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              {lang === "de"
                ? "Das Swiss Product Seal ersetzt keine gesetzlich vorgeschriebenen Sicherheitskennzeichnungen. Bei sicherheitsrelevanten Fragen wenden Sie sich immer an die zuständigen Behörden."
                : "The Swiss Product Seal does not replace legally required safety markings. For safety-related questions, always contact the relevant authorities."}
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-4">
          <Separator className="mb-4" />
          <p className="text-xs text-gray-400">{c.footerText}</p>
          <a href="https://swiss-product-seal.ch" className="text-xs text-[#C8102E] hover:underline mt-1 inline-block">
            swiss-product-seal.ch
          </a>
        </div>
      </main>
    </div>
  );
}
