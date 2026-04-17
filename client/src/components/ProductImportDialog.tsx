/**
 * ProductImportDialog
 * Three-step dialog: Upload → Preview → Confirm
 *
 * Step 1: Drag-and-drop or click to upload CSV/XLSX
 * Step 2: Preview detected column mapping + first rows
 * Step 3: Confirm import options (update existing, default brand)
 */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, X,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  supplierId: number;
  supplierName?: string;
  open: boolean;
  onClose: () => void;
  onImported?: (created: number, updated: number) => void;
}

type Step = "upload" | "preview" | "confirm" | "done";

const UI = {
  de: {
    title: "Produkte importieren",
    step1Title: "Datei hochladen",
    step1Desc: "CSV oder Excel-Datei (XLSX) mit Produktdaten hochladen",
    dropHere: "Datei hier ablegen oder klicken",
    dropFormats: "CSV, XLS, XLSX – max. 20 MB",
    step2Title: "Vorschau",
    colMapping: "Erkannte Spalten",
    rowsFound: "Zeilen gefunden",
    validRows: "Gültige Zeilen",
    skipped: "Übersprungen",
    warnings: "Hinweise",
    step3Title: "Import bestätigen",
    updateExisting: "Bestehende Produkte aktualisieren (gleiche interne Artnr.)",
    defaultBrand: "Standard-Marke (falls nicht in Datei)",
    defaultBrandPlaceholder: "z.B. Tigermedia",
    importBtn: "Importieren",
    cancelBtn: "Abbrechen",
    backBtn: "Zurück",
    nextBtn: "Weiter",
    doneTitle: "Import abgeschlossen",
    created: "Erstellt",
    updated: "Aktualisiert",
    skippedResult: "Übersprungen",
    errors: "Fehler",
    closeBtn: "Schliessen",
    uploading: "Wird hochgeladen…",
    importing: "Wird importiert…",
    noFile: "Bitte zuerst eine Datei auswählen.",
    uploadError: "Upload fehlgeschlagen",
    importError: "Import fehlgeschlagen",
    previewCols: ["Interne Artnr.", "Hersteller-Artnr.", "Produktname", "EAN", "Marke", "Kontor-ID", "Ursprungsland"],
  },
  en: {
    title: "Import Products",
    step1Title: "Upload File",
    step1Desc: "Upload a CSV or Excel (XLSX) file with product data",
    dropHere: "Drop file here or click to browse",
    dropFormats: "CSV, XLS, XLSX – max. 20 MB",
    step2Title: "Preview",
    colMapping: "Detected Columns",
    rowsFound: "Rows found",
    validRows: "Valid rows",
    skipped: "Skipped",
    warnings: "Warnings",
    step3Title: "Confirm Import",
    updateExisting: "Update existing products (same internal article no.)",
    defaultBrand: "Default brand (if not in file)",
    defaultBrandPlaceholder: "e.g. Tigermedia",
    importBtn: "Import",
    cancelBtn: "Cancel",
    backBtn: "Back",
    nextBtn: "Next",
    doneTitle: "Import Complete",
    created: "Created",
    updated: "Updated",
    skippedResult: "Skipped",
    errors: "Errors",
    closeBtn: "Close",
    uploading: "Uploading…",
    importing: "Importing…",
    noFile: "Please select a file first.",
    uploadError: "Upload failed",
    importError: "Import failed",
    previewCols: ["Internal Art. No.", "Supplier Art. No.", "Product Name", "EAN", "Brand", "Kontor ID", "Country of Origin"],
  },
};

