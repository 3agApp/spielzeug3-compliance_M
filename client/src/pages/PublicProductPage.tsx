import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { SealBadge } from "@/components/SealBadge";
import type { SealStatus } from "@/components/SealBadge";
import {
  ShieldCheck, ShieldAlert, ShieldOff, Package, Calendar,
  Globe, CheckCircle2, Clock, AlertTriangle, Info, Mail,
  ChevronRight, Layers, Tag, Hash, Barcode, FileText,
  BadgeCheck, ClipboardCheck, XCircle, AlertCircle, FileCheck2,
  Download, ExternalLink, BookOpen, FileWarning, Award, Wrench,
  Image, File, ChevronDown, ChevronUp, ChevronLeft,
  Building2, Sparkles, Lock, Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

// ─── i18n ────────────────────────────────────────────────────────────────────
type Lang = "de" | "en";
const T: Record<Lang, Record<string, string>> = {
  de: {
    loading: "Produktinformationen werden geladen…",
    notFound: "Produkt nicht gefunden",
    notFoundDesc: "Dieser QR-Code ist ungültig oder das Produkt wurde entfernt. Bitte wenden Sie sich an den Importeur.",
    sealTitle_verified: "Produkt verifiziert",
    sealTitle_in_progress: "Prüfung läuft",
    sealTitle_not_verified: "Nicht verifiziert",
    sealDesc_verified: "Dieses Produkt erfüllt alle Schweizer Compliance-Anforderungen und wurde vollständig geprüft.",
    sealDesc_in_progress: "Die Compliance-Prüfung dieses Produkts ist noch nicht abgeschlossen.",
    sealDesc_not_verified: "Für dieses Produkt liegt noch keine abgeschlossene Compliance-Prüfung vor.",
    productInfo: "Produktinformationen",
    brand: "Marke",
    ean: "EAN / Barcode",
    articleNumber: "Artikelnummer",
    approvedOn: "Genehmigt am",
    verifiedSince: "Verifiziert seit",
    completeness: "Vollständigkeit",
    safetyInfo: "Sicherheitsinformationen",
    safetyText: "Sicherheitshinweis",
    warningText: "Warnung",
    ageGrading: "Altersempfehlung",
    materialInfo: "Materialinformation",
    usageRestrictions: "Verwendungseinschränkungen",
    batchInfo: "Rückverfolgbarkeit / Batch",
    importedBy: "Importiert von",
    contact: "Kontakt",
    contactDesc: "Bei Fragen zu diesem Produkt wenden Sie sich bitte an den Importeur.",
    sendEmail: "E-Mail senden",
    learnMore: "Was bedeutet dieses Siegel?",
    poweredBy: "Powered by",
    documents: "Geprüfte Unterlagen",
    documentsDesc: "Folgende Unterlagen wurden eingereicht und geprüft:",
    docsApproved: "Geprüft",
    docsPending: "Ausstehend",
    docsRejected: "Abgelehnt",
    supplierDeclaration: "Lieferantenerklärung",
    supplierConfirmed: "Vollständigkeit bestätigt",
    supplierConfirmedBy: "Bestätigt von",
    supplierConfirmedOn: "am",
    trustIndicators: "Vertrauensindikatoren",
    downloadDocs: "Dokumente herunterladen",
    downloadDocsDesc: "Die folgenden Dokumente wurden von uns geprüft und zur öffentlichen Einsicht freigegeben.",
    downloadBtn: "Herunterladen",
    noPublicDocs: "Für dieses Produkt sind derzeit keine Dokumente zur öffentlichen Einsicht freigegeben.",
    docType_test_report: "Prüfbericht",
    docType_declaration_of_conformity: "Konformitätserklärung",
    docType_manual: "Bedienungsanleitung",
    docType_certificate: "Zertifikat",
    docType_product_image: "Produktbild",
    docType_safety_image: "Sicherheitsbild",
    docType_regulatory_document: "Regulatorisches Dokument",
    docType_other: "Sonstiges Dokument",
    version: "Version",
    expires: "Gültig bis",
    showDetails: "Details anzeigen",
    hideDetails: "Details ausblenden",
    docSummaryTitle: "Dokumenten-Übersicht",
    docSummaryDesc: "Status aller eingereichten Unterlagen:",
    verificationProcess: "Prüfprozess",
    step1: "Dokumenteneinreichung",
    step1Desc: "Alle Compliance-Dokumente wurden eingereicht",
    step2: "Fachprüfung",
    step2Desc: "Dokumente wurden durch Experten geprüft",
    step3: "Zertifizierung",
    step3Desc: "Produkt wurde offiziell zertifiziert",
    officialSeal: "Offizielles Schweizer Produktsiegel",
    swissStandard: "Schweizer Standard",
  },
  en: {
    loading: "Loading product information…",
    notFound: "Product not found",
    notFoundDesc: "This QR code is invalid or the product has been removed. Please contact the importer.",
    sealTitle_verified: "Product Verified",
    sealTitle_in_progress: "Verification in Progress",
    sealTitle_not_verified: "Not Verified",
    sealDesc_verified: "This product meets all Swiss compliance requirements and has been fully verified.",
    sealDesc_in_progress: "The compliance verification of this product is not yet complete.",
    sealDesc_not_verified: "No completed compliance verification exists for this product yet.",
    productInfo: "Product Information",
    brand: "Brand",
    ean: "EAN / Barcode",
    articleNumber: "Article Number",
    approvedOn: "Approved on",
    verifiedSince: "Verified since",
    completeness: "Completeness",
    safetyInfo: "Safety Information",
    safetyText: "Safety Notice",
    warningText: "Warning",
    ageGrading: "Age Recommendation",
    materialInfo: "Material Information",
    usageRestrictions: "Usage Restrictions",
    batchInfo: "Traceability / Batch",
    importedBy: "Imported by",
    contact: "Contact",
    contactDesc: "For questions about this product, please contact the importer.",
    sendEmail: "Send Email",
    learnMore: "What does this seal mean?",
    poweredBy: "Powered by",
    documents: "Verified Documents",
    documentsDesc: "The following documents have been submitted and reviewed:",
    docsApproved: "Approved",
    docsPending: "Pending",
    docsRejected: "Rejected",
    supplierDeclaration: "Supplier Declaration",
    supplierConfirmed: "Completeness confirmed",
    supplierConfirmedBy: "Confirmed by",
    supplierConfirmedOn: "on",
    trustIndicators: "Trust Indicators",
    downloadDocs: "Download Documents",
    downloadDocsDesc: "The following documents have been reviewed and released for public access.",
    downloadBtn: "Download",
    noPublicDocs: "No documents are currently released for public access for this product.",
    docType_test_report: "Test Report",
    docType_declaration_of_conformity: "Declaration of Conformity",
    docType_manual: "Manual",
    docType_certificate: "Certificate",
    docType_product_image: "Product Image",
    docType_safety_image: "Safety Image",
    docType_regulatory_document: "Regulatory Document",
    docType_other: "Other Document",
    version: "Version",
    expires: "Valid until",
    showDetails: "Show details",
    hideDetails: "Hide details",
    docSummaryTitle: "Document Overview",
    docSummaryDesc: "Status of all submitted documents:",
    verificationProcess: "Verification Process",
    step1: "Document Submission",
    step1Desc: "All compliance documents were submitted",
    step2: "Expert Review",
    step2Desc: "Documents were reviewed by experts",
    step3: "Certification",
    step3Desc: "Product was officially certified",
    officialSeal: "Official Swiss Product Seal",
    swissStandard: "Swiss Standard",
  },
};

function formatDate(d: Date | string | null | undefined, lang: Lang): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString(lang === "de" ? "de-CH" : "en-GB", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Map document types to icons and accent colors
const DOC_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  test_report:               { icon: FileCheck2,   color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  declaration_of_conformity: { icon: Award,        color: "text-emerald-700",  bg: "bg-emerald-50",  border: "border-emerald-200" },
  manual:                    { icon: BookOpen,      color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  certificate:               { icon: BadgeCheck,   color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  product_image:             { icon: Image,        color: "text-pink-700",   bg: "bg-pink-50",   border: "border-pink-200" },
  safety_image:              { icon: FileWarning,  color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  regulatory_document:       { icon: Wrench,       color: "text-slate-700",  bg: "bg-slate-50",  border: "border-slate-200" },
  other:                     { icon: File,         color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200" },
};

// ─── Swiss Cross SVG ─────────────────────────────────────────────────────────
function SwissCross({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <rect width="20" height="20" rx="3" fill="currentColor" />
      <rect x="8.5" y="3" width="3" height="14" fill="white" />
      <rect x="3" y="8.5" width="14" height="3" fill="white" />
    </svg>
  );
}

// ─── Public Download Card ─────────────────────────────────────────────────────
function PublicDocCard({ doc, t, lang }: { doc: any; t: Record<string, string>; lang: Lang }) {
  const cfg = DOC_TYPE_CONFIG[doc.documentType] ?? DOC_TYPE_CONFIG.other;
  const Icon = cfg.icon;
  const label = t[`docType_${doc.documentType}`] ?? doc.documentType;
  const isExpired = doc.expiryDate && new Date(doc.expiryDate) < new Date();

  return (
    <div className={`group flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} p-4 transition-all hover:shadow-md`}>
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${cfg.border} bg-white shadow-sm`}>
        <Icon className={`h-5 w-5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className={`text-sm font-semibold ${cfg.color}`}>{label}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]" title={doc.fileName}>
              {doc.fileName}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {doc.version > 1 && (
              <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
                v{doc.version}
              </span>
            )}
            {doc.fileSizeBytes && (
              <span className="text-xs text-gray-400">{formatFileSize(doc.fileSizeBytes)}</span>
            )}
          </div>
        </div>
        {doc.expiryDate && (
          <div className={`mt-1.5 flex items-center gap-1 text-xs ${isExpired ? "text-red-600" : "text-gray-500"}`}>
            <Calendar className="h-3 w-3" />
            <span>
              {t.expires}: {formatDate(doc.expiryDate, lang)}
              {isExpired && (
                <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-red-700 font-medium">
                  {lang === "de" ? "Abgelaufen" : "Expired"}
                </span>
              )}
            </span>
          </div>
        )}
        <div className="mt-2.5">
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={doc.fileName}
            className={`inline-flex items-center gap-1.5 rounded-lg border ${cfg.border} bg-white px-3 py-1.5 text-xs font-medium ${cfg.color} hover:bg-white/80 transition-colors shadow-sm`}
          >
            <Download className="h-3.5 w-3.5" />
            {t.downloadBtn}
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Public Image Gallery ───────────────────────────────────────────────────
function PublicImageGallery({ images, productName }: { images: Array<{ id: number; url: string; originalName?: string | null }>; productName: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return null;
  return (
    <div className="relative bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
      <div className="relative h-64 flex items-center justify-center overflow-hidden">
        <img
          src={images[active].url}
          alt={images[active].originalName ?? productName}
          className="h-full w-full object-contain p-6"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive((p) => (p - 1 + images.length) % images.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-50 rounded-full p-2 shadow-md transition-all hover:scale-105"
              aria-label="Vorheriges Bild"
            >
              <ChevronLeft size={16} className="text-gray-700" />
            </button>
            <button
              onClick={() => setActive((p) => (p + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-50 rounded-full p-2 shadow-md transition-all hover:scale-105"
              aria-label="Nächstes Bild"
            >
              <ChevronRight size={16} className="text-gray-700" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`rounded-full transition-all ${
                    i === active ? "w-4 h-1.5 bg-gray-700" : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-500"
                  }`}
                  aria-label={`Bild ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 px-4 pb-4 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                i === active ? "border-gray-700 shadow-md scale-105" : "border-transparent hover:border-gray-300"
              }`}
            >
              <img src={img.url} alt={img.originalName ?? `Bild ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, iconBg, iconColor }: {
  icon: React.ElementType; title: string; iconBg: string; iconColor: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} shadow-sm`}>
        <Icon className={`h-4.5 w-4.5 ${iconColor}`} size={18} />
      </div>
      <h2 className="text-base font-bold text-gray-900 tracking-tight">{title}</h2>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PublicProductPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = params.uuid ?? "";

  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("sps_lang") as Lang) ?? "de"; } catch { return "de"; }
  });
  const [showDocSummary, setShowDocSummary] = useState(false);
  const t = T[lang];

  useEffect(() => {
    try { localStorage.setItem("sps_lang", lang); } catch { /* ignore */ }
  }, [lang]);

  const { data: product, isLoading, error } = trpc.tenant.getPublicProduct.useQuery(
    { uuid },
    { enabled: !!uuid, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="w-16 h-16 border-4 border-gray-100 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-[#C8102E] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-400 text-sm font-medium">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm space-y-5">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
            <ShieldOff size={36} className="text-gray-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">{t.notFound}</h1>
            <p className="text-gray-500 text-sm leading-relaxed">{t.notFoundDesc}</p>
          </div>
          <a href="https://swiss-product-seal.ch" className="inline-flex items-center gap-1.5 text-[#C8102E] text-sm font-medium hover:underline">
            <SwissCross size={14} className="text-[#C8102E]" />
            swiss-product-seal.ch
          </a>
        </div>
      </div>
    );
  }

  const sealStatus = (product.sealStatus ?? "not_verified") as SealStatus;

  const statusConfig = {
    verified: {
      icon: ShieldCheck,
      heroGradient: "from-emerald-600 via-emerald-700 to-emerald-800",
      heroBg: "bg-emerald-600",
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
      badge: "bg-emerald-500",
      accent: "#059669",
    },
    in_progress: {
      icon: ShieldAlert,
      heroGradient: "from-amber-500 via-amber-600 to-orange-600",
      heroBg: "bg-amber-500",
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      pill: "bg-amber-100 text-amber-800 border-amber-200",
      badge: "bg-amber-500",
      accent: "#D97706",
    },
    not_verified: {
      icon: ShieldOff,
      heroGradient: "from-slate-500 via-slate-600 to-slate-700",
      heroBg: "bg-slate-500",
      color: "text-slate-600",
      bg: "bg-slate-50",
      border: "border-slate-200",
      pill: "bg-slate-100 text-slate-600 border-slate-200",
      badge: "bg-slate-400",
      accent: "#64748B",
    },
  }[sealStatus];

  const primaryColor = product.tenant?.primaryColor ?? "#C8102E";
  const importerName = product.importerName ?? product.tenant?.name ?? "–";
  const safety = product.safety as {
    safetyText?: string | null;
    warningText?: string | null;
    ageGrading?: string | null;
    materialInformation?: string | null;
    usageRestrictions?: string | null;
  } | null;
  const batchInfo = product.batchInfo as Record<string, string> | null;
  const docSummary = (product as any).documentSummary as Array<{
    type: string; total: number; approved: number; pending: number; rejected: number;
  }> ?? [];
  const totalDocs = (product as any).totalDocuments as number ?? 0;
  const approvedDocs = (product as any).approvedDocuments as number ?? 0;
  const publicDocuments: any[] = (product as any).publicDocuments ?? [];
  const supplierConfirmedAt = (product as any).supplierConfirmedAt as string | null;
  const supplierConfirmedBy = (product as any).supplierConfirmedBy as string | null;

  const trustItems = [
    {
      key: "docs",
      met: totalDocs > 0,
      icon: FileCheck2,
      labelDe: `${approvedDocs} von ${totalDocs} Dokument${totalDocs !== 1 ? "en" : ""} geprüft`,
      labelEn: `${approvedDocs} of ${totalDocs} document${totalDocs !== 1 ? "s" : ""} reviewed`,
    },
    {
      key: "supplier",
      met: !!supplierConfirmedAt,
      icon: ClipboardCheck,
      labelDe: supplierConfirmedAt
        ? `Lieferant hat Vollständigkeit bestätigt (${new Date(supplierConfirmedAt).toLocaleDateString("de-CH")})`
        : "Lieferant hat noch nicht bestätigt",
      labelEn: supplierConfirmedAt
        ? `Supplier confirmed completeness (${new Date(supplierConfirmedAt).toLocaleDateString("en-GB")})`
        : "Supplier has not yet confirmed",
    },
    {
      key: "approved",
      met: sealStatus === "verified",
      icon: BadgeCheck,
      labelDe: sealStatus === "verified"
        ? `Compliance-Prüfung abgeschlossen am ${formatDate(product.approvedAt, "de")}`
        : "Compliance-Prüfung noch nicht abgeschlossen",
      labelEn: sealStatus === "verified"
        ? `Compliance review completed on ${formatDate(product.approvedAt, "en")}`
        : "Compliance review not yet completed",
    },
  ];

  const hasSafetyInfo = safety && (safety.safetyText || safety.warningText || safety.ageGrading || safety.materialInformation || safety.usageRestrictions);
  const productImages: Array<{ id: number; url: string; originalName?: string | null }> =
    (product as any).productImages?.length > 0
      ? (product as any).productImages
      : product.imageUrl
      ? [{ id: 0, url: product.imageUrl, originalName: product.productName }]
      : [];

  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-[#F5F4F1]">
      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-20 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <SwissCross size={16} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm tracking-tight block leading-none">Swiss Product Seal</span>
              <span className="text-[10px] text-gray-400 tracking-wide uppercase">{t.swissStandard}</span>
            </div>
          </div>
          <button
            onClick={() => setLang(lang === "de" ? "en" : "de")}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-full px-3 py-1.5 transition-all bg-white hover:bg-gray-50 hover:border-gray-300 font-medium"
          >
            <Globe size={11} />
            {lang === "de" ? "EN" : "DE"}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto pb-12">

        {/* ── Hero Banner ───────────────────────────────────────────────── */}
        <div className={`bg-gradient-to-br ${statusConfig.heroGradient} relative overflow-hidden`}>
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-4 border-white" />
            <div className="absolute top-12 right-12 w-16 h-16 rounded-full border-2 border-white" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full border-4 border-white" />
          </div>

          <div className="relative px-5 pt-8 pb-10">
            <div className="flex items-start gap-4">
              {/* Seal badge */}
              <div className="shrink-0 bg-white/15 backdrop-blur-sm rounded-2xl p-3 shadow-lg border border-white/20">
                <StatusIcon size={36} className="text-white" />
              </div>
              {/* Status text */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white/90 text-xs font-medium uppercase tracking-wider">
                    {sealStatus === "verified" ? (lang === "de" ? "Verifiziert" : "Verified") :
                     sealStatus === "in_progress" ? (lang === "de" ? "In Prüfung" : "In Review") :
                     (lang === "de" ? "Nicht verifiziert" : "Not Verified")}
                  </span>
                </div>
                <h1 className="text-white font-bold text-xl leading-tight mb-1">
                  {t[`sealTitle_${sealStatus}` as keyof typeof t]}
                </h1>
                <p className="text-white/80 text-sm leading-relaxed">
                  {t[`sealDesc_${sealStatus}` as keyof typeof t]}
                </p>
                {sealStatus === "verified" && product.approvedAt && (
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-xs font-medium border border-white/20">
                    <CheckCircle2 size={12} />
                    {t.approvedOn}: {formatDate(product.approvedAt, lang)}
                  </div>
                )}
                {sealStatus === "in_progress" && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-white/20 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${Math.round(product.completenessScore ?? 0)}%` }}
                      />
                    </div>
                    <span className="text-white text-xs font-bold shrink-0">
                      {Math.round(product.completenessScore ?? 0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Wave bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F4F1]" style={{
            clipPath: "ellipse(55% 100% at 50% 100%)"
          }} />
        </div>

        <div className="px-4 space-y-4 -mt-2">

          {/* ── Product Card ──────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100/80">
            {/* Product images */}
            {productImages.length > 0 && (
              <PublicImageGallery images={productImages} productName={product.productName} />
            )}

            <div className="p-5">
              {/* Brand + Name */}
              <div className="mb-4">
                {product.brand && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{product.brand}</p>
                  </div>
                )}
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{product.productName}</h2>
              </div>

              {/* Article numbers as chips */}
              <div className="flex flex-wrap gap-2">
                {product.ean && (
                  <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                    <Barcode size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-600 font-mono">{product.ean}</span>
                  </div>
                )}
                {product.internalArticleNumber && (
                  <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                    <Hash size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-600 font-mono">{product.internalArticleNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Trust Indicators ─────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100/80">
            <div className="p-5">
              <SectionHeader
                icon={BadgeCheck}
                title={t.trustIndicators}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              />

              {/* Timeline-style trust items */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-100" />

                <div className="space-y-4">
                  {trustItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.key} className="flex items-start gap-4 relative">
                        <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                          item.met
                            ? "bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200"
                            : "bg-white border-gray-200"
                        }`}>
                          {item.met ? (
                            <CheckCircle2 size={14} className="text-white" />
                          ) : (
                            <Icon size={13} className="text-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <p className={`text-sm leading-snug font-medium ${item.met ? "text-gray-800" : "text-gray-400"}`}>
                            {lang === "de" ? item.labelDe : item.labelEn}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Collapsible document summary */}
              {docSummary.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowDocSummary(!showDocSummary)}
                    className="flex w-full items-center justify-between text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText size={12} />
                      {t.docSummaryTitle} ({approvedDocs}/{totalDocs} {t.docsApproved})
                    </span>
                    <div className={`rounded-full p-0.5 transition-transform ${showDocSummary ? "rotate-180" : ""}`}>
                      <ChevronDown size={14} />
                    </div>
                  </button>
                  {showDocSummary && (
                    <div className="mt-3 space-y-2">
                      {docSummary.map((doc) => {
                        const docLabel = t[`docType_${doc.type}` as keyof typeof t] ?? doc.type;
                        const allApproved = doc.approved === doc.total && doc.total > 0;
                        const hasRejected = doc.rejected > 0;
                        return (
                          <div key={doc.type} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              {allApproved ? (
                                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                              ) : hasRejected ? (
                                <XCircle size={13} className="text-red-400 shrink-0" />
                              ) : (
                                <AlertCircle size={13} className="text-amber-400 shrink-0" />
                              )}
                              <span className="text-xs text-gray-700">{docLabel}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {doc.approved > 0 && (
                                <span className="text-[10px] rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5">
                                  {doc.approved} ✓
                                </span>
                              )}
                              {doc.pending > 0 && (
                                <span className="text-[10px] rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5">
                                  {doc.pending} ⏳
                                </span>
                              )}
                              {doc.rejected > 0 && (
                                <span className="text-[10px] rounded-full bg-red-50 border border-red-200 text-red-700 px-1.5 py-0.5">
                                  {doc.rejected} ✗
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Downloadable Documents ────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100/80">
            <div className="p-5">
              <SectionHeader
                icon={Download}
                title={t.downloadDocs}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />
              <p className="text-xs text-gray-400 mb-4 -mt-2">{t.downloadDocsDesc}</p>

              {publicDocuments.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <FileText className="h-7 w-7 text-gray-200" />
                  </div>
                  <p className="text-sm text-gray-400 max-w-[220px] leading-relaxed">{t.noPublicDocs}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {publicDocuments.map((doc: any) => (
                    <PublicDocCard key={doc.id} doc={doc} t={t} lang={lang} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Safety Information ────────────────────────────────────────── */}
          {hasSafetyInfo && (
            <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-amber-100/80">
              <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-400" />
              <div className="p-5">
                <SectionHeader
                  icon={AlertTriangle}
                  title={t.safetyInfo}
                  iconBg="bg-amber-50"
                  iconColor="text-amber-500"
                />
                <div className="space-y-3">
                  {safety?.ageGrading && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <span className="text-amber-800 text-xs font-bold">{safety.ageGrading.replace(/[^0-9+]/g, '') || "?"}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-800">{t.ageGrading}</p>
                        <p className="text-sm text-amber-700">{safety.ageGrading}</p>
                      </div>
                    </div>
                  )}
                  {safety?.warningText && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        <p className="text-xs font-bold text-red-800 uppercase tracking-wide">{t.warningText}</p>
                      </div>
                      <p className="text-sm text-red-700 leading-relaxed">{safety.warningText}</p>
                    </div>
                  )}
                  {safety?.safetyText && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                      <p className="text-xs font-semibold text-amber-800 mb-1.5">{t.safetyText}</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{safety.safetyText}</p>
                    </div>
                  )}
                  {safety?.materialInformation && (
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{t.materialInfo}</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{safety.materialInformation}</p>
                    </div>
                  )}
                  {safety?.usageRestrictions && (
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{t.usageRestrictions}</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{safety.usageRestrictions}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Supplier Declaration ─────────────────────────────────────── */}
          {supplierConfirmedAt && (
            <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-emerald-100/80">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-400" />
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 shadow-sm">
                    <ClipboardCheck className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-800 text-sm">{t.supplierConfirmed}</p>
                    <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
                      {t.supplierConfirmedBy} <strong>{supplierConfirmedBy}</strong>{" "}
                      {t.supplierConfirmedOn} {formatDate(supplierConfirmedAt, lang)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Batch / Traceability ─────────────────────────────────────── */}
          {batchInfo && (batchInfo.batchNumber || batchInfo.productionDate || batchInfo.expiryDate) && (
            <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100/80">
              <div className="p-5">
                <SectionHeader
                  icon={Layers}
                  title={t.batchInfo}
                  iconBg="bg-slate-50"
                  iconColor="text-slate-500"
                />
                <div className="space-y-0 divide-y divide-gray-50">
                  {batchInfo.batchNumber && (
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-xs text-gray-500">{lang === "de" ? "Chargennummer" : "Batch Number"}</span>
                      <span className="font-mono text-xs font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5">{batchInfo.batchNumber}</span>
                    </div>
                  )}
                  {batchInfo.productionDate && (
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-xs text-gray-500">{lang === "de" ? "Produktionsdatum" : "Production Date"}</span>
                      <span className="text-xs font-semibold text-gray-800">{formatDate(batchInfo.productionDate, lang)}</span>
                    </div>
                  )}
                  {batchInfo.expiryDate && (
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-xs text-gray-500">{lang === "de" ? "Ablaufdatum" : "Expiry Date"}</span>
                      <span className={`text-xs font-semibold ${
                        new Date(batchInfo.expiryDate) < new Date()
                          ? "text-red-600"
                          : new Date(batchInfo.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                          ? "text-amber-600"
                          : "text-gray-800"
                      }`}>
                        {formatDate(batchInfo.expiryDate, lang)}
                        {new Date(batchInfo.expiryDate) < new Date() && (
                          <span className="ml-2 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-medium">
                            {lang === "de" ? "Abgelaufen" : "Expired"}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Importer ─────────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100/80">
            <div className="p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{t.importedBy}</p>
              <div className="flex items-center gap-4">
                {product.tenant?.logoUrl ? (
                  <img
                    src={product.tenant.logoUrl}
                    alt={importerName}
                    className="h-14 w-auto max-w-[160px] object-contain rounded-xl"
                  />
                ) : (
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white text-xl font-bold shadow-md"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {importerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900 text-base">{importerName}</p>
                  {((product.tenant as any)?.websiteUrl ?? product.tenant?.slug) && (
                    <a
                      href={(product.tenant as any)?.websiteUrl ?? `https://swiss-product-seal.ch/${product.tenant?.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-1 transition-colors"
                    >
                      <ExternalLink size={10} />
                      {(product.tenant as any)?.websiteUrl
                        ? (product.tenant as any).websiteUrl.replace(/^https?:\/\//, "")
                        : `swiss-product-seal.ch/${product.tenant?.slug}`}
                    </a>
                  )}
                </div>
              </div>

              {product.tenant?.contactEmail && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-3">{t.contactDesc}</p>
                  <a href={`mailto:${product.tenant.contactEmail}`}>
                    <button
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 transition-all hover:shadow-sm"
                    >
                      <Mail size={13} />
                      {t.sendEmail}
                    </button>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden border border-gray-100/80" style={{ background: `linear-gradient(135deg, ${primaryColor}08 0%, ${primaryColor}04 100%)` }}>
            <div className="p-5 text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <SwissCross size={18} className="text-[#C8102E]" />
                <span className="text-sm font-bold text-gray-700">Swiss Product Seal</span>
              </div>
              <Link
                href="/about-seal"
                className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline transition-colors"
                style={{ color: primaryColor }}
              >
                <Info size={13} />
                {t.learnMore}
                <ChevronRight size={13} />
              </Link>
              <p className="text-xs text-gray-400">
                {t.poweredBy}{" "}
                <a href="https://swiss-product-seal.ch" className="hover:underline text-gray-500 font-medium">
                  swiss-product-seal.ch
                </a>
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
