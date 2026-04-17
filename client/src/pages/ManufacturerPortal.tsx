/**
 * client/src/pages/ManufacturerPortal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Public page (no login required) for manufacturers to:
 * 1. View the Declaration of Conformity sent to them
 * 2. Download the pre-filled PDF
 * 3. Upload the signed PDF
 * 4. Confirm legal acceptance
 *
 * After upload, the page polls for automatic AI validation and shows the result.
 *
 * Accessed via: /declaration/portal/:token
 */
import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  FileSignature,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Shield,
  Brain,
  XCircle,
} from "lucide-react";

// ─── AI Validation Result Panel ───────────────────────────────────────────────

function AiResultPanel({ declaration }: { declaration: any }) {
  const result = declaration.aiValidationResult as any;
  const passed = declaration.aiValidationPassed;

  if (!result) return null;

  const checks = [
    { key: "is_signed", label: "Document signed / Dokument unterzeichnet" },
    { key: "signatory_name_present", label: "Signatory name / Unterzeichner-Name" },
    { key: "signatory_position_present", label: "Signatory position / Position" },
    { key: "date_present", label: "Issue date / Ausstellungsdatum" },
    { key: "product_name_matches", label: "Product name matches / Produktname korrekt" },
    { key: "article_number_present", label: "Article number / Artikelnummer" },
    { key: "directives_complete", label: "EU Directives / EU-Richtlinien" },
    { key: "ch_regulations_present", label: "CH Regulations / CH-Vorschriften" },
    { key: "standards_complete", label: "Standards / Normen" },
    { key: "age_grading_present", label: "Age grading / Altersangabe" },
    { key: "notified_body_present", label: "Notified body / Benannte Stelle" },
  ];

  return (
    <Card className={passed
      ? "border-green-200 bg-green-50 dark:bg-green-900/20"
      : "border-amber-200 bg-amber-50 dark:bg-amber-900/20"
    }>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Brain className={`h-4 w-4 ${passed ? "text-green-600" : "text-amber-600"}`} />
          AI Validation Result / KI-Validierungsergebnis
          {passed ? (
            <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded-full">
              ✓ Passed
            </span>
          ) : (
            <span className="ml-auto text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded-full">
              ⚠ Issues found
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        {result.summary && (
          <p className="text-sm text-muted-foreground italic">{result.summary}</p>
        )}

        {/* Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {checks.map(({ key, label }) => {
            const ok = result[key] === true;
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                {ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                }
                <span className={ok ? "text-foreground" : "text-muted-foreground line-through"}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Issues */}
        {result.issues && result.issues.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Issues / Probleme:
            </p>
            <ul className="space-y-1">
              {result.issues.map((issue: string, i: number) => (
                <li key={i} className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0">•</span>
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {declaration.aiValidatedAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
            <Clock className="h-3 w-3" />
            Validated / Validiert: {new Date(declaration.aiValidatedAt).toLocaleString("de-CH")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManufacturerPortal() {
  const { token } = useParams<{ token: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryPosition, setSignatoryPosition] = useState("");
  // Polling state: true while waiting for AI validation after upload
  const [pollingForAi, setPollingForAi] = useState(false);

  const portalQuery = trpc.declarations.getByToken.useQuery(
    { token: token ?? "" },
    {
      enabled: !!token,
      // Poll every 4 seconds while waiting for AI validation
      refetchInterval: pollingForAi ? 4000 : false,
    }
  );
  const declaration = portalQuery.data as any;

  // Stop polling once AI validation is done
  useEffect(() => {
    if (!pollingForAi) return;
    const status = declaration?.status;
    if (status === "ai_validated" || status === "archived") {
      setPollingForAi(false);
    }
    // Also stop after 3 minutes (45 polls × 4 s) to avoid infinite polling
    const timeout = setTimeout(() => setPollingForAi(false), 3 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [pollingForAi, declaration?.status]);

  const uploadMutation = trpc.declarations.submitSignedPdf.useMutation({
    onSuccess: () => {
      setUploadDone(true);
      setPollingForAi(true);
      toast.success("Signed declaration uploaded. AI validation is running…");
      portalQuery.refetch();
    },
    onError: (e) => {
      setUploading(false);
      toast.error(e.message);
    },
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20 MB).");
      return;
    }
    if (!legalAccepted) {
      toast.error("Please confirm the legal declaration first.");
      return;
    }
    if (!signatoryName.trim() || !signatoryPosition.trim()) {
      toast.error("Please enter your name and position.");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        token: token ?? "",
        signedPdfBase64: base64,
        signatoryName,
        signatoryPosition,
      });
    };
    reader.readAsDataURL(file);
  }

  if (portalQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (portalQuery.isError || !declaration) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Link not valid</h2>
            <p className="text-muted-foreground text-sm">
              This link is invalid or has expired. Please contact the compliance team for a new link.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Dieser Link ist ungültig oder abgelaufen. Bitte wenden Sie sich an das Compliance-Team für einen neuen Link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = declaration.portalTokenExpiresAt
    ? new Date(declaration.portalTokenExpiresAt) < new Date()
    : false;

  const alreadySigned = ["signed", "ai_validated", "archived"].includes(declaration.status);
  const aiValidated = ["ai_validated", "archived"].includes(declaration.status);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Shield className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="font-semibold text-base">spielzeug3 AG – Compliance Portal</h1>
            <p className="text-xs text-muted-foreground">Declaration of Conformity / Konformitätserklärung</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Intro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSignature className="h-5 w-5" />
              Declaration of Conformity – {declaration.docNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Product / Produkt:</span>
                <p className="font-medium">{declaration.effectiveProductName ?? declaration.productName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Manufacturer / Hersteller:</span>
                <p className="font-medium">{declaration.supplierName}</p>
              </div>
              {declaration.issuedDate && (
                <div>
                  <span className="text-muted-foreground">Issued / Ausgestellt:</span>
                  <p className="font-medium">
                    {new Date(declaration.issuedDate).toLocaleDateString("de-CH")}
                    {declaration.issuedPlace && `, ${declaration.issuedPlace}`}
                  </p>
                </div>
              )}
              {declaration.version && (
                <div>
                  <span className="text-muted-foreground">Version:</span>
                  <p className="font-medium">{declaration.version}</p>
                </div>
              )}
            </div>

            {/* Directives */}
            {declaration.euDirectives?.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">EU Directives / EU-Richtlinien:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {declaration.euDirectives.map((d: string) => (
                    <li key={d} className="text-xs">{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {declaration.chRegulations?.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">CH Regulations / CH-Vorschriften:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {declaration.chRegulations.map((r: string) => (
                    <li key={r} className="text-xs">{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {declaration.standards?.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">Standards / Normen:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {declaration.standards.map((s: string) => (
                    <li key={s} className="text-xs">{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expired warning */}
        {isExpired && !alreadySigned && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-red-700 dark:text-red-400">Link expired / Link abgelaufen</p>
                <p className="text-red-600 dark:text-red-500 mt-1">
                  This portal link has expired. Please contact the compliance team for a new link.<br />
                  Dieser Link ist abgelaufen. Bitte wenden Sie sich an das Compliance-Team.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already signed */}
        {alreadySigned ? (
          <div className="space-y-4">
            <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-green-700 dark:text-green-400">
                  Declaration signed / Erklärung unterzeichnet
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Thank you. The signed declaration has been received and is being processed.<br />
                  Vielen Dank. Die unterzeichnete Erklärung wurde empfangen und wird verarbeitet.
                </p>
                {declaration.signedAt && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(declaration.signedAt).toLocaleString("de-CH")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* AI validation: running banner */}
            {!aiValidated && pollingForAi && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="pt-4 flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-700 dark:text-blue-400">
                      AI validation running / KI-Validierung läuft…
                    </p>
                    <p className="text-blue-600 dark:text-blue-500 text-xs mt-0.5">
                      The document is being automatically reviewed by our AI compliance system.
                      This usually takes 15–60 seconds.<br />
                      Das Dokument wird automatisch von unserem KI-Compliance-System geprüft.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI validation: signed but not yet validated (polling stopped or just signed) */}
            {!aiValidated && !pollingForAi && declaration.status === "signed" && uploadDone && (
              <Card className="border-slate-200 bg-slate-50 dark:bg-slate-900/20">
                <CardContent className="pt-4 flex items-center gap-3">
                  <Brain className="h-5 w-5 text-slate-500 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-700 dark:text-slate-400">
                      AI validation pending / KI-Validierung ausstehend
                    </p>
                    <p className="text-slate-600 dark:text-slate-500 text-xs mt-0.5">
                      The compliance team will review the document shortly.<br />
                      Das Compliance-Team wird das Dokument in Kürze prüfen.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI validation result */}
            {aiValidated && <AiResultPanel declaration={declaration} />}
          </div>
        ) : (
          <>
            {/* Step 1: Download PDF */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Step 1 / Schritt 1: Download the Declaration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Download the pre-filled Declaration of Conformity, print it, sign it, and upload the signed copy below.<br />
                  <span className="text-xs">Laden Sie die vorausgefüllte Konformitätserklärung herunter, drucken und unterzeichnen Sie diese, und laden Sie die unterzeichnete Kopie unten hoch.</span>
                </p>
                <a
                  href={`/api/declarations/pdf/${token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download PDF / PDF herunterladen
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Step 2: Upload signed PDF */}
            {!isExpired && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Step 2 / Schritt 2: Upload Signed Declaration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Legal confirmation */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={legalAccepted}
                      onChange={(e) => setLegalAccepted(e.target.checked)}
                    />
                    <span className="text-sm text-muted-foreground">
                      I confirm that the information in this Declaration of Conformity is correct and complete, and that the product complies with all applicable EU and CH regulations listed above. I am authorised to sign on behalf of the manufacturer.<br />
                      <span className="text-xs">Ich bestätige, dass die Angaben in dieser Konformitätserklärung korrekt und vollständig sind und dass das Produkt allen oben aufgeführten EU- und CH-Vorschriften entspricht. Ich bin berechtigt, im Namen des Herstellers zu unterzeichnen.</span>
                    </span>
                  </label>

                  {uploadDone ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle2 className="h-5 w-5" />
                      Signed declaration uploaded successfully / Unterzeichnete Erklärung erfolgreich hochgeladen.
                    </div>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Name *</label>
                          <input
                            className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                            value={signatoryName}
                            onChange={(e) => setSignatoryName(e.target.value)}
                            placeholder="Max Mustermann"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Position *</label>
                          <input
                            className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                            value={signatoryPosition}
                            onChange={(e) => setSignatoryPosition(e.target.value)}
                            placeholder="Quality Manager"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!legalAccepted || uploading || uploadMutation.isPending || !signatoryName.trim() || !signatoryPosition.trim()}
                        className="gap-2"
                      >
                        {uploading || uploadMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        Upload Signed PDF / Unterzeichnetes PDF hochladen
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        PDF only, max 20 MB / Nur PDF, max. 20 MB
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-6">
          <p>spielzeug3 AG – Compliance Management System</p>
          <p className="mt-1">
            Questions? / Fragen? Contact:{" "}
            <a href="mailto:compliance@spielzeug3.ch" className="underline">
              compliance@spielzeug3.ch
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
