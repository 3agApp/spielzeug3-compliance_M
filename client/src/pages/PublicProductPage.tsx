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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    docType_test_report: "Prüfbericht",
    docType_declaration_of_conformity: "Konformitätserklärung",
    docType_manual: "Bedienungsanleitung",
    docType_certificate: "Zertifikat",
    docType_product_image: "Produktbild",
    docType_safety_image: "Sicherheitsbild",
    docType_regulatory_document: "Regulatorisches Dokument",
    docType_other: "Sonstiges Dokument",
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
    docType_test_report: "Test Report",
    docType_declaration_of_conformity: "Declaration of Conformity",
    docType_manual: "Manual",
    docType_certificate: "Certificate",
    docType_product_image: "Product Image",
    docType_safety_image: "Safety Image",
    docType_regulatory_document: "Regulatory Document",
    docType_other: "Other Document",
  },
};

function formatDate(d: Date | string | null | undefined, lang: Lang): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString(lang === "de" ? "de-CH" : "en-GB", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PublicProductPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = params.uuid ?? "";

  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("sps_lang") as Lang) ?? "de"; } catch { return "de"; }
  });
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#C8102E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
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
    verified:     { icon: ShieldCheck, color: "text-[#2E7D32]", bg: "bg-green-50 border-green-200", bannerBg: "bg-green-600" },
    in_progress:  { icon: ShieldAlert, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", bannerBg: "bg-amber-500" },
    not_verified: { icon: ShieldOff,   color: "text-gray-500",  bg: "bg-gray-50 border-gray-200",   bannerBg: "bg-gray-400" },
  }[sealStatus];
  const StatusIcon = statusConfig.icon;

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="font-semibold text-gray-800 text-sm">Swiss Product Seal</span>
          </div>
          <button
            onClick={() => setLang(lang === "de" ? "en" : "de")}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 transition-colors"
          >
            <Globe size={12} />
            {lang === "de" ? "EN" : "DE"}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Hero: Seal Badge + Status */}
        <div className={`rounded-2xl border-2 overflow-hidden ${statusConfig.bg}`}>
          {/* Colored top bar */}
          <div className={`${statusConfig.bannerBg} h-1.5 w-full`} />
          <div className="p-6 text-center space-y-4">
            <div className="flex justify-center">
              <SealBadge status={sealStatus} size="lg" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${statusConfig.color}`}>
                {t[`sealTitle_${sealStatus}` as keyof typeof t]}
              </h1>
              <p className="text-gray-600 text-sm mt-1 max-w-sm mx-auto">
                {t[`sealDesc_${sealStatus}` as keyof typeof t]}
              </p>
            </div>
            {sealStatus === "verified" && product.approvedAt && (
              <div className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-100 rounded-full px-3 py-1">
                <CheckCircle2 size={13} />
                <span>{t.approvedOn}: {formatDate(product.approvedAt, lang)}</span>
              </div>
            )}
            {sealStatus === "in_progress" && (
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 rounded-full px-3 py-1">
                <Clock size={13} />
                <span>{Math.round(product.completenessScore ?? 0)}% {t.completeness}</span>
              </div>
            )}
          </div>
        </div>

        {/* Trust Indicators */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BadgeCheck size={16} className="text-[#C8102E]" />
              {t.trustIndicators}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    item.met ? "bg-green-100" : "bg-gray-100"
                  }`}>
                    <Icon size={12} className={item.met ? "text-green-600" : "text-gray-400"} />
                  </div>
                  <p className={`text-sm ${item.met ? "text-gray-800" : "text-gray-500"}`}>
                    {lang === "de" ? item.labelDe : item.labelEn}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Supplier Declaration */}
        {supplierConfirmedAt && (
          <Card className="border-green-200 bg-green-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck size={16} className="text-green-600" />
                {t.supplierDeclaration}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm space-y-0.5">
                  <p className="font-medium text-green-800">{t.supplierConfirmed}</p>
                  <p className="text-green-700 text-xs">
                    {t.supplierConfirmedBy} <strong>{supplierConfirmedBy}</strong>{" "}
                    {t.supplierConfirmedOn} {formatDate(supplierConfirmedAt, lang)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents Overview */}
        {docSummary.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={16} className="text-gray-400" />
                {t.documents}
                <span className="ml-auto text-xs font-normal text-gray-500">
                  {approvedDocs}/{totalDocs} {t.docsApproved}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">{t.documentsDesc}</p>
              {docSummary.map((doc) => {
                const docLabel = t[`docType_${doc.type}` as keyof typeof t] ?? doc.type;
                const allApproved = doc.approved === doc.total && doc.total > 0;
                const hasRejected = doc.rejected > 0;
                return (
                  <div key={doc.type} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {allApproved ? (
                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                      ) : hasRejected ? (
                        <XCircle size={14} className="text-red-400 flex-shrink-0" />
                      ) : (
                        <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
                      )}
                      <span className="text-sm text-gray-700">{docLabel}</span>
                      {doc.total > 1 && (
                        <span className="text-xs text-gray-400">({doc.total})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {doc.approved > 0 && (
                        <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50 py-0">
                          {doc.approved} {t.docsApproved}
                        </Badge>
                      )}
                      {doc.pending > 0 && (
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50 py-0">
                          {doc.pending} {t.docsPending}
                        </Badge>
                      )}
                      {doc.rejected > 0 && (
                        <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50 py-0">
                          {doc.rejected} {t.docsRejected}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Product Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package size={16} className="text-gray-400" />
              {t.productInfo}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {product.imageUrl && (
              <div className="h-40 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                <img src={product.imageUrl} alt={product.productName} className="h-full w-full object-contain p-2" />
              </div>
            )}
            <h2 className="text-lg font-semibold text-gray-900">{product.productName}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {product.brand && (
                <div>
                  <span className="text-gray-500 flex items-center gap-1 text-xs"><Tag size={11} /> {t.brand}</span>
                  <span className="font-medium text-gray-800">{product.brand}</span>
                </div>
              )}
              {product.ean && (
                <div>
                  <span className="text-gray-500 flex items-center gap-1 text-xs"><Barcode size={11} /> {t.ean}</span>
                  <span className="font-medium text-gray-800 font-mono text-xs">{product.ean}</span>
                </div>
              )}
              {product.internalArticleNumber && (
                <div>
                  <span className="text-gray-500 flex items-center gap-1 text-xs"><Hash size={11} /> {t.articleNumber}</span>
                  <span className="font-medium text-gray-800 font-mono text-xs">{product.internalArticleNumber}</span>
                </div>
              )}
              {product.sealEnabledAt && (
                <div>
                  <span className="text-gray-500 flex items-center gap-1 text-xs"><Calendar size={11} /> {t.verifiedSince}</span>
                  <span className="font-medium text-gray-800 text-xs">{formatDate(product.sealEnabledAt, lang)}</span>
                </div>
              )}
            </div>
            {product.completenessScore > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{t.completeness}</span>
                  <span>{Math.round(product.completenessScore)}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, product.completenessScore)}%`,
                      backgroundColor: product.completenessScore >= 100 ? "#2E7D32" : product.completenessScore >= 50 ? "#F59E0B" : "#9CA3AF",
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Safety Information */}
        {safety && (safety.safetyText || safety.warningText || safety.ageGrading || safety.materialInformation) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                {t.safetyInfo}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {safety.ageGrading && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs shrink-0">{t.ageGrading}</Badge>
                  <span className="text-gray-700">{safety.ageGrading}</span>
                </div>
              )}
              {safety.warningText && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">{t.warningText}</p>
                  <p className="text-amber-700 text-xs">{safety.warningText}</p>
                </div>
              )}
              {safety.safetyText && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t.safetyText}</p>
                  <p className="text-gray-700">{safety.safetyText}</p>
                </div>
              )}
              {safety.materialInformation && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t.materialInfo}</p>
                  <p className="text-gray-700">{safety.materialInformation}</p>
                </div>
              )}
              {safety.usageRestrictions && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t.usageRestrictions}</p>
                  <p className="text-gray-700">{safety.usageRestrictions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Batch / Traceability */}
        {batchInfo && (batchInfo.batchNumber || batchInfo.productionDate || batchInfo.expiryDate) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers size={16} className="text-gray-400" />
                {t.batchInfo}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {batchInfo.batchNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{lang === "de" ? "Chargennummer" : "Batch Number"}</span>
                  <span className="font-medium text-gray-800 font-mono text-xs">{batchInfo.batchNumber}</span>
                </div>
              )}
              {batchInfo.productionDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{lang === "de" ? "Produktionsdatum" : "Production Date"}</span>
                  <span className="font-medium text-gray-800">{formatDate(batchInfo.productionDate, lang)}</span>
                </div>
              )}
              {batchInfo.expiryDate && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">{lang === "de" ? "Ablaufdatum" : "Expiry Date"}</span>
                  <span className={`font-medium ${
                    new Date(batchInfo.expiryDate) < new Date()
                      ? "text-red-600"
                      : new Date(batchInfo.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                      ? "text-amber-600"
                      : "text-gray-800"
                  }`}>
                    {formatDate(batchInfo.expiryDate, lang)}
                    {new Date(batchInfo.expiryDate) < new Date() && (
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        {lang === "de" ? "Abgelaufen" : "Expired"}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Importer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe size={16} className="text-gray-400" />
              {t.importedBy}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {product.tenant?.logoUrl ? (
                <img src={product.tenant.logoUrl} alt={importerName} className="h-10 w-auto object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: primaryColor }}>
                  {importerName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{importerName}</p>
                {product.tenant?.slug && (
                  <p className="text-xs text-gray-500">swiss-product-seal.ch/{product.tenant.slug}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        {product.tenant?.contactEmail && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail size={16} className="text-gray-400" />
                {t.contact}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">{t.contactDesc}</p>
              <a href={`mailto:${product.tenant.contactEmail}`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Mail size={14} />
                  {t.sendEmail}
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center space-y-3 pt-2 pb-6">
          <Separator />
          <Link href="/about-seal" className="inline-flex items-center gap-1 text-sm text-[#C8102E] hover:underline font-medium">
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
