import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { SealBadge } from "@/components/SealBadge";
import type { SealStatus } from "@/components/SealBadge";
import { ShieldCheck, ShieldAlert, ShieldOff, Package, Calendar, Globe, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Seal-verified QR label image (uploaded CDN asset)
const SEAL_VERIFIED_IMG = "https://cdn.manus.im/seal_verified.png";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-CH", { year: "numeric", month: "long", day: "numeric" });
}

export default function PublicProductPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = params.uuid ?? "";

  const { data: product, isLoading, error } = trpc.tenant.getPublicProduct.useQuery(
    { uuid },
    { enabled: !!uuid, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#C8102E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Produktinformationen werden geladen…</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <ShieldOff size={56} className="text-gray-300 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-800">Produkt nicht gefunden</h1>
          <p className="text-gray-500">
            Dieser QR-Code ist ungültig oder das Produkt wurde entfernt.
            Bitte wenden Sie sich an den Importeur.
          </p>
          <a
            href="https://swiss-product-seal.ch"
            className="inline-block mt-2 text-[#C8102E] text-sm font-medium hover:underline"
          >
            swiss-product-seal.ch
          </a>
        </div>
      </div>
    );
  }

  const sealStatus = (product.sealStatus ?? "not_verified") as SealStatus;

  const statusInfo = {
    verified: {
      icon: ShieldCheck,
      color: "text-[#2E7D32]",
      bg: "bg-green-50 border-green-200",
      title: "Produkt verifiziert",
      description: "Dieses Produkt erfüllt alle Schweizer Compliance-Anforderungen und wurde vollständig geprüft.",
    },
    in_progress: {
      icon: ShieldAlert,
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-200",
      title: "Prüfung läuft",
      description: "Die Compliance-Prüfung dieses Produkts ist noch nicht abgeschlossen.",
    },
    not_verified: {
      icon: ShieldOff,
      color: "text-gray-500",
      bg: "bg-gray-50 border-gray-200",
      title: "Nicht verifiziert",
      description: "Für dieses Produkt liegt noch keine abgeschlossene Compliance-Prüfung vor.",
    },
  }[sealStatus];

  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#C8102E] rounded flex items-center justify-center">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-wide">SWISS PRODUCT SEAL</span>
          </div>
          <a
            href="https://swiss-product-seal.ch"
            className="text-xs text-gray-400 hover:text-[#C8102E] transition-colors"
          >
            swiss-product-seal.ch
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Product hero */}
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 h-48 flex items-center justify-center relative">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.productName}
                className="h-full w-full object-contain p-4"
              />
            ) : (
              <Package size={64} className="text-gray-300" />
            )}
            {/* Seal badge overlay */}
            <div className="absolute top-3 right-3">
              <SealBadge status={sealStatus} size="sm" />
            </div>
          </div>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{product.productName}</h1>
                {product.brand && (
                  <p className="text-sm text-gray-500 mt-0.5">{product.brand}</p>
                )}
                {product.ean && (
                  <p className="text-xs text-gray-400 mt-1 font-mono">EAN: {product.ean}</p>
                )}
              </div>
              <SealBadge status={sealStatus} size="md" className="shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Status card */}
        <Card className={`border ${statusInfo.bg} shadow-sm`}>
          <CardContent className="p-5 flex items-start gap-4">
            <StatusIcon size={32} className={`shrink-0 mt-0.5 ${statusInfo.color}`} />
            <div>
              <h2 className="font-bold text-gray-900">{statusInfo.title}</h2>
              <p className="text-sm text-gray-600 mt-1">{statusInfo.description}</p>
              {sealStatus === "verified" && product.approvedAt && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <CheckCircle2 size={12} className="text-[#2E7D32]" />
                  Verifiziert am {formatDate(product.approvedAt)}
                </div>
              )}
              {sealStatus === "in_progress" && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <Clock size={12} className="text-amber-500" />
                  Compliance-Score: {Math.round(product.completenessScore ?? 0)}%
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Importer info */}
        {product.tenant && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Importiert von
              </h3>
              <div className="flex items-center gap-3">
                {product.tenant.logoUrl ? (
                  <img src={product.tenant.logoUrl} alt={product.tenant.name} className="h-10 w-auto object-contain" />
                ) : (
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: product.tenant.primaryColor ?? "#C8102E" }}
                  >
                    {product.tenant.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{product.tenant.name}</p>
                  <a
                    href="https://swiss-product-seal.ch"
                    className="text-xs text-[#C8102E] hover:underline flex items-center gap-1"
                  >
                    <Globe size={10} />
                    swiss-product-seal.ch
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* What is the Swiss Product Seal */}
        <Card className="border-0 shadow-sm bg-[#C8102E] text-white">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck size={28} className="shrink-0 mt-0.5 text-white/80" />
              <div>
                <h3 className="font-bold text-white">Was ist das Swiss Product Seal?</h3>
                <p className="text-sm text-white/80 mt-1 leading-relaxed">
                  Das Swiss Product Seal bestätigt, dass ein Produkt alle relevanten Schweizer
                  Compliance-Anforderungen erfüllt – von Sicherheitsdokumenten bis hin zu
                  Produktkennzeichnungen. Importeure nutzen die Plattform, um Dokumente zu
                  verwalten und Transparenz für Konsumenten zu schaffen.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-4">
          <Separator className="mb-4" />
          <p className="text-xs text-gray-400">
            Powered by{" "}
            <a href="https://swiss-product-seal.ch" className="text-[#C8102E] font-medium hover:underline">
              Swiss Product Seal Platform
            </a>
          </p>
          <p className="text-xs text-gray-300 mt-1">swiss-product-seal.ch</p>
        </div>
      </main>
    </div>
  );
}
