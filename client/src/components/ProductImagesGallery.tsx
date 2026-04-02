/**
 * ProductImagesGallery
 * Displays product images in a gallery layout with upload, delete, and reorder support.
 * Used in the ProductDetail page (internal "Bilder"-tab).
 */
import { useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Image,
  Loader2,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  X,
} from "lucide-react";

interface ProductImagesGalleryProps {
  productId: number;
  readOnly?: boolean;
}

const MAX_IMAGES = 10;
const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function ProductImagesGallery({ productId, readOnly = false }: ProductImagesGalleryProps) {
  const { t, lang } = useLang();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: images = [], isLoading } = trpc.productImages.list.useQuery({ productId });

  const uploadMutation = trpc.productImages.upload.useMutation({
    onSuccess: () => {
      utils.productImages.list.invalidate({ productId });
      toast.success((t.productImages as any)?.uploadSuccess ?? "Bild erfolgreich hochgeladen.");
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  const deleteMutation = trpc.productImages.delete.useMutation({
    onSuccess: () => {
      utils.productImages.list.invalidate({ productId });
      toast.success((t.productImages as any)?.deleteSuccess ?? "Bild gelöscht.");
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  const reorderMutation = trpc.productImages.reorder.useMutation({
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error((t.productImages as any)?.maxReached ?? `Maximal ${MAX_IMAGES} Bilder erlaubt.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    for (const file of toUpload) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error((t.productImages as any)?.invalidType ?? "Nur JPEG, PNG, WebP oder GIF erlaubt.");
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error((t.productImages as any)?.tooLarge ?? `Datei zu groß. Max. ${MAX_FILE_SIZE_MB} MB.`);
        continue;
      }
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Strip data URL prefix
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await uploadMutation.mutateAsync({
        productId,
        fileBase64: base64,
        mimeType: file.type,
        originalName: file.name,
        fileSizeBytes: file.size,
      });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [images.length, productId, uploadMutation, t]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleMoveLeft = (index: number) => {
    if (index === 0) return;
    const newOrder = images.map(img => img.id);
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate({ productId, orderedIds: newOrder }, {
      onSuccess: () => utils.productImages.list.invalidate({ productId }),
    });
  };

  const handleMoveRight = (index: number) => {
    if (index === images.length - 1) return;
    const newOrder = images.map(img => img.id);
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate({ productId, orderedIds: newOrder }, {
      onSuccess: () => utils.productImages.list.invalidate({ productId }),
    });
  };

  const titleKey = (t.productImages as any)?.title ?? "Produktbilder";
  const uploadLabel = (t.productImages as any)?.upload ?? "Bilder hochladen";
  const emptyLabel = (t.productImages as any)?.empty ?? "Noch keine Bilder vorhanden.";
  const primaryLabel = (t.productImages as any)?.primary ?? "Hauptbild";
  const deleteLabel = (t.productImages as any)?.delete ?? "Löschen";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="h-4 w-4 text-primary" />
            {titleKey}
            {images.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({images.length}/{MAX_IMAGES})
              </span>
            )}
          </CardTitle>
          {!readOnly && images.length < MAX_IMAGES && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploadLabel}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {(t as any).msg?.loading ?? "Lädt..."}
          </div>
        ) : images.length === 0 ? (
          /* Drop zone when empty */
          <div
            onDrop={!readOnly ? handleDrop : undefined}
            onDragOver={!readOnly ? handleDragOver : undefined}
            onClick={!readOnly ? () => fileInputRef.current?.click() : undefined}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              !readOnly
                ? "border-muted-foreground/30 hover:border-primary/50 cursor-pointer"
                : "border-muted-foreground/20"
            }`}
          >
            <Image className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            {!readOnly && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                {(t.productImages as any)?.dropHint ?? "Klicken oder Dateien hierher ziehen (JPEG, PNG, WebP · max. 5 MB)"}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {images.map((img, index) => (
                <div key={img.id} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
                  <img
                    src={img.url}
                    alt={img.originalName ?? `Produktbild ${index + 1}`}
                    className="w-full h-full object-cover cursor-zoom-in"
                    onClick={() => setLightboxIndex(index)}
                  />
                  {/* Primary badge */}
                  {index === 0 && (
                    <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      {primaryLabel}
                    </span>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => setLightboxIndex(index)}
                      className="p-1.5 bg-white/90 rounded-full text-gray-800 hover:bg-white transition-colors"
                      title={lang === "de" ? "Vergrößern" : "Zoom in"}
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    {!readOnly && (
                      <>
                        {index > 0 && (
                          <button
                            onClick={() => handleMoveLeft(index)}
                            className="p-1.5 bg-white/90 rounded-full text-gray-800 hover:bg-white transition-colors"
                            title="Nach links"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {index < images.length - 1 && (
                          <button
                            onClick={() => handleMoveRight(index)}
                            className="p-1.5 bg-white/90 rounded-full text-gray-800 hover:bg-white transition-colors"
                            title="Nach rechts"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm((t.productImages as any)?.confirmDelete ?? "Bild wirklich löschen?")) {
                              deleteMutation.mutate({ imageId: img.id });
                            }
                          }}
                          className="p-1.5 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition-colors"
                          title={deleteLabel}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {/* Upload tile (when images exist and not at max) */}
              {!readOnly && images.length < MAX_IMAGES && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 transition-colors text-muted-foreground hover:text-primary"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6" />
                      <span className="text-xs text-center px-1">
                        {(t.productImages as any)?.addMore ?? "Hinzufügen"}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {(t.productImages as any)?.hint ?? "Das erste Bild wird als Hauptbild verwendet. Reihenfolge per Pfeil-Buttons ändern."}
            </p>
          </div>
        )}
      </CardContent>

      {/* Lightbox */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="h-8 w-8" />
          </button>
          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 text-white hover:text-gray-300 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
            >
              <ChevronLeft className="h-10 w-10" />
            </button>
          )}
          <img
            src={images[lightboxIndex].url}
            alt={images[lightboxIndex].originalName ?? "Produktbild"}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxIndex < images.length - 1 && (
            <button
              className="absolute right-4 text-white hover:text-gray-300 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
            >
              <ChevronRight className="h-10 w-10" />
            </button>
          )}
          <div className="absolute bottom-4 text-white text-sm">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </Card>
  );
}