export function ProductImportDialog({ supplierId, supplierName, open, onClose, onImported }: Props) {
  const { lang } = useLang();
  const t = UI[lang as "de" | "en"] ?? UI.de;

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [defaultBrand, setDefaultBrand] = useState("");
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: { row: number; reason: string }[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewQuery = trpc.productImport.preview.useQuery(
    { uploadId: uploadId ?? "" },
    { enabled: !!uploadId && step === "preview" }
  );

  const commitMutation = trpc.productImport.commit.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      setStep("done");
      onImported?.(result.created, result.updated);
    },
    onError: (err) => {
      toast.error(`${t.importError}: ${err.message}`);
    },
  });

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/import/products/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Upload failed");
      }
      const data = await res.json();
      setUploadId(data.uploadId);
      setStep("preview");
    } catch (err: any) {
      toast.error(`${t.uploadError}: ${err?.message ?? "Unknown"}`);
    } finally {
      setUploading(false);
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleCommit = () => {
    if (!uploadId) return;
    commitMutation.mutate({
      uploadId,
      supplierId,
      updateExisting,
      defaultBrand: defaultBrand.trim() || undefined,
    });
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setUploadId(null);
    setImportResult(null);
    setUpdateExisting(false);
    setDefaultBrand("");
    onClose();
  };

  const preview = previewQuery.data;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t.title}
            {supplierName && (
              <span className="text-muted-foreground font-normal text-sm">– {supplierName}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t.step1Desc}</p>
            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span>{t.uploading}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span className="font-medium text-foreground">{t.dropHere}</span>
                  <span className="text-xs">{t.dropFormats}</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
            {file && !uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span>{file.name}</span>
                <button onClick={() => { setFile(null); setUploadId(null); }} className="ml-auto">
                  <X className="h-4 w-4 hover:text-destructive" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4 py-2">
            <h3 className="font-semibold text-sm">{t.step2Title}</h3>

            {previewQuery.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
              </div>
            )}

            {preview && (
              <>
                {/* Stats */}
                <div className="flex gap-3 flex-wrap">
                  <Badge variant="outline">{t.rowsFound}: {preview.totalRows}</Badge>
                  <Badge variant="default">{t.validRows}: {preview.validRows}</Badge>
                  {preview.skippedRows > 0 && (
                    <Badge variant="secondary">{t.skipped}: {preview.skippedRows}</Badge>
                  )}
                </div>

                {/* Column mapping */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t.colMapping}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(preview.columnMapping).map(([col, field]) => (
                      <Badge key={col} variant="outline" className="text-xs">
                        <span className="text-muted-foreground">{col}</span>
                        <span className="mx-1">→</span>
                        <span className="text-primary font-medium">{field}</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Warnings */}
                {preview.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Preview table */}
                <div className="rounded-md border overflow-x-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {t.previewCols.map((col) => (
                          <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.slice(0, 20).map((row) => (
                        <TableRow key={row.rowIndex}>
                          <TableCell className="text-xs font-mono">{row.internalArticleNumber ?? "–"}</TableCell>
                          <TableCell className="text-xs font-mono">{row.supplierArticleNumber ?? "–"}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{row.productName ?? "–"}</TableCell>
                          <TableCell className="text-xs font-mono">{row.ean ?? "–"}</TableCell>
                          <TableCell className="text-xs">{row.brand ?? "–"}</TableCell>
                          <TableCell className="text-xs font-mono">{row.kontorId ?? "–"}</TableCell>
                          <TableCell className="text-xs">{row.countryOfOrigin ?? "–"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {preview.rows.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center">
                    … {preview.rows.length - 20} more rows
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === "confirm" && (
          <div className="space-y-5 py-2">
            <h3 className="font-semibold text-sm">{t.step3Title}</h3>
            <div className="flex items-center gap-3">
              <Checkbox
                id="updateExisting"
                checked={updateExisting}
                onCheckedChange={(v) => setUpdateExisting(!!v)}
              />
              <Label htmlFor="updateExisting" className="text-sm cursor-pointer">
                {t.updateExisting}
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultBrand" className="text-sm">{t.defaultBrand}</Label>
              <Input
                id="defaultBrand"
                value={defaultBrand}
                onChange={(e) => setDefaultBrand(e.target.value)}
                placeholder={t.defaultBrandPlaceholder}
                className="max-w-xs"
              />
            </div>
            {preview && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm">
                  {lang === "de"
                    ? `${preview.validRows} Produkte werden für Lieferant "${supplierName}" importiert.`
                    : `${preview.validRows} products will be imported for supplier "${supplierName}".`}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && importResult && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="font-semibold">{t.doneTitle}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t.created, value: importResult.created, color: "text-green-600" },
                { label: t.updated, value: importResult.updated, color: "text-blue-600" },
                { label: t.skippedResult, value: importResult.skipped, color: "text-muted-foreground" },
                { label: t.errors, value: importResult.errors.length, color: "text-destructive" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border p-3 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                    {importResult.errors.slice(0, 10).map((e) => (
                      <li key={e.row}>Row {e.row}: {e.reason}</li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li>… and {importResult.errors.length - 10} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="gap-2">
          {step === "done" ? (
            <Button onClick={handleClose}>{t.closeBtn}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={step === "upload" ? handleClose : () => setStep(step === "preview" ? "upload" : "preview")}>
                {step === "upload" ? t.cancelBtn : t.backBtn}
              </Button>
              {step === "upload" && (
                <Button disabled={!file || uploading} onClick={() => uploadId && setStep("preview")}>
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t.uploading}</> : t.nextBtn}
                </Button>
              )}
              {step === "preview" && (
                <Button disabled={!preview || previewQuery.isLoading} onClick={() => setStep("confirm")}>
                  {t.nextBtn}
                </Button>
              )}
              {step === "confirm" && (
                <Button
                  disabled={commitMutation.isPending}
                  onClick={handleCommit}
                >
                  {commitMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t.importing}</>
                    : t.importBtn}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
