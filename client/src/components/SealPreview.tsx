import { useState } from "react";
import { Button } from "@/components/ui/button";

type SealStatus = "verified" | "in_progress" | "not_verified";

const STATUS_CONFIG: Record<
  SealStatus,
  { label: string; color: string; bg: string; badgeBg: string; badgeText: string; icon: string }
> = {
  verified: {
    label: "VERIFIED",
    color: "#c8102e",
    bg: "#f8f8f8",
    badgeBg: "#2d7a3a",
    badgeText: "#ffffff",
    icon: "✓",
  },
  in_progress: {
    label: "IN PROGRESS",
    color: "#c8102e",
    bg: "#f8f8f8",
    badgeBg: "#d97706",
    badgeText: "#ffffff",
    icon: "⟳",
  },
  not_verified: {
    label: "NOT VERIFIED",
    color: "#c8102e",
    bg: "#f8f8f8",
    badgeBg: "#6b7280",
    badgeText: "#ffffff",
    icon: "✕",
  },
};

interface SealPreviewProps {
  tenantName?: string;
  tenantUrl?: string;
}

export function SealPreview({ tenantName = "Spielzeug 3 AG", tenantUrl = "swiss-product-seal.ch" }: SealPreviewProps) {
  const [status, setStatus] = useState<SealStatus>("verified");
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="space-y-4">
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

      {/* Label-Vorschau */}
      <div className="flex justify-center">
        <div
          className="relative rounded-xl shadow-lg overflow-hidden"
          style={{
            width: 220,
            background: "#ffffff",
            border: `2.5px solid ${cfg.color}`,
            borderRadius: 16,
            padding: "20px 18px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          {/* Schild */}
          <div style={{ marginBottom: 14 }}>
            <svg width="110" height="100" viewBox="0 0 110 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Schild-Hintergrund */}
              <path
                d="M55 4 L98 22 L98 55 C98 76 78 92 55 98 C32 92 12 76 12 55 L12 22 Z"
                fill={cfg.bg}
                stroke={cfg.color}
                strokeWidth="3.5"
              />
              {/* Innerer Schild-Rand */}
              <path
                d="M55 11 L91 26 L91 55 C91 73 74 87 55 93 C36 87 19 73 19 55 L19 26 Z"
                fill="white"
                stroke={cfg.color}
                strokeWidth="1.5"
                opacity="0.4"
              />
              {/* Status-Icon */}
              <text
                x="55"
                y="52"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="28"
                fontWeight="bold"
                fill={cfg.color}
                style={{ fontFamily: "sans-serif" }}
              >
                {cfg.icon}
              </text>
              {/* "SWISS PRODUCT SEAL" Text */}
              <text
                x="55"
                y="70"
                textAnchor="middle"
                fontSize="7"
                fontWeight="700"
                fill="#333"
                letterSpacing="1"
                style={{ fontFamily: "sans-serif" }}
              >
                SWISS PRODUCT SEAL
              </text>
              {/* Status-Badge */}
              <rect x="18" y="78" width="74" height="16" rx="4" fill={cfg.badgeBg} />
              <text
                x="55"
                y="87"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="8"
                fontWeight="800"
                fill={cfg.badgeText}
                letterSpacing="1.5"
                style={{ fontFamily: "sans-serif" }}
              >
                {cfg.label}
              </text>
            </svg>
          </div>

          {/* QR-Code Platzhalter */}
          <div
            style={{
              width: 110,
              height: 110,
              background: "#f3f4f6",
              border: "1.5px solid #e5e7eb",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* QR-Muster-Simulation */}
            <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
              {/* Eck-Quadrate */}
              <rect x="5" y="5" width="22" height="22" rx="3" fill="none" stroke="#111" strokeWidth="3" />
              <rect x="9" y="9" width="14" height="14" rx="1" fill="#111" />
              <rect x="63" y="5" width="22" height="22" rx="3" fill="none" stroke="#111" strokeWidth="3" />
              <rect x="67" y="9" width="14" height="14" rx="1" fill="#111" />
              <rect x="5" y="63" width="22" height="22" rx="3" fill="none" stroke="#111" strokeWidth="3" />
              <rect x="9" y="67" width="14" height="14" rx="1" fill="#111" />
              {/* Datenpunkte simuliert */}
              {[32,36,40,44,48,52,56,60].map((x) =>
                [5,9,13,17,21,25,29,33,37,41,45,49,53,57,61,65,69,73,77,81].map((y) =>
                  Math.sin(x * y * 0.1) > 0.2 ? (
                    <rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" fill="#111" />
                  ) : null
                )
              )}
              {/* Schild-Icon in der Mitte */}
              <path
                d="M45 36 L54 40 L54 46 C54 51 50 55 45 57 C40 55 36 51 36 46 L36 40 Z"
                fill={cfg.color}
              />
              <text x="45" y="49" textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="white" fontWeight="bold">
                ✓
              </text>
            </svg>
          </div>

          {/* "Scan for compliance info" */}
          <p style={{ fontSize: 9, color: "#6b7280", marginBottom: 10, textAlign: "center" }}>
            Scan for compliance info
          </p>

          {/* Trennlinie */}
          <div style={{ width: "100%", height: 1, background: "#e5e7eb", marginBottom: 10 }} />

          {/* Imported by */}
          <div style={{ textAlign: "center", lineHeight: 1.4 }}>
            <p style={{ fontSize: 8, color: "#9ca3af", fontStyle: "italic", margin: 0 }}>Imported by</p>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#111", margin: "2px 0" }}>{tenantName}</p>
            <p style={{ fontSize: 9, color: cfg.color, fontWeight: 600, margin: 0 }}>{tenantUrl}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Vorschau des Etiketts auf einer Produktverpackung · QR-Code wird pro Produkt generiert
      </p>
    </div>
  );
}
