/**
 * SealAssetUpload.tsx
 * Admin-UI to upload custom seal graphics per status.
 * Shows current graphic, allows upload of PNG/SVG/JPG/WebP, and reset to default.
 *
 * Client-side validation:
 *  - Allowed MIME types: PNG, JPEG, SVG, WebP
 *  - Max file size: 5 MB
 *  - Min resolution: 300 × 300 px  (SVGs are skipped – they are vector)
 *  - Aspect ratio: width/height must be between 0.75 and 1.25
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, Loader2, Upload, RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";

type SealStatus = "verified" | "in_progress" | "not_verified";

// ─── Validation constants ─────────────────────────────────────────────────────
const MIN_WIDTH = 300;
const MIN_HEIGHT = 300;
const MIN_RATIO = 0.75;   // width / height
const MAX_RATIO = 1.25;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] as const;

interface ValidationError {
  title: string;
  description: string;
}

/**
 * Validate an image file before upload.
 * Returns null if valid, or a ValidationError object.
 * SVG files skip the pixel-dimension check (they are resolution-independent).
 */
async function validateImageFile(file: File, lang: string, t: any): Promise<ValidationError | null> {
  // 1. MIME type
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return {
      title: t.inline.ungueltiges_dateiformat,
      description: lang === "de"
        ? `Erlaubt: PNG, JPG, SVG, WebP. Hochgeladen: ${file.type || "unbekannt"}`
        : `Allowed: PNG, JPG, SVG, WebP. Uploaded: ${file.type || "unknown"}`,
    };
  }

  // 2. File size
  if (file.size > MAX_SIZE_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    return {
      title: t.inline.datei_zu_gross,
      description: lang === "de"
        ? `Maximale Dateigröße: 5 MB. Ihre Datei: ${sizeMb} MB`
        : `Maximum file size: 5 MB. Your file: ${sizeMb} MB`,
    };
  }

  // 3. SVG: skip pixel checks (vector graphics have no fixed resolution)
  if (file.type === "image/svg+xml") return null;

  // 4. Load image to check pixel dimensions & aspect ratio
  const dimensionError = await new Promise<ValidationError | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;

      if (w < MIN_WIDTH || h < MIN_HEIGHT) {
        resolve({
          title: t.inline.aufloesung_zu_gering,
          description: lang === "de"
            ? `Mindestauflösung: ${MIN_WIDTH}×${MIN_HEIGHT} px. Ihre Grafik: ${w}×${h} px`
            : `Minimum resolution: ${MIN_WIDTH}×${MIN_HEIGHT} px. Your graphic: ${w}×${h} px`,
        });
        return;
      }

      const ratio = w / h;
      if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
        const pct = (ratio * 100).toFixed(0);
        resolve({
          title: t.inline.falsches_seitenverhaeltnis,
          description: lang === "de"
            ? `Das Siegel benötigt ein annähernd quadratisches Format (Verhältnis 0.75–1.25). Ihre Grafik hat ${w}×${h} px (Verhältnis ${pct}%). Bitte schneiden Sie die Grafik entsprechend zu.`
            : `The seal requires an approximately square format (ratio 0.75–1.25). Your graphic is ${w}×${h} px (ratio ${pct}%). Please crop the graphic accordingly.`,
        });
        return;
      }

      resolve(null);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        title: t.inline.bild_konnte_nicht_gelesen_werden,
        description: t.inline.die_datei_scheint_beschaedigt_oder_kein_gueltiges_bild_zu_sein,
      });
    };

    img.src = url;
  });

  return dimensionError;
}

// ─── Status metadata ──────────────────────────────────────────────────────────
function useStatusMeta(): Record<SealStatus, { label: string; icon: React.ReactNode; color: string }> {
  const { lang, t } = useLang();
  return {
  verified: {
    label: t.inline.verifiziert,
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    color: "border-green-200 bg-green-50",
  },
  in_progress: {
    label: t.inline.in_pruefung,
    icon: <Clock className="h-4 w-4 text-amber-600" />,
    color: "border-amber-200 bg-amber-50",
  },
  not_verified: {
    label: t.inline.nicht_verifiziert,
    icon: <XCircle className="h-4 w-4 text-gray-500" />,
    color: "border-gray-200 bg-gray-50",
  },
  };
}

