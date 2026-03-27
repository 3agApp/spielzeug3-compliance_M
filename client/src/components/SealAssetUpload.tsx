/**
 * SealAssetUpload.tsx
 * Admin-UI to upload custom seal graphics per status.
 * Shows current graphic, allows upload of PNG/SVG, and reset to default.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, RotateCcw, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type SealStatus = "verified" | "in_progress" | "not_verified";

const STATUS_META: Record<SealStatus, { label: string; icon: React.ReactNode; color: string }> = {
  verified: {
    label: "Verifiziert",
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    color: "border-green-200 bg-green-50",
  },
  in_progress: {
    label: "In Prüfung",
    icon: <Clock className="h-4 w-4 text-amber-600" />,
    color: "border-amber-200 bg-amber-50",
  },
  not_verified: {
    label: "Nicht verifiziert",
    icon: <XCircle className="h-4 w-4 text-gray-500" />,
    color: "border-gray-200 bg-gray-50",
  },
};

function SealStatusCard({ status, currentUrl }: { status: SealStatus; currentUrl: string }) {
  const meta = STATUS_META[status];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const utils = trpc.useUtils();

  const uploadMutation = trpc.sealAssets.upload.useMutation({
    onSuccess: (data) => {
      toast.success("Siegel-Grafik aktualisiert", {
        description: `Die Grafik für "${meta.label}" wurde erfolgreich hochgeladen.`,
      });
      utils.sealAssets.getActive.invalidate();
    },
    onError: (err) => {
      toast.error("Upload fehlgeschlagen", { description: err.message });
    },
  });

  const resetMutation = trpc.sealAssets.resetToDefault.useMutation({
    onSuccess: () => {
      toast.success("Standard-Grafik wiederhergestellt", {
        description: `Die Grafik für "${meta.label}" wurde auf den Standard zurückgesetzt.`,
      });
      utils.sealAssets.getActive.invalidate();
    },
    onError: (err) => {
      toast.error("Zurücksetzen fehlgeschlagen", { description: err.message });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Ungültiges Dateiformat", { description: "Erlaubt: PNG, JPG, SVG, WebP" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Datei zu groß", { description: "Maximale Dateigröße: 5 MB" });
      return;
    }

    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data URL prefix
        };
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
    try {
      await resetMutation.mutateAsync({ status });
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card className={`border-2 ${meta.color}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {meta.icon}
          {meta.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current graphic preview */}
        <div className="flex justify-center">
          <div className="relative w-[120px] h-[132px] rounded-lg overflow-hidden border border-border bg-white shadow-sm flex items-center justify-center">
            <img
              src={currentUrl}
              alt={`Siegel – ${meta.label}`}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = "0.3";
              }}
            />
          </div>
        </div>

        {/* Upload button */}
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
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? "Wird hochgeladen…" : "Neue Grafik hochladen"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 text-muted-foreground"
            disabled={resetting}
            onClick={handleReset}
          >
            {resetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            {resetting ? "Wird zurückgesetzt…" : "Standard wiederherstellen"}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          PNG, JPG, SVG oder WebP · max. 5 MB
        </p>
      </CardContent>
    </Card>
  );
}

export function SealAssetUpload() {
  const { data: activeUrls, isLoading } = trpc.sealAssets.getActive.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const urls = activeUrls ?? {
    verified:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-verified_75b748c3.png",
    in_progress:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-in-progress_65b28caf.png",
    not_verified:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-not-verified_119c8334.png",
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Siegel-Grafiken</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Laden Sie für jeden Prüfstatus eine eigene Siegel-Grafik hoch. Die Grafik wird in der
          Etikett-Vorschau, im PDF-Export und im Einbettungscode verwendet. Ohne eigene Grafik
          wird die Standard-Grafik angezeigt.
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
