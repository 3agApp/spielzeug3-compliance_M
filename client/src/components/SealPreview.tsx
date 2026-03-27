import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type SealStatus = "verified" | "in_progress" | "not_verified";

const STATUS_CONFIG: Record<
  SealStatus,
  {
    label: string;
    labelDe: string;
    bannerBg: string;
    accentColor: string;
    checkColor: string;
    badgeBg: string;
  }
> = {
  verified: {
    label: "VERIFIED",
    labelDe: "Verifiziert",
    bannerBg: "#1a7a3a",
    accentColor: "#c8102e",
    checkColor: "#c8102e",
    badgeBg: "#e8f5ec",
  },
  in_progress: {
    label: "IN PROGRESS",
    labelDe: "In Bearbeitung",
    bannerBg: "#b45309",
    accentColor: "#d97706",
    checkColor: "#d97706",
    badgeBg: "#fef3c7",
  },
  not_verified: {
    label: "NOT VERIFIED",
    labelDe: "Nicht verifiziert",
    bannerBg: "#4b5563",
    accentColor: "#9ca3af",
    checkColor: "#9ca3af",
    badgeBg: "#f3f4f6",
  },
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
    return `<!-- Swiss Product Seal Widget -->
<div id="swiss-product-seal" style="display:inline-block;font-family:Arial,sans-serif;text-align:center;width:160px;border:2px solid ${cfg.accentColor};border-radius:12px;padding:16px 12px 12px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <svg width="72" height="72" viewBox="0 0 130 128" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M65 6 L116 28 L116 68 C116 95 93 114 65 122 C37 114 14 95 14 68 L14 28 Z" fill="rgba(200,16,46,0.06)" stroke="${cfg.accentColor}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M42 66 L57 81 L88 50" stroke="${cfg.checkColor}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <div style="background:${cfg.bannerBg};color:#fff;font-size:9px;font-weight:800;letter-spacing:2px;padding:3px 12px;border-radius:20px;margin:6px auto 10px;display:inline-block;">${cfg.label}</div>
  <div style="font-size:9px;color:#6b7280;margin-bottom:4px;">Swiss Product Seal</div>
  <a href="${publicUrl}" target="_blank" rel="noopener" style="display:block;font-size:10px;font-weight:700;color:${cfg.accentColor};text-decoration:none;margin-bottom:8px;">${tenantName}</a>
  <div style="font-size:8px;color:#9ca3af;">${tenantUrl}</div>
</div>
<!-- End Swiss Product Seal Widget -->`;
  }

  function handleCopyEmbed() {
    navigator.clipboard.writeText(getEmbedCode()).then(() => {
      setCopied(true);
      toast.success("HTML-Code kopiert", { description: "Fügen Sie den Code in Ihre Webseite, WooCommerce oder Shopify ein." });
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
              {s === "verified" ? "✓ Verified" : s === "in_progress" ? "⟳ In Progress" : "✕ Not Verified"}
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
              border: `2px solid ${cfg.accentColor}`,
              borderRadius: 16,
              padding: "20px 16px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              gap: 0,
            }}
          >
            {/* Shield */}
            <svg
              width="100"
              height="96"
              viewBox="0 0 130 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: "block", marginBottom: 8 }}
            >
              {/* Outer shield */}
              <path
                d="M65 6 L116 28 L116 68 C116 95 93 114 65 122 C37 114 14 95 14 68 L14 28 Z"
                fill={cfg.badgeBg}
                stroke={cfg.accentColor}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              {/* Inner shield ring */}
              <path
                d="M65 14 L108 33 L108 68 C108 91 87 108 65 116 C43 108 22 91 22 68 L22 33 Z"
                fill="none"
                stroke={cfg.accentColor}
                strokeWidth="1"
                opacity="0.3"
                strokeLinejoin="round"
              />
              {/* Checkmark */}
              <path
                d="M42 66 L57 81 L88 50"
                stroke={cfg.checkColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* "SWISS PRODUCT SEAL" label */}
              <text
                x="65"
                y="107"
                textAnchor="middle"
                fontSize="7"
                fontWeight="700"
                fill="#555"
                letterSpacing="1.2"
                style={{ fontFamily: "Arial, sans-serif" }}
              >
                SWISS PRODUCT SEAL
              </text>
            </svg>

            {/* Status banner */}
            <div
              style={{
                background: cfg.bannerBg,
                color: "#ffffff",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 2,
                padding: "4px 16px",
                borderRadius: 20,
                whiteSpace: "nowrap",
                marginBottom: 14,
              }}
            >
              {cfg.label}
            </div>

            {/* QR code area */}
            <div
              style={{
                width: 108,
                height: 108,
                background: "#f9fafb",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code" style={{ width: 100, height: 100, objectFit: "contain" }} />
              ) : (
                /* Placeholder QR pattern */
                <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                  {/* Top-left finder */}
                  <rect x="4" y="4" width="22" height="22" rx="2.5" fill="none" stroke="#111" strokeWidth="3" />
                  <rect x="9" y="9" width="12" height="12" rx="1" fill="#111" />
                  {/* Top-right finder */}
                  <rect x="64" y="4" width="22" height="22" rx="2.5" fill="none" stroke="#111" strokeWidth="3" />
                  <rect x="69" y="9" width="12" height="12" rx="1" fill="#111" />
                  {/* Bottom-left finder */}
                  <rect x="4" y="64" width="22" height="22" rx="2.5" fill="none" stroke="#111" strokeWidth="3" />
                  <rect x="9" y="69" width="12" height="12" rx="1" fill="#111" />
                  {/* Data dots – centre area */}
                  {[32,38,44,50,56].map(x => [32,38,44,50,56].map(y =>
                    (x + y) % 8 === 0 ? <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" fill="#111" /> : null
                  ))}
                  {/* Logo circle */}
                  <circle cx="45" cy="45" r="10" fill="white" />
                  <path
                    d="M45 36 L52 39.5 L52 45 C52 49.5 49 53 45 54.5 C41 53 38 49.5 38 45 L38 39.5 Z"
                    fill={cfg.accentColor}
                  />
                  <path d="M41 45 L43.5 47.5 L49 42" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            {/* Scan hint */}
            <p style={{ fontSize: 9, color: "#9ca3af", margin: "0 0 10px", textAlign: "center", letterSpacing: 0.2 }}>
              Scan for compliance info
            </p>

            {/* Divider */}
            <div style={{ width: "100%", height: 1, background: "#e5e7eb", marginBottom: 10 }} />

            {/* Imported by */}
            <p style={{ fontSize: 8, color: "#9ca3af", fontStyle: "italic", margin: "0 0 3px", letterSpacing: 0.3, textAlign: "center" }}>
              Imported by
            </p>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: 0.1, textAlign: "center" }}>
              {tenantName}
            </p>
            <p style={{ fontSize: 9, color: cfg.accentColor, fontWeight: 600, margin: 0, letterSpacing: 0.2, textAlign: "center" }}>
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
