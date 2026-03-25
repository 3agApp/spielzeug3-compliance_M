import { useState } from "react";
import { Button } from "@/components/ui/button";

type SealStatus = "verified" | "in_progress" | "not_verified";

const STATUS_CONFIG: Record<
  SealStatus,
  {
    label: string;
    bannerBg: string;
    bannerText: string;
    shieldStroke: string;
    shieldFill: string;
    checkColor: string;
    borderColor: string;
    urlColor: string;
  }
> = {
  verified: {
    label: "VERIFIED",
    bannerBg: "#2d7a3a",
    bannerText: "#ffffff",
    shieldStroke: "#c8102e",
    shieldFill: "rgba(200,16,46,0.06)",
    checkColor: "#c8102e",
    borderColor: "#c8102e",
    urlColor: "#c8102e",
  },
  in_progress: {
    label: "IN PROGRESS",
    bannerBg: "#d97706",
    bannerText: "#ffffff",
    shieldStroke: "#d97706",
    shieldFill: "rgba(217,119,6,0.06)",
    checkColor: "#d97706",
    borderColor: "#d97706",
    urlColor: "#d97706",
  },
  not_verified: {
    label: "NOT VERIFIED",
    bannerBg: "#6b7280",
    bannerText: "#ffffff",
    shieldStroke: "#9ca3af",
    shieldFill: "rgba(107,114,128,0.06)",
    checkColor: "#9ca3af",
    borderColor: "#9ca3af",
    urlColor: "#9ca3af",
  },
};

interface SealPreviewProps {
  tenantName?: string;
  tenantUrl?: string;
}