// ─── Single status card ───────────────────────────────────────────────────────
function SealStatusCard({ status, currentUrl }: { status: SealStatus; currentUrl: string }) {
  const { lang, t } = useLang();
  const STATUS_META = useStatusMeta();
  const meta = STATUS_META[status];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [validationErr, setValidationErr] = useState<ValidationError | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const uploadMutation = trpc.sealAssets.upload.useMutation({
    onSuccess: () => {
      toast.success(t.inline.siegelgrafik_aktualisiert, {
        description: lang === "de"
          ? `Die Grafik für „${meta.label}“ wurde erfolgreich hochgeladen.`
          : `The graphic for "${meta.label}" was uploaded successfully.`,
      });
      setPreviewUrl(null);
      utils.sealAssets.getActive.invalidate();
    },
    onError: (err) => {
      toast.error(t.inline.upload_fehlgeschlagen, { description: translateError(err.message, lang) });
    },
  });

  const resetMutation = trpc.sealAssets.resetToDefault.useMutation({
    onSuccess: () => {
      toast.success(t.inline.standardgrafik_wiederhergestellt, {
        description: lang === "de"
          ? `Die Grafik für „${meta.label}“ wurde auf den Standard zurückgesetzt.`
          : `The graphic for "${meta.label}" has been reset to the default.`,
      });
      setPreviewUrl(null);
      utils.sealAssets.getActive.invalidate();
    },
    onError: (err) => {
      toast.error(t.inline.zuruecksetzen_fehlgeschlagen, { description: translateError(err.message, lang) });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous validation error
    setValidationErr(null);

    // ── Client-side validation ────────────────────────────────────────────────
    const err = await validateImageFile(file, lang, t);
    if (err) {
      setValidationErr(err);
      toast.error(err.title, { description: err.description });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Show local preview immediately after validation passes
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await uploadMutation.mutateAsync({
        status,
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type as any,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleReset() {
    setResetting(true);
    setValidationErr(null);
    try {
      await resetMutation.mutateAsync({ status });
    } finally {
      setResetting(false);
    }
  }

  const displayUrl = previewUrl ?? currentUrl;

  return (
    <Card className={`border-2 ${meta.color}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {meta.icon}
          {meta.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current / preview graphic */}
        <div className="flex justify-center">
          <div className="relative w-[120px] h-[132px] rounded-lg overflow-hidden border border-border bg-white shadow-sm flex items-center justify-center">
            <img
              src={displayUrl}
              alt={`Siegel – ${meta.label}`}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = "0.3";
              }}
            />
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Inline validation error */}
        {validationErr && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">{validationErr.title}</p>
              <p className="mt-0.5 text-destructive/80">{validationErr.description}</p>
            </div>
          </div>
        )}

        {/* Upload / Reset buttons */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            variant="default"
            className="w-full gap-2"
            disabled={uploading || resetting}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? (t.inline.wird_hochgeladen) : (t.inline.neue_grafik_hochladen)}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 text-muted-foreground"
            disabled={resetting || uploading}
            onClick={handleReset}
          >
            {resetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            {resetting ? (t.inline.wird_zurueckgesetzt) : (t.inline.standard_wiederherstellen)}
          </Button>
        </div>

        {/* Requirements hint */}
        <div className="rounded-md bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
          <p className="font-medium text-foreground/70">{t.inline.anforderungen}</p>
          <p>{t.inline.format_png_jpg_svg_oder_webp_max_5_mb}</p>
          <p>{t.inline.mindestaufloesung_300_300_px_ausser_svg}</p>
          <p>{t.inline.seitenverhaeltnis_annaehernd_quadratisch_075_125}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main export ───────────────────────────────────────────────────────
export function SealAssetUpload() {
  const { lang, t } = useLang();
  const { data: activeUrls, isLoading } = trpc.sealAssets.getActive.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const DEFAULT_URLS = {
    verified:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-verified_75b748c3.png",
    in_progress:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-in-progress_65b28caf.png",
    not_verified:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-not-verified_119c8334.png",
  };
  const urls = activeUrls ?? DEFAULT_URLS;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{t.inline.siegelgrafiken}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {lang === "de"
            ? "Laden Sie für jeden Prüfstatus eine eigene Siegel-Grafik hoch. Die Grafik wird in der Etikett-Vorschau, im PDF-Export und im Einbettungscode verwendet. Ohne eigene Grafik wird die Standard-Grafik angezeigt."
            : "Upload a custom seal graphic for each verification status. The graphic is used in the label preview, PDF export, and embed code. Without a custom graphic, the default graphic is displayed."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(["verified", "in_progress", "not_verified"] as SealStatus[]).map((status) => (
          <SealStatusCard key={status} status={status} currentUrl={urls[status]} />
        ))}
      </div>
    </div>
  );
}
