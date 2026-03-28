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
  Image, File, ChevronDown, ChevronUp,
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
  declaration_of_conformity: { icon: Award,        color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  manual:                    { icon: BookOpen,      color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  certificate:               { icon: BadgeCheck,   color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  product_image:             { icon: Image,        color: "text-pink-700",   bg: "bg-pink-50",   border: "border-pink-200" },
  safety_image:              { icon: FileWarning,  color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  regulatory_document:       { icon: Wrench,       color: "text-slate-700",  bg: "bg-slate-50",  border: "border-slate-200" },
  other:                     { icon: File,         color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200" },
};

// ─── Public Download Card ─────────────────────────────────────────────────────
function PublicDocCard({ doc, t, lang }: { doc: any; t: Record<string, string>; lang: Lang }) {
  const cfg = DOC_TYPE_CONFIG[doc.documentType] ?? DOC_TYPE_CONFIG.other;
  const Icon = cfg.icon;
  const label = t[`docType_${doc.documentType}`] ?? doc.documentType;
  const isExpired = doc.expiryDate && new Date(doc.expiryDate) < new Date();

  return (
    <div className={`flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} p-4 transition-shadow hover:shadow-sm`}>
      {/* Icon */}
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${cfg.border} bg-white`}>
        <Icon className={`h-5 w-5 ${cfg.color}`} />
      </div>

      {/* Info */}
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

        {/* Expiry warning */}
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

        {/* Download button */}
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
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#C8102E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <ShieldOff size={56} className="text-gray-300 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-800">{t.notFound}</h1>
          <p className="text-gray-500">{t.notFoundDesc}</p>
          <a href="https://swiss-product-seal.ch" className="inline-block mt-2 text-[#C8102E] text-sm font-medium hover:underline">
            swiss-product-seal.ch
          </a>
        </div>
      </div>
    );
  }

  const sealStatus = (product.sealStatus ?? "not_verified") as SealStatus;
  const statusConfig = {
    verified:     { icon: ShieldCheck, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bannerBg: "bg-emerald-600", pill: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    in_progress:  { icon: ShieldAlert, color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   bannerBg: "bg-amber-500",   pill: "bg-amber-100 text-amber-800 border-amber-200" },
    not_verified: { icon: ShieldOff,   color: "text-gray-500",    bg: "bg-gray-50",    border: "border-gray-200",    bannerBg: "bg-gray-400",    pill: "bg-gray-100 text-gray-600 border-gray-200" },
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

  // Trust indicators
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

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">Swiss Product Seal</span>
          </div>
          <button
            onClick={() => setLang(lang === "de" ? "en" : "de")}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-full px-2.5 py-1 transition-colors bg-white hover:bg-gray-50"
          >
            <Globe size={11} />
            {lang === "de" ? "EN" : "DE"}
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* ── Hero: Product + Seal ───────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
          {/* Colored accent bar */}
          <div className="h-1 w-full" style={{ backgroundColor: primaryColor }} />

          {/* Product image (if available) */}
          {product.imageUrl && (
            <div className="h-52 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
              <img
                src={product.imageUrl}
                alt={product.productName}
                className="h-full w-full object-contain p-4"
              />
            </div>
          )}

          <div className="p-5 space-y-4">
            {/* Product name + brand */}
            <div>
              {product.brand && (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{product.brand}</p>
              )}
              <h1 className="text-xl font-bold text-gray-900 leading-snug">{product.productName}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {product.ean && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">
                    <Barcode size={10} />
                    {product.ean}
                  </span>
                )}
                {product.internalArticleNumber && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">
                    <Hash size={10} />
                    {product.internalArticleNumber}
                  </span>
                )}
              </div>
            </div>

            <Separator />

            {/* Seal status */}
            <div className={`flex items-center gap-4 rounded-xl border ${statusConfig.border} ${statusConfig.bg} p-4`}>
              <div className="shrink-0">
                <SealBadge status={sealStatus} size="md" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-base ${statusConfig.color}`}>
                  {t[`sealTitle_${sealStatus}` as keyof typeof t]}
                </p>
                <p className="text-xs text-gray-600 mt-0.5 leading-snug">
                  {t[`sealDesc_${sealStatus}` as keyof typeof t]}
                </p>
                {sealStatus === "verified" && product.approvedAt && (
                  <div className={`mt-2 inline-flex items-center gap-1 text-xs rounded-full border px-2.5 py-0.5 font-medium ${statusConfig.pill}`}>
                    <CheckCircle2 size={11} />
                    {t.approvedOn}: {formatDate(product.approvedAt, lang)}
                  </div>
                )}
                {sealStatus === "in_progress" && (
                  <div className={`mt-2 inline-flex items-center gap-1 text-xs rounded-full border px-2.5 py-0.5 font-medium ${statusConfig.pill}`}>
                    <Clock size={11} />
                    {Math.round(product.completenessScore ?? 0)}% {t.completeness}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Downloadable Documents ────────────────────────────────────── */}
        <section className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
          <div className="h-1 w-full" style={{ backgroundColor: primaryColor }} />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${primaryColor}18` }}
              >
                <Download className="h-4 w-4" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-base font-bold text-gray-900">{t.downloadDocs}</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4 ml-10">{t.downloadDocsDesc}</p>

            {publicDocuments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <FileText className="h-10 w-10 text-gray-200" />
                <p className="text-sm text-gray-400">{t.noPublicDocs}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {publicDocuments.map((doc: any) => (
                  <PublicDocCard key={doc.id} doc={doc} t={t} lang={lang} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Safety Information ────────────────────────────────────────── */}
        {hasSafetyInfo && (
          <section className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
            <div className="h-1 w-full bg-amber-400" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <h2 className="text-base font-bold text-gray-900">{t.safetyInfo}</h2>
              </div>

              <div className="space-y-3">
                {safety?.ageGrading && (
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      {t.ageGrading}
                    </span>
                    <span className="text-sm text-gray-700">{safety.ageGrading}</span>
                  </div>
                )}
                {safety?.warningText && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      <p className="text-xs font-bold text-red-800 uppercase tracking-wide">{t.warningText}</p>
                    </div>
                    <p className="text-sm text-red-700 leading-relaxed">{safety.warningText}</p>
                  </div>
                )}
                {safety?.safetyText && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
                    <p className="text-xs font-semibold text-amber-800 mb-1">{t.safetyText}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{safety.safetyText}</p>
                  </div>
                )}
                {safety?.materialInformation && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{t.materialInfo}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{safety.materialInformation}</p>
                  </div>
                )}
                {safety?.usageRestrictions && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{t.usageRestrictions}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{safety.usageRestrictions}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Trust Indicators ─────────────────────────────────────────── */}
        <section className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900">{t.trustIndicators}</h2>
            </div>
            <div className="space-y-3">
              {trustItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      item.met ? "bg-emerald-100" : "bg-gray-100"
                    }`}>
                      <Icon size={13} className={item.met ? "text-emerald-600" : "text-gray-400"} />
                    </div>
                    <p className={`text-sm leading-snug ${item.met ? "text-gray-800" : "text-gray-400"}`}>
                      {lang === "de" ? item.labelDe : item.labelEn}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Collapsible document summary */}
            {docSummary.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowDocSummary(!showDocSummary)}
                  className="flex w-full items-center justify-between text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText size={12} />
                    {t.docSummaryTitle} ({approvedDocs}/{totalDocs} {t.docsApproved})
                  </span>
                  {showDocSummary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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
        </section>

        {/* ── Supplier Declaration ─────────────────────────────────────── */}
        {supplierConfirmedAt && (
          <section className="rounded-2xl overflow-hidden bg-white shadow-sm border border-emerald-100">
            <div className="h-1 w-full bg-emerald-500" />
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800 text-sm">{t.supplierConfirmed}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {t.supplierConfirmedBy} <strong>{supplierConfirmedBy}</strong>{" "}
                    {t.supplierConfirmedOn} {formatDate(supplierConfirmedAt, lang)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Batch / Traceability ─────────────────────────────────────── */}
        {batchInfo && (batchInfo.batchNumber || batchInfo.productionDate || batchInfo.expiryDate) && (
          <section className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                  <Layers className="h-4 w-4 text-slate-500" />
                </div>
                <h2 className="text-base font-bold text-gray-900">{t.batchInfo}</h2>
              </div>
              <div className="space-y-2 text-sm">
                {batchInfo.batchNumber && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                    <span className="text-gray-500 text-xs">{lang === "de" ? "Chargennummer" : "Batch Number"}</span>
                    <span className="font-medium text-gray-800 font-mono text-xs">{batchInfo.batchNumber}</span>
                  </div>
                )}
                {batchInfo.productionDate && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                    <span className="text-gray-500 text-xs">{lang === "de" ? "Produktionsdatum" : "Production Date"}</span>
                    <span className="font-medium text-gray-800 text-xs">{formatDate(batchInfo.productionDate, lang)}</span>
                  </div>
                )}
                {batchInfo.expiryDate && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-gray-500 text-xs">{lang === "de" ? "Ablaufdatum" : "Expiry Date"}</span>
                    <span className={`font-medium text-xs ${
                      new Date(batchInfo.expiryDate) < new Date()
                        ? "text-red-600"
                        : new Date(batchInfo.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                        ? "text-amber-600"
                        : "text-gray-800"
                    }`}>
                      {formatDate(batchInfo.expiryDate, lang)}
                      {new Date(batchInfo.expiryDate) < new Date() && (
                        <span className="ml-2 rounded bg-red-100 text-red-700 px-1.5 py-0.5">
                          {lang === "de" ? "Abgelaufen" : "Expired"}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Importer ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
          <div className="p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t.importedBy}</p>
            <div className="flex items-center gap-3">
              {product.tenant?.logoUrl ? (
                <img
                  src={product.tenant.logoUrl}
                  alt={importerName}
                  className="h-12 w-auto max-w-[140px] object-contain rounded-lg"
                />
              ) : (
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white text-lg font-bold shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {importerName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-bold text-gray-900">{importerName}</p>
                {((product.tenant as any)?.websiteUrl ?? product.tenant?.slug) && (
                  <a
                    href={(product.tenant as any)?.websiteUrl ?? `https://swiss-product-seal.ch/${product.tenant?.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-0.5 transition-colors"
                  >
                    <ExternalLink size={10} />
                    {(product.tenant as any)?.websiteUrl
                      ? (product.tenant as any).websiteUrl.replace(/^https?:\/\//, "")
                      : `swiss-product-seal.ch/${product.tenant?.slug}`}
                  </a>
                )}
              </div>
            </div>

            {/* Contact */}
            {product.tenant?.contactEmail && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">{t.contactDesc}</p>
                <a href={`mailto:${product.tenant.contactEmail}`}>
                  <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
                    <Mail size={13} />
                    {t.sendEmail}
                  </Button>
                </a>
              </div>
            )}
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="text-center space-y-3 pt-2 pb-8">
          <Separator />
          <Link href="/about-seal" className="inline-flex items-center gap-1 text-sm font-medium hover:underline" style={{ color: primaryColor }}>
            <Info size={14} />
            {t.learnMore}
            <ChevronRight size={14} />
          </Link>
          <p className="text-xs text-gray-400">
            {t.poweredBy}{" "}
            <a href="https://swiss-product-seal.ch" className="hover:underline text-gray-500">
              swiss-product-seal.ch
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
