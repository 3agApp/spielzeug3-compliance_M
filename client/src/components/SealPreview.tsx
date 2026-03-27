import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type SealStatus = "verified" | "in_progress" | "not_verified";

// CDN-Fallback-URLs (PNG, korrekte Content-Type)
const DEFAULT_SEAL_IMAGES: Record<SealStatus, string> = {
  verified:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-verified_75b748c3.png",
  in_progress:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-in-progress_65b28caf.png",
  not_verified:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-not-verified_119c8334.png",
};

const STATUS_CONFIG: Record<SealStatus, { label: string; borderColor: string; accentColor: string }> = {
  verified: { label: "VERIFIED", borderColor: "#16a34a", accentColor: "#16a34a" },
  in_progress: { label: "IN PRÜFUNG", borderColor: "#d97706", accentColor: "#d97706" },
  not_verified: { label: "NICHT VERIFIZIERT", borderColor: "#9ca3af", accentColor: "#6b7280" },
};

interface SealPreviewProps {
  tenantName?: string;
  tenantUrl?: string;
  tenantId?: number;
  productId?: number;
  qrCodeUrl?: string;
}

export function SealPreview({
  tenantName = "Spielzeug 3 AG",
  tenantUrl = "swiss-product-seal.ch",
  tenantId = 1,
  productId,
  qrCodeUrl,
}: SealPreviewProps) {
  const [status, setStatus] = useState<SealStatus>("verified");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = STATUS_CONFIG[status];

  // Load active seal URLs (custom upload or CDN default)
  const { data: activeSealUrls } = trpc.sealAssets.getActive.useQuery();
  const sealImages: Record<SealStatus, string> = activeSealUrls ?? DEFAULT_SEAL_IMAGES;

  async function handleDownload() {
    setDownloading(true);
    try {
      const productParam = productId ? `&productId=${productId}` : "";
      const url = `/api/reports/seal-label?status=${status}&tenantId=${tenantId}${productParam}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `Swiss-Product-Seal_${status.replace(/_/g, "-")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success("PDF heruntergeladen", { description: "Das Etikett wurde als PDF exportiert." });
    } catch (err: any) {
      toast.error("Download fehlgeschlagen", { description: err.message ?? "Unbekannter Fehler" });
    } finally {
      setDownloading(false);
    }
  }

  function getEmbedCode() {
    const publicUrl = `${window.location.origin}/product/${productId ?? "PRODUCT_ID"}`;
    const sealImgUrl = sealImages[status];
    const qrSrc = qrCodeUrl ?? "";
    return `<!-- Swiss Product Seal Widget -->
<div style="display:inline-block;font-family:'Helvetica Neue',Arial,sans-serif;text-align:center;width:180px;border:2px solid ${cfg.borderColor};border-radius:14px;padding:16px 14px 14px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <img src="${sealImgUrl}" alt="Swiss Product Seal – ${cfg.label}" width="120" height="132" style="display:block;margin:0 auto 10px;" />
${qrSrc ? `  <img src="${qrSrc}" alt="QR-Code" width="100" height="100" style="display:block;margin:0 auto 6px;border-radius:6px;" />` : ""}
  <p style="font-size:9px;color:#9ca3af;margin:0 0 8px;">Scan for compliance info</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 8px;" />
  <p style="font-size:8px;color:#9ca3af;font-style:italic;margin:0 0 2px;">Imported by</p>
  <p style="font-size:11px;font-weight:700;color:#111;margin:0 0 2px;">${tenantName}</p>
  <a href="https://${tenantUrl}" target="_blank" rel="noopener noreferrer" style="font-size:9px;color:${cfg.accentColor};font-weight:600;text-decoration:none;">${tenantUrl}</a>
</div>
<!-- End Swiss Product Seal Widget -->`;
  }

  function handleCopyEmbed() {
    navigator.clipboard.writeText(getEmbedCode()).then(() => {
      setCopied(true);
      toast.success("HTML-Code kopiert", {
        description: "Fügen Sie den Code in Ihre Webseite, WooCommerce oder Shopify ein.",
      });
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(["verified", "in_progress", "not_verified"] as SealStatus[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
              className="text-xs h-8"
            >
              {s === "verified" ? "✓ Verified" : s === "in_progress" ? "⟳ In Prüfung" : "✕ Nicht verifiziert"}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          disabled={downloading}
          className="gap-1.5 text-xs h-8"
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {downloading ? "Generiere…" : "PDF herunterladen"}
        </Button>
      </div>

      {/* ── Preview + Embed side-by-side ────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* ── Seal Card ───────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 flex-shrink-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vorschau Etikett</p>

          {/* The actual seal label */}
          <div
            style={{
              width: 200,
              background: "#ffffff",
              border: `2px solid ${cfg.borderColor}`,
              borderRadius: 16,
              padding: "20px 16px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}
          >
            {/* Seal graphic – CDN PNG (or custom uploaded) */}
            <img
              src={sealImages[status]}
              alt={`Swiss Product Seal – ${cfg.label}`}
              width={130}
              height={143}
              style={{ display: "block", marginBottom: 14 }}
            />

            {/* QR code area */}
            <div
              style={{
                width: 112,
                height: 112,
                background: "#f9fafb",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 6,
                overflow: "hidden",
              }}
            >
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  style={{ width: 104, height: 104, objectFit: "contain" }}
                />
              ) : (
                /* Clean placeholder – no logo overlay */
                <svg width="88" height="88" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Top-left finder */}
                  <rect x="4" y="4" width="22" height="22" rx="2.5" fill="none" stroke="#1f2937" strokeWidth="3" />
                  <rect x="9" y="9" width="12" height="12" rx="1" fill="#1f2937" />
                  {/* Top-right finder */}
                  <rect x="62" y="4" width="22" height="22" rx="2.5" fill="none" stroke="#1f2937" strokeWidth="3" />
                  <rect x="67" y="9" width="12" height="12" rx="1" fill="#1f2937" />
                  {/* Bottom-left finder */}
                  <rect x="4" y="62" width="22" height="22" rx="2.5" fill="none" stroke="#1f2937" strokeWidth="3" />
                  <rect x="9" y="67" width="12" height="12" rx="1" fill="#1f2937" />
                  {/* Data dots */}
                  <rect x="30" y="4" width="4" height="4" fill="#1f2937" />
                  <rect x="36" y="4" width="4" height="4" fill="#1f2937" />
                  <rect x="30" y="10" width="4" height="4" fill="#1f2937" />
                  <rect x="36" y="16" width="4" height="4" fill="#1f2937" />
                  <rect x="4" y="30" width="4" height="4" fill="#1f2937" />
                  <rect x="10" y="36" width="4" height="4" fill="#1f2937" />
                  <rect x="4" y="36" width="4" height="4" fill="#1f2937" />
                  <rect x="30" y="30" width="4" height="4" fill="#1f2937" />
                  <rect x="36" y="30" width="4" height="4" fill="#1f2937" />
                  <rect x="42" y="30" width="4" height="4" fill="#1f2937" />
                  <rect x="30" y="36" width="4" height="4" fill="#1f2937" />
                  <rect x="42" y="36" width="4" height="4" fill="#1f2937" />
                  <rect x="30" y="42" width="4" height="4" fill="#1f2937" />
                  <rect x="36" y="42" width="4" height="4" fill="#1f2937" />
                  <rect x="42" y="42" width="4" height="4" fill="#1f2937" />
                  <rect x="62" y="30" width="4" height="4" fill="#1f2937" />
                  <rect x="68" y="30" width="4" height="4" fill="#1f2937" />
                  <rect x="62" y="36" width="4" height="4" fill="#1f2937" />
                  <rect x="74" y="36" width="4" height="4" fill="#1f2937" />
                  <rect x="30" y="62" width="4" height="4" fill="#1f2937" />
                  <rect x="36" y="62" width="4" height="4" fill="#1f2937" />
                  <rect x="30" y="68" width="4" height="4" fill="#1f2937" />
                  <rect x="42" y="68" width="4" height="4" fill="#1f2937" />
                  <rect x="30" y="74" width="4" height="4" fill="#1f2937" />
                  <rect x="36" y="80" width="4" height="4" fill="#1f2937" />
                  <rect x="48" y="48" width="4" height="4" fill="#1f2937" />
                  <rect x="54" y="54" width="4" height="4" fill="#1f2937" />
                  <rect x="60" y="48" width="4" height="4" fill="#1f2937" />
                  <rect x="48" y="60" width="4" height="4" fill="#1f2937" />
                  <rect x="60" y="60" width="4" height="4" fill="#1f2937" />
                  <rect x="66" y="48" width="4" height="4" fill="#1f2937" />
                  <rect x="72" y="54" width="4" height="4" fill="#1f2937" />
                  <rect x="66" y="60" width="4" height="4" fill="#1f2937" />
                  <rect x="48" y="66" width="4" height="4" fill="#1f2937" />
                  <rect x="54" y="72" width="4" height="4" fill="#1f2937" />
                  <rect x="60" y="66" width="4" height="4" fill="#1f2937" />
                  <rect x="72" y="66" width="4" height="4" fill="#1f2937" />
                  <rect x="66" y="72" width="4" height="4" fill="#1f2937" />
                  <rect x="72" y="78" width="4" height="4" fill="#1f2937" />
                  <rect x="78" y="72" width="4" height="4" fill="#1f2937" />
                </svg>
              )}
            </div>

            {/* Scan hint */}
            <p style={{ fontSize: 9, color: "#9ca3af", margin: "0 0 10px", textAlign: "center" }}>
              Scan for compliance info
            </p>

            {/* Divider */}
            <div style={{ width: "100%", height: 1, background: "#e5e7eb", marginBottom: 10 }} />

            {/* Imported by */}
            <p style={{ fontSize: 8, color: "#9ca3af", fontStyle: "italic", margin: "0 0 3px", textAlign: "center" }}>
              Imported by
            </p>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#111827", margin: "0 0 2px", textAlign: "center" }}>
              {tenantName}
            </p>
            <p style={{ fontSize: 9, color: cfg.accentColor, fontWeight: 600, margin: 0, textAlign: "center" }}>
              {tenantUrl}
            </p>
          </div>

          <p className="text-[10px] text-muted-foreground text-center max-w-[200px]">
            QR-Code wird pro Produkt generiert · PDF A6-Format
          </p>
        </div>

        {/* ── HTML Embed Widget ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">HTML-Einbettungscode</p>

          <div className="rounded-lg border bg-muted/40 p-4 space-y-4">
            <p className="text-sm text-foreground">
              Kopieren Sie diesen Code und fügen Sie ihn in Ihre Webseite, Ihren WooCommerce-Shop oder Shopify-Store ein.
              Das Siegel-Badge wird automatisch mit dem aktuellen Status angezeigt.
            </p>

            {/* Code block */}
            <div className="relative">
              <pre
                className="text-[10px] leading-relaxed bg-background border rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all"
                style={{ fontFamily: "monospace", maxHeight: 200 }}
              >
                {getEmbedCode()}
              </pre>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyEmbed}
                className="absolute top-2 right-2 gap-1.5 text-xs h-7"
              >
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                {copied ? "Kopiert!" : "Kopieren"}
              </Button>
            </div>

            {/* Platform instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold mb-1">🛒 WooCommerce</p>
                <p className="text-[11px] text-muted-foreground">
                  Produkt bearbeiten → Tab „Beschreibung" oder „Kurzbeschreibung" → HTML-Ansicht → Code einfügen.
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold mb-1">🛍 Shopify</p>
                <p className="text-[11px] text-muted-foreground">
                  Online Store → Themes → Edit code → Produkttemplate → Code im gewünschten Abschnitt einfügen.
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold mb-1">🌐 Webseite</p>
                <p className="text-[11px] text-muted-foreground">
                  Code direkt in den HTML-Quelltext der Produktseite einfügen – kein JavaScript nötig.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