export function SealPreview({
  tenantName = "Spielzeug 3 AG",
  tenantUrl = "swiss-product-seal.ch",
}: SealPreviewProps) {
  const [status, setStatus] = useState<SealStatus>("verified");
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="space-y-5">
      {/* Status-Umschalter */}
      <div className="flex gap-2 flex-wrap">
        {(["verified", "in_progress", "not_verified"] as SealStatus[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
            className="text-xs"
          >
            {s === "verified" ? "✓ Verified" : s === "in_progress" ? "⟳ In Progress" : "✕ Not Verified"}
          </Button>
        ))}
      </div>

      {/* Etikett-Vorschau */}
      <div className="flex justify-center">
        <div
          style={{
            width: 240,
            background: "#ffffff",
            border: `2.5px solid ${cfg.borderColor}`,
            borderRadius: 18,
            padding: "24px 20px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
          }}
        >
          {/* ===== SCHILD ===== */}
          <div style={{ marginBottom: 16, position: "relative" }}>
            <svg
              width="130"
              height="128"
              viewBox="0 0 130 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Äusserer Schild */}
              <path
                d="M65 6 L116 28 L116 68 C116 95 93 114 65 122 C37 114 14 95 14 68 L14 28 Z"
                fill={cfg.shieldFill}
                stroke={cfg.shieldStroke}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              {/* Innerer Schild-Rand (dünner, heller) */}
              <path
                d="M65 14 L108 33 L108 68 C108 91 87 108 65 116 C43 108 22 91 22 68 L22 33 Z"
                fill="none"
                stroke={cfg.shieldStroke}
                strokeWidth="1.2"
                opacity="0.35"
                strokeLinejoin="round"
              />
              {/* Grosses Häkchen */}
              <path
                d="M42 66 L57 81 L88 50"
                stroke={cfg.checkColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* "SWISS PRODUCT SEAL" Text */}
              <text
                x="65"
                y="104"
                textAnchor="middle"
                fontSize="7.5"
                fontWeight="700"
                fill="#444"
                letterSpacing="1.2"
                style={{ fontFamily: "Arial, sans-serif" }}
              >
                SWISS PRODUCT SEAL
              </text>
            </svg>

            {/* Status-Banner – überlappt den unteren Schild-Rand */}
            <div
              style={{
                position: "absolute",
                bottom: -2,
                left: "50%",
                transform: "translateX(-50%)",
                background: cfg.bannerBg,
                color: cfg.bannerText,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 2,
                padding: "4px 18px",
                borderRadius: 20,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              }}
            >
              {cfg.label}
            </div>
          </div>

          {/* Abstand nach Banner */}
          <div style={{ height: 14 }} />

          {/* ===== QR-CODE PLATZHALTER ===== */}
          <div
            style={{
              width: 130,
              height: 130,
              background: "#f3f4f6",
              border: "1.5px solid #e5e7eb",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
              {/* Eck-Finder oben links */}
              <rect x="6" y="6" width="26" height="26" rx="3" fill="none" stroke="#111" strokeWidth="3.5" />
              <rect x="11" y="11" width="16" height="16" rx="1.5" fill="#111" />
              {/* Eck-Finder oben rechts */}
              <rect x="78" y="6" width="26" height="26" rx="3" fill="none" stroke="#111" strokeWidth="3.5" />
              <rect x="83" y="11" width="16" height="16" rx="1.5" fill="#111" />
              {/* Eck-Finder unten links */}
              <rect x="6" y="78" width="26" height="26" rx="3" fill="none" stroke="#111" strokeWidth="3.5" />
              <rect x="11" y="83" width="16" height="16" rx="1.5" fill="#111" />

              {/* Datenpunkte – simuliertes QR-Muster */}
              {/* Reihe 1 */}
              <rect x="38" y="6" width="4" height="4" fill="#111" />
              <rect x="44" y="6" width="4" height="4" fill="#111" />
              <rect x="54" y="6" width="4" height="4" fill="#111" />
              <rect x="64" y="6" width="4" height="4" fill="#111" />
              <rect x="70" y="6" width="4" height="4" fill="#111" />
              {/* Reihe 2 */}
              <rect x="38" y="12" width="4" height="4" fill="#111" />
              <rect x="50" y="12" width="4" height="4" fill="#111" />
              <rect x="60" y="12" width="4" height="4" fill="#111" />
              <rect x="70" y="12" width="4" height="4" fill="#111" />
              {/* Reihe 3 */}
              <rect x="44" y="18" width="4" height="4" fill="#111" />
              <rect x="54" y="18" width="4" height="4" fill="#111" />
              <rect x="64" y="18" width="4" height="4" fill="#111" />
              {/* Reihe 4 */}
              <rect x="38" y="24" width="4" height="4" fill="#111" />
              <rect x="50" y="24" width="4" height="4" fill="#111" />
              <rect x="60" y="24" width="4" height="4" fill="#111" />
              <rect x="70" y="24" width="4" height="4" fill="#111" />
              {/* Reihe 5 */}
              <rect x="44" y="30" width="4" height="4" fill="#111" />
              <rect x="54" y="30" width="4" height="4" fill="#111" />
              <rect x="64" y="30" width="4" height="4" fill="#111" />
              {/* Linke Spalte (Timing) */}
              <rect x="6" y="38" width="4" height="4" fill="#111" />
              <rect x="6" y="48" width="4" height="4" fill="#111" />
              <rect x="6" y="58" width="4" height="4" fill="#111" />
              <rect x="6" y="68" width="4" height="4" fill="#111" />
              {/* Obere Zeile (Timing) */}
              <rect x="38" y="38" width="4" height="4" fill="#111" />
              <rect x="48" y="38" width="4" height="4" fill="#111" />
              <rect x="58" y="38" width="4" height="4" fill="#111" />
              <rect x="68" y="38" width="4" height="4" fill="#111" />
              <rect x="78" y="38" width="4" height="4" fill="#111" />
              <rect x="88" y="38" width="4" height="4" fill="#111" />
              <rect x="100" y="38" width="4" height="4" fill="#111" />
              {/* Datenpunkte rechts */}
              <rect x="100" y="44" width="4" height="4" fill="#111" />
              <rect x="88" y="44" width="4" height="4" fill="#111" />
              <rect x="78" y="50" width="4" height="4" fill="#111" />
              <rect x="100" y="50" width="4" height="4" fill="#111" />
              <rect x="88" y="56" width="4" height="4" fill="#111" />
              <rect x="78" y="62" width="4" height="4" fill="#111" />
              <rect x="100" y="62" width="4" height="4" fill="#111" />
              <rect x="88" y="68" width="4" height="4" fill="#111" />
              {/* Datenpunkte unten rechts */}
              <rect x="78" y="78" width="4" height="4" fill="#111" />
              <rect x="88" y="78" width="4" height="4" fill="#111" />
              <rect x="100" y="78" width="4" height="4" fill="#111" />
              <rect x="78" y="88" width="4" height="4" fill="#111" />
              <rect x="100" y="88" width="4" height="4" fill="#111" />
              <rect x="88" y="94" width="4" height="4" fill="#111" />
              <rect x="78" y="100" width="4" height="4" fill="#111" />
              <rect x="100" y="100" width="4" height="4" fill="#111" />
              {/* Datenpunkte unten mitte */}
              <rect x="38" y="78" width="4" height="4" fill="#111" />
              <rect x="48" y="78" width="4" height="4" fill="#111" />
              <rect x="58" y="78" width="4" height="4" fill="#111" />
              <rect x="68" y="78" width="4" height="4" fill="#111" />
              <rect x="38" y="88" width="4" height="4" fill="#111" />
              <rect x="58" y="88" width="4" height="4" fill="#111" />
              <rect x="48" y="94" width="4" height="4" fill="#111" />
              <rect x="68" y="94" width="4" height="4" fill="#111" />
              <rect x="38" y="100" width="4" height="4" fill="#111" />
              <rect x="58" y="100" width="4" height="4" fill="#111" />
              {/* Datenpunkte mitte */}
              <rect x="38" y="44" width="4" height="4" fill="#111" />
              <rect x="48" y="50" width="4" height="4" fill="#111" />
              <rect x="58" y="44" width="4" height="4" fill="#111" />
              <rect x="68" y="50" width="4" height="4" fill="#111" />
              <rect x="38" y="56" width="4" height="4" fill="#111" />
              <rect x="58" y="56" width="4" height="4" fill="#111" />
              <rect x="48" y="62" width="4" height="4" fill="#111" />
              <rect x="68" y="62" width="4" height="4" fill="#111" />
              <rect x="38" y="68" width="4" height="4" fill="#111" />
              <rect x="58" y="68" width="4" height="4" fill="#111" />

              {/* Weisser Kreis für Logo-Overlay */}
              <circle cx="55" cy="55" r="14" fill="white" />

              {/* Kleines Schild-Icon in der Mitte */}
              <path
                d="M55 43 L64 47 L64 54 C64 60 60 65 55 67 C50 65 46 60 46 54 L46 47 Z"
                fill={cfg.checkColor}
              />
              {/* Häkchen im Schild */}
              <path
                d="M50 54 L53.5 57.5 L60 51"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* "Scan for compliance info" */}
          <p
            style={{
              fontSize: 10,
              color: "#9ca3af",
              marginBottom: 12,
              textAlign: "center",
              letterSpacing: 0.2,
            }}
          >
            Scan for compliance info
          </p>

          {/* Trennlinie */}
          <div style={{ width: "100%", height: 1, background: "#e5e7eb", marginBottom: 12 }} />

          {/* Imported by */}
          <div style={{ textAlign: "center", lineHeight: 1.5 }}>
            <p
              style={{
                fontSize: 9,
                color: "#9ca3af",
                fontStyle: "italic",
                margin: 0,
                letterSpacing: 0.3,
              }}
            >
              Imported by
            </p>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#111",
                margin: "3px 0 2px",
                letterSpacing: 0.1,
              }}
            >
              {tenantName}
            </p>
            <p
              style={{
                fontSize: 10,
                color: cfg.urlColor,
                fontWeight: 600,
                margin: 0,
                letterSpacing: 0.2,
              }}
            >
              {tenantUrl}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Vorschau des Etiketts · QR-Code wird pro Produkt individuell generiert
      </p>
    </div>
  );
}
