/**
 * client/src/components/DeclarationsTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tab content for Declarations of Conformity inside ProductDetail.
 * Allows compliance managers to create, view, send and validate DoC documents.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FileSignature,
  Plus,
  Send,
  Bot,
  Archive,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Copy,
} from "lucide-react";
import AiValidationPanel from "@/components/AiValidationPanel";

interface Props {
  productId: number;
  lang: "de" | "en";
}

const STATUS_LABELS: Record<string, { de: string; en: string; color: string }> = {
  draft:              { de: "Entwurf",          en: "Draft",             color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  sent:               { de: "Versendet",         en: "Sent",              color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  manufacturer_review:{ de: "Beim Hersteller",   en: "Manufacturer Review", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  signed:             { de: "Unterzeichnet",      en: "Signed",            color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  ai_validated:       { de: "KI-validiert",       en: "AI Validated",      color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  archived:           { de: "Archiviert",         en: "Archived",          color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

const EU_DIRECTIVES = [
  "2014/35/EU – Low Voltage Directive",
  "2014/30/EU – EMC Directive",
  "2011/65/EU – RoHS Directive",
  "2009/48/EC – Toy Safety Directive",
  "2014/53/EU – Radio Equipment Directive",
  "2016/425/EU – PPE Regulation",
  "1907/2006/EC – REACH Regulation",
];

const CH_REGULATIONS = [
  "SR 930.111 – Produktesicherheitsgesetz (PrSG)",
  "SR 930.111.1 – Spielzeugverordnung (SpV)",
  "SR 814.81 – ChemV (REACH-Äquivalent)",
  "SR 814.015 – RoHS-Äquivalent",
];

const STANDARDS = [
  "EN 71-1:2014+A1:2018 – Mechanical & Physical Properties",
  "EN 71-2:2011+A1:2014 – Flammability",
  "EN 71-3:2019 – Migration of Certain Elements",
  "EN 71-4:2020 – Experimental Sets",
  "EN 71-5:2015 – Chemical Toys",
  "EN 71-7:2014+A1:2018 – Finger Paints",
  "EN 62115:2005+A12:2015 – Electric Toys",
  "EN ISO 8124-1:2018 – Safety Aspects",
  "EN 300 328 – WLAN 2.4 GHz",
  "EN 301 489-1 – EMC Radio",
];

export default function DeclarationsTab({ productId, lang }: Props) {
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = trpc.declarations.listByProduct.useQuery({ productId });
  const declarations = listQuery.data ?? [];

  const selectedQuery = trpc.declarations.getById.useQuery(
    { id: selectedId! },
    { enabled: selectedId !== null }
  );
  const selected = selectedQuery.data as any;

  const sendMutation = trpc.declarations.sendToManufacturer.useMutation({
    onSuccess: () => {
      toast.success(lang === "de" ? "E-Mail an Hersteller gesendet." : "Email sent to manufacturer.");
      utils.declarations.listByProduct.invalidate({ productId });
      utils.declarations.getById.invalidate({ id: selectedId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const aiMutation = trpc.declarations.validateWithAi.useMutation({
    onSuccess: (result: any) => {
      if (result.passed) {
        toast.success(lang === "de" ? "KI-Validierung bestanden ✓" : "AI validation passed ✓");
      } else {
        toast.warning(lang === "de" ? "KI-Validierung: Probleme gefunden" : "AI validation: issues found");
      }
      utils.declarations.listByProduct.invalidate({ productId });
      utils.declarations.getById.invalidate({ id: selectedId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const archiveMutation = trpc.declarations.archive.useMutation({
    onSuccess: () => {
      toast.success(lang === "de" ? "Archiviert und als Dokument gespeichert." : "Archived and saved as document.");
      utils.declarations.listByProduct.invalidate({ productId });
      utils.declarations.getById.invalidate({ id: selectedId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const regenTokenMutation = trpc.declarations.regenerateToken.useMutation({
    onSuccess: () => {
      toast.success(lang === "de" ? "Neuer Link generiert." : "New link generated.");
      utils.declarations.getById.invalidate({ id: selectedId! });
    },
    onError: (e) => toast.error(e.message),
  });

  function copyPortalLink() {
    if (!selected?.portalToken) return;
    const url = `${window.location.origin}/declaration/portal/${selected.portalToken}`;
    navigator.clipboard.writeText(url);
    toast.success(lang === "de" ? "Link kopiert." : "Link copied.");
  }

  function openPortalLink() {
    if (!selected?.portalToken) return;
    window.open(`${window.location.origin}/declaration/portal/${selected.portalToken}`, "_blank");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            {lang === "de" ? "Konformitätserklärungen (DoC)" : "Declarations of Conformity (DoC)"}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lang === "de"
              ? "Erstellen, versenden und validieren Sie Konformitätserklärungen für dieses Produkt."
              : "Create, send and validate declarations of conformity for this product."}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {lang === "de" ? "Neue DoC" : "New DoC"}
        </Button>
      </div>

      {/* List */}
      {listQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          {lang === "de" ? "Lade..." : "Loading..."}
        </div>
      ) : declarations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileSignature className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {lang === "de"
              ? "Noch keine Konformitätserklärungen vorhanden."
              : "No declarations of conformity yet."}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {lang === "de" ? "Erste DoC erstellen" : "Create first DoC"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {declarations.map((d: any) => {
            const statusInfo = STATUS_LABELS[d.status] ?? STATUS_LABELS.draft;
            return (
              <Card
                key={d.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedId === d.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">{d.docNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                          {statusInfo[lang]}
                        </span>
                        {d.aiValidationPassed === true && (
                          <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> KI ✓
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {d.effectiveProductName ?? "—"}
                      </p>
                      {d.manufacturerContactEmail && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          📧 {d.manufacturerContactEmail}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleDateString(lang === "de" ? "de-CH" : "en-GB")}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {selectedId === d.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {selectedQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {lang === "de" ? "Lade Details..." : "Loading details..."}
                        </div>
                      ) : selected ? (
                        <>
                          {/* Details grid */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">{lang === "de" ? "Version" : "Version"}:</span>
                              <span className="ml-2">{selected.version}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{lang === "de" ? "Ausstellungsort" : "Issued Place"}:</span>
                              <span className="ml-2">{selected.issuedPlace ?? "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{lang === "de" ? "Ausstellungsdatum" : "Issued Date"}:</span>
                              <span className="ml-2">
                                {selected.issuedDate
                                  ? new Date(selected.issuedDate).toLocaleDateString(lang === "de" ? "de-CH" : "en-GB")
                                  : "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{lang === "de" ? "Unterzeichnet von" : "Signed by"}:</span>
                              <span className="ml-2">{selected.signedByName ?? "—"}</span>
                            </div>
                          </div>

                          {/* Directives */}
                          {selected.euDirectives?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">EU Directives</p>
                              <div className="flex flex-wrap gap-1">
                                {selected.euDirectives.map((d: string) => (
                                  <span key={d} className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded">
                                    {d.split(" – ")[0]}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Standards */}
                          {selected.standards?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">{lang === "de" ? "Normen" : "Standards"}</p>
                              <div className="flex flex-wrap gap-1">
                                {selected.standards.map((s: string) => (
                                  <span key={s} className="text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded font-mono">
                                    {s.split(":")[0]}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* AI Validation Result */}
                          {selected.aiValidationResult && (
                            <AiValidationPanel
                              result={selected.aiValidationResult}
                              summary={selected.aiValidationSummary}
                              passed={selected.aiValidationPassed}
                              validatedAt={selected.aiValidatedAt}
                              lang={lang}
                            />
                          )}

                          {/* Portal link */}
                          {selected.portalToken && ["sent", "manufacturer_review"].includes(selected.status) && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {lang === "de" ? "Hersteller-Portal Link" : "Manufacturer Portal Link"}
                              </p>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={copyPortalLink}>
                                  <Copy className="h-3 w-3 mr-1" />
                                  {lang === "de" ? "Kopieren" : "Copy"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={openPortalLink}>
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  {lang === "de" ? "Öffnen" : "Open"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => regenTokenMutation.mutate({ id: selected.id })}
                                  disabled={regenTokenMutation.isPending}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  {lang === "de" ? "Neu generieren" : "Regenerate"}
                                </Button>
                              </div>
                              {selected.portalTokenExpiresAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {lang === "de" ? "Gültig bis" : "Valid until"}:{" "}
                                  {new Date(selected.portalTokenExpiresAt).toLocaleDateString(lang === "de" ? "de-CH" : "en-GB")}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Signed PDF link */}
                          {selected.signedPdfUrl && (
                            <a
                              href={selected.signedPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                              {lang === "de" ? "Unterzeichnetes PDF öffnen" : "Open signed PDF"}
                            </a>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            {["draft", "sent"].includes(selected.status) && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  sendMutation.mutate({
                                    id: selected.id,
                                    origin: window.location.origin,
                                  })
                                }
                                disabled={sendMutation.isPending}
                              >
                                {sendMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4 mr-1" />
                                )}
                                {lang === "de" ? "An Hersteller senden" : "Send to Manufacturer"}
                              </Button>
                            )}
                            {selected.status === "signed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => aiMutation.mutate({ id: selected.id })}
                                disabled={aiMutation.isPending}
                              >
                                {aiMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Bot className="h-4 w-4 mr-1" />
                                )}
                                {lang === "de" ? "KI-Validierung starten" : "Start AI Validation"}
                              </Button>
                            )}
                            {["signed", "ai_validated"].includes(selected.status) && selected.signedPdfUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => archiveMutation.mutate({ id: selected.id })}
                                disabled={archiveMutation.isPending}
                              >
                                {archiveMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Archive className="h-4 w-4 mr-1" />
                                )}
                                {lang === "de" ? "Archivieren" : "Archive"}
                              </Button>
                            )}
                          </div>

                          {/* Status History */}
                          {selected.statusHistory?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {lang === "de" ? "Verlauf" : "History"}
                              </p>
                              <div className="space-y-1.5">
                                {selected.statusHistory.map((h: any) => (
                                  <div key={h.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span>
                                      {new Date(h.createdAt).toLocaleString(lang === "de" ? "de-CH" : "en-GB")}
                                      {" – "}
                                      <span className="font-medium text-foreground">{h.action}</span>
                                      {h.performedByName && ` (${h.performedByName})`}
                                      {h.note && ` – ${h.note}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <CreateDeclarationDialog
        productId={productId}
        lang={lang}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          setShowCreate(false);
          setSelectedId(id);
          utils.declarations.listByProduct.invalidate({ productId });
        }}
      />
    </div>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateDeclarationDialog({
  productId,
  lang,
  open,
  onClose,
  onCreated,
}: {
  productId: number;
  lang: "de" | "en";
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const suppliersQuery = trpc.suppliers.list.useQuery(undefined, { enabled: open });
  const suppliers = suppliersQuery.data ?? [];

  const [form, setForm] = useState({
    supplierId: "",
    effectiveProductName: "",
    effectiveAgeGrading: "",
    euDirectives: [] as string[],
    chRegulations: [] as string[],
    standards: [] as string[],
    testReportRef: "",
    notifiedBody: "",
    chConformityBody: "",
    issuedDate: "",
    issuedPlace: "",
    manufacturerContactName: "",
    manufacturerContactEmail: "",
  });

  const createMutation = trpc.declarations.create.useMutation({
    onSuccess: (data: any) => {
      toast.success(lang === "de" ? "Konformitätserklärung erstellt." : "Declaration created.");
      onCreated(data.id);
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleItem(list: string[], item: string): string[] {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }

  function handleSubmit() {
    if (!form.supplierId) {
      toast.error(lang === "de" ? "Bitte Lieferant auswählen." : "Please select a supplier.");
      return;
    }
    createMutation.mutate({
      productId,
      supplierId: parseInt(form.supplierId),
      effectiveProductName: form.effectiveProductName || undefined,
      effectiveAgeGrading: form.effectiveAgeGrading || undefined,
      euDirectives: form.euDirectives,
      chRegulations: form.chRegulations,
      standards: form.standards,
      testReportRef: form.testReportRef || undefined,
      notifiedBody: form.notifiedBody || undefined,
      chConformityBody: form.chConformityBody || undefined,
      issuedDate: form.issuedDate || undefined,
      issuedPlace: form.issuedPlace || undefined,
      manufacturerContactName: form.manufacturerContactName || undefined,
      manufacturerContactEmail: form.manufacturerContactEmail || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            {lang === "de" ? "Neue Konformitätserklärung" : "New Declaration of Conformity"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Supplier */}
          <div>
            <Label>{lang === "de" ? "Lieferant / Hersteller *" : "Supplier / Manufacturer *"}</Label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={form.supplierId}
              onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
            >
              <option value="">{lang === "de" ? "Bitte wählen..." : "Please select..."}</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Product name */}
          <div>
            <Label>{lang === "de" ? "Produktbezeichnung (für DoC)" : "Product Name (for DoC)"}</Label>
            <Input
              className="mt-1"
              value={form.effectiveProductName}
              onChange={(e) => setForm((f) => ({ ...f, effectiveProductName: e.target.value }))}
              placeholder={lang === "de" ? "Wird automatisch aus Produkt übernommen" : "Auto-filled from product"}
            />
          </div>

          {/* Age grading */}
          <div>
            <Label>{lang === "de" ? "Altersfreigabe" : "Age Grading"}</Label>
            <Input
              className="mt-1"
              value={form.effectiveAgeGrading}
              onChange={(e) => setForm((f) => ({ ...f, effectiveAgeGrading: e.target.value }))}
              placeholder="z.B. 3+ / 36+ months"
            />
          </div>

          {/* EU Directives */}
          <div>
            <Label>{lang === "de" ? "EU-Richtlinien" : "EU Directives"}</Label>
            <div className="mt-1 space-y-1.5 max-h-36 overflow-y-auto border rounded-md p-2">
              {EU_DIRECTIVES.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.euDirectives.includes(d)}
                    onChange={() => setForm((f) => ({ ...f, euDirectives: toggleItem(f.euDirectives, d) }))}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>

          {/* CH Regulations */}
          <div>
            <Label>{lang === "de" ? "CH-Vorschriften" : "CH Regulations"}</Label>
            <div className="mt-1 space-y-1.5 border rounded-md p-2">
              {CH_REGULATIONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.chRegulations.includes(r)}
                    onChange={() => setForm((f) => ({ ...f, chRegulations: toggleItem(f.chRegulations, r) }))}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {/* Standards */}
          <div>
            <Label>{lang === "de" ? "Normen" : "Standards"}</Label>
            <div className="mt-1 space-y-1.5 max-h-40 overflow-y-auto border rounded-md p-2">
              {STANDARDS.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.standards.includes(s)}
                    onChange={() => setForm((f) => ({ ...f, standards: toggleItem(f.standards, s) }))}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Test report ref */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{lang === "de" ? "Prüfberichts-Referenz" : "Test Report Reference"}</Label>
              <Input
                className="mt-1"
                value={form.testReportRef}
                onChange={(e) => setForm((f) => ({ ...f, testReportRef: e.target.value }))}
                placeholder="z.B. TR-2024-001"
              />
            </div>
            <div>
              <Label>{lang === "de" ? "Notifizierte Stelle" : "Notified Body"}</Label>
              <Input
                className="mt-1"
                value={form.notifiedBody}
                onChange={(e) => setForm((f) => ({ ...f, notifiedBody: e.target.value }))}
                placeholder="z.B. TÜV SÜD, NB 0123"
              />
            </div>
          </div>

          {/* CH conformity body */}
          <div>
            <Label>{lang === "de" ? "CH-Konformitätsstelle" : "CH Conformity Body"}</Label>
            <Input
              className="mt-1"
              value={form.chConformityBody}
              onChange={(e) => setForm((f) => ({ ...f, chConformityBody: e.target.value }))}
              placeholder="z.B. METAS, Eurofins"
            />
          </div>

          {/* Issued */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{lang === "de" ? "Ausstellungsdatum" : "Issued Date"}</Label>
              <Input
                type="date"
                className="mt-1"
                value={form.issuedDate}
                onChange={(e) => setForm((f) => ({ ...f, issuedDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>{lang === "de" ? "Ausstellungsort" : "Issued Place"}</Label>
              <Input
                className="mt-1"
                value={form.issuedPlace}
                onChange={(e) => setForm((f) => ({ ...f, issuedPlace: e.target.value }))}
                placeholder="z.B. Zürich, Switzerland"
              />
            </div>
          </div>

          {/* Manufacturer contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{lang === "de" ? "Ansprechpartner Hersteller" : "Manufacturer Contact"}</Label>
              <Input
                className="mt-1"
                value={form.manufacturerContactName}
                onChange={(e) => setForm((f) => ({ ...f, manufacturerContactName: e.target.value }))}
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <Label>{lang === "de" ? "E-Mail Hersteller" : "Manufacturer Email"}</Label>
              <Input
                type="email"
                className="mt-1"
                value={form.manufacturerContactEmail}
                onChange={(e) => setForm((f) => ({ ...f, manufacturerContactEmail: e.target.value }))}
                placeholder="contact@manufacturer.com"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {lang === "de" ? "Abbrechen" : "Cancel"}
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            {lang === "de" ? "DoC erstellen" : "Create DoC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
