import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, BarChart2, ChevronDown, ChevronRight, Tag } from "lucide-react";

interface Props {
  productId: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function docTypeLabel(type: string, lang: "de" | "en"): string {
  const mapDe: Record<string, string> = {
    test_report: "Prüfbericht",
    declaration_of_conformity: "Konformitätserklärung",
    manual: "Bedienungsanleitung",
    certificate: "Zertifikat",
    product_image: "Produktbild",
    safety_image: "Sicherheitsbild",
    regulatory_document: "Regulatorisches Dokument",
    other: "Sonstiges",
  };
  const mapEn: Record<string, string> = {
    test_report: "Test Report",
    declaration_of_conformity: "Declaration of Conformity",
    manual: "Manual",
    certificate: "Certificate",
    product_image: "Product Image",
    safety_image: "Safety Image",
    regulatory_document: "Regulatory Document",
    other: "Other",
  };
  const map = lang === "en" ? mapEn : mapDe;
  return map[type] ?? type;
}

// ─── Create / Edit Version Dialog ────────────────────────────────────────────
function VersionDialog({
  productId,
  existing,
  onClose,
  lang,
}: {
  productId: number;
  existing?: { id: number; versionNumber: string; label: string | null; notes: string | null; isActive: boolean };
  onClose: () => void;
  lang: "de" | "en";
}) {
  const T = lang === "en" ? {
    titleCreate: "Create New Version",
    titleEdit: "Edit Version",
    versionNumber: "Version Number *",
    versionNumberPlaceholder: "e.g. 7.4, 2.1.0, Rev. B",
    label: "Label (optional)",
    labelPlaceholder: "e.g. Swiss Edition, Production Batch Q1",
    notes: "Notes / Change Log",
    notesPlaceholder: "What changed in this version?",
    isActive: "Active Version",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    successCreate: "Version created",
    successUpdate: "Version updated",
  } : {
    titleCreate: "Neue Version anlegen",
    titleEdit: "Version bearbeiten",
    versionNumber: "Versionsnummer *",
    versionNumberPlaceholder: "z.B. 7.4, 2.1.0, Rev. B",
    label: "Bezeichnung (optional)",
    labelPlaceholder: "z.B. Schweizer Edition, Produktionscharge Q1",
    notes: "Notizen / Änderungshinweise",
    notesPlaceholder: "Was hat sich in dieser Version geändert?",
    isActive: "Aktive Version",
    cancel: "Abbrechen",
    save: "Speichern",
    saving: "Speichern...",
    successCreate: "Version angelegt",
    successUpdate: "Version aktualisiert",
  };

  const utils = trpc.useUtils();
  const [versionNumber, setVersionNumber] = useState(existing?.versionNumber ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  const create = trpc.versions.create.useMutation({
    onSuccess: () => {
      utils.versions.list.invalidate({ productId });
      toast.success(T.successCreate);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.versions.update.useMutation({
    onSuccess: () => {
      utils.versions.list.invalidate({ productId });
      if (existing) utils.versions.getWithDocuments.invalidate({ versionId: existing.id });
      toast.success(T.successUpdate);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const isLoading = create.isPending || update.isPending;

  function handleSave() {
    if (!versionNumber.trim()) return;
    if (existing) {
      update.mutate({ versionId: existing.id, versionNumber, label: label || null, notes: notes || null, isActive });
    } else {
      create.mutate({ productId, versionNumber, label: label || undefined, notes: notes || undefined, isActive });
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? T.titleEdit : T.titleCreate}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>{T.versionNumber}</Label>
            <Input
              placeholder={T.versionNumberPlaceholder}
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>{T.label}</Label>
            <Input
              placeholder={T.labelPlaceholder}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>{T.notes}</Label>
            <Textarea
              placeholder={T.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(!!v)}
            />
            <Label htmlFor="isActive">{T.isActive}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{T.cancel}</Button>
          <Button onClick={handleSave} disabled={isLoading || !versionNumber.trim()}>
            {isLoading ? T.saving : T.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Documents Dialog ──────────────────────────────────────────────────
function AssignDocumentsDialog({
  productId,
  versionId,
  versionNumber,
  onClose,
  lang,
}: {
  productId: number;
  versionId: number;
  versionNumber: string;
  onClose: () => void;
  lang: "de" | "en";
}) {
  const T = lang === "en" ? {
    title: `Assign Documents – Version ${versionNumber}`,
    noDocs: "No documents available.",
    alreadyAssigned: "Already assigned to another version",
    cancel: "Cancel",
    save: (n: number) => `Assign ${n} document(s)`,
    saving: "Saving...",
    successAssign: (n: number) => `${n} document(s) assigned`,
    successUpdate: "Assignments updated",
  } : {
    title: `Dokumente zuordnen – Version ${versionNumber}`,
    noDocs: "Keine Dokumente vorhanden.",
    alreadyAssigned: "Bereits anderer Version zugeordnet",
    cancel: "Abbrechen",
    save: (n: number) => `${n} Dokument(e) zuordnen`,
    saving: "Speichern...",
    successAssign: (n: number) => `${n} Dokument(e) zugeordnet`,
    successUpdate: "Zuordnungen aktualisiert",
  };

  const utils = trpc.useUtils();
  const { data: allDocs } = trpc.versions.getProductDocumentsWithVersions.useQuery({ productId });
  const { data: versionData } = trpc.versions.getWithDocuments.useQuery({ versionId });
  const assignedIds = new Set((versionData?.documents ?? []).map((d) => d.id));
  const [selected, setSelected] = useState<Set<number>>(new Set(assignedIds));

  const assignDocs = trpc.versions.assignDocuments.useMutation({
    onSuccess: (res) => {
      utils.versions.getWithDocuments.invalidate({ versionId });
      utils.versions.getProductDocumentsWithVersions.invalidate({ productId });
      toast.success(T.successAssign(res.assigned));
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const assignSingle = trpc.versions.assignDocument.useMutation();

  async function handleSave() {
    const allDocIds = (allDocs ?? []).map((d) => d.id);
    const toAssign = allDocIds.filter((id) => selected.has(id));
    const toUnassign = allDocIds.filter((id) => assignedIds.has(id) && !selected.has(id));

    for (const id of toUnassign) {
      await assignSingle.mutateAsync({ documentId: id, versionId: null });
    }
    if (toAssign.length > 0) {
      await assignDocs.mutateAsync({ documentIds: toAssign, versionId });
    } else {
      utils.versions.getWithDocuments.invalidate({ versionId });
      utils.versions.getProductDocumentsWithVersions.invalidate({ productId });
      toast.success(T.successUpdate);
      onClose();
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{T.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {(allDocs ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{T.noDocs}</p>
          )}
          {(allDocs ?? []).map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-3 p-2 rounded border border-border hover:bg-muted/30 cursor-pointer"
              onClick={() => toggle(doc.id)}
            >
              <Checkbox
                checked={selected.has(doc.id)}
                onCheckedChange={() => toggle(doc.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.fileName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">{docTypeLabel(doc.documentType, lang)}</Badge>
                  {doc.productVersionId && doc.productVersionId !== versionId && (
                    <span className="text-xs text-amber-600">{T.alreadyAssigned}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{T.cancel}</Button>
          <Button onClick={handleSave} disabled={assignDocs.isPending}>
            {assignDocs.isPending ? T.saving : T.save(selected.size)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Analyses Dialog ───────────────────────────────────────────────────
function AssignAnalysesDialog({
  productId,
  versionId,
  versionNumber,
  onClose,
  lang,
}: {
  productId: number;
  versionId: number;
  versionNumber: string;
  onClose: () => void;
  lang: "de" | "en";
}) {
  const T = lang === "en" ? {
    title: `Assign AI Analyses – Version ${versionNumber}`,
    noAnalyses: "No analyses available.",
    alreadyAssigned: "Already assigned to another version",
    cancel: "Cancel",
    save: "Save Assignment",
    saving: "Saving...",
    success: "Analysis assignment updated",
    analysisLabel: (id: number, score: string | number | null | undefined) => `Analysis #${id} – Score: ${score ?? "–"}/100`,
  } : {
    title: `KI-Analysen zuordnen – Version ${versionNumber}`,
    noAnalyses: "Keine Analysen vorhanden.",
    alreadyAssigned: "Bereits anderer Version zugeordnet",
    cancel: "Abbrechen",
    save: "Zuordnung speichern",
    saving: "Speichern...",
    success: "Analysen-Zuordnung aktualisiert",
    analysisLabel: (id: number, score: string | number | null | undefined) => `Analyse #${id} – Score: ${score ?? "–"}/100`,
  };

  const utils = trpc.useUtils();
  const { data: allAnalyses } = trpc.versions.getProductAnalysesWithVersions.useQuery({ productId });
  const { data: versionData } = trpc.versions.getWithDocuments.useQuery({ versionId });
  const assignedIds = new Set((versionData?.analyses ?? []).map((a) => a.id));
  const [selected, setSelected] = useState<Set<number>>(new Set(assignedIds));

  const assignAnalysis = trpc.versions.assignAnalysis.useMutation();
  const locale = lang === "en" ? "en-GB" : "de-CH";

  async function handleSave() {
    const allIds = (allAnalyses ?? []).map((a) => a.id);
    const toAssign = allIds.filter((id) => selected.has(id));
    const toUnassign = allIds.filter((id) => assignedIds.has(id) && !selected.has(id));
    for (const id of toUnassign) {
      await assignAnalysis.mutateAsync({ analysisId: id, versionId: null });
    }
    for (const id of toAssign) {
      await assignAnalysis.mutateAsync({ analysisId: id, versionId });
    }
    utils.versions.getWithDocuments.invalidate({ versionId });
    toast.success(T.success);
    onClose();
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{T.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {(allAnalyses ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{T.noAnalyses}</p>
          )}
          {(allAnalyses ?? []).map((ana) => (
            <div
              key={ana.id}
              className="flex items-start gap-3 p-2 rounded border border-border hover:bg-muted/30 cursor-pointer"
              onClick={() => toggle(ana.id)}
            >
              <Checkbox
                checked={selected.has(ana.id)}
                onCheckedChange={() => toggle(ana.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {T.analysisLabel(ana.id, ana.overallScore)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ana.modelUsed ?? "–"} · {new Date(ana.createdAt).toLocaleDateString(locale)}
                  {ana.productVersionId && ana.productVersionId !== versionId && (
                    <span className="ml-2 text-amber-600">{T.alreadyAssigned}</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{T.cancel}</Button>
          <Button onClick={handleSave} disabled={assignAnalysis.isPending}>
            {assignAnalysis.isPending ? T.saving : T.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Version Card ─────────────────────────────────────────────────────────────
function VersionCard({
  version,
  productId,
  lang,
}: {
  version: { id: number; versionNumber: string; label: string | null; notes: string | null; isActive: boolean; createdAt: Date };
  productId: number;
  lang: "de" | "en";
}) {
  const T = lang === "en" ? {
    active: "Active",
    documents: "Documents",
    analyses: "AI Analyses",
    assign: "Assign",
    noDocs: "No documents assigned.",
    noAnalyses: "No analyses assigned.",
    deleteConfirm: (v: string) => `Really delete version ${v}?`,
    deleted: "Version deleted",
  } : {
    active: "Aktiv",
    documents: "Dokumente",
    analyses: "KI-Analysen",
    assign: "Zuordnen",
    noDocs: "Keine Dokumente zugeordnet.",
    noAnalyses: "Keine Analysen zugeordnet.",
    deleteConfirm: (v: string) => `Version ${v} wirklich löschen?`,
    deleted: "Version gelöscht",
  };

  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssignDocs, setShowAssignDocs] = useState(false);
  const [showAssignAnalyses, setShowAssignAnalyses] = useState(false);

  const { data: versionData } = trpc.versions.getWithDocuments.useQuery(
    { versionId: version.id },
    { enabled: expanded }
  );

  const deleteVersion = trpc.versions.delete.useMutation({
    onSuccess: () => {
      utils.versions.list.invalidate({ productId });
      toast.success(T.deleted);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border border-border">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Tag className="h-4 w-4 text-violet-500" />
            <span className="font-semibold text-sm">v{version.versionNumber}</span>
            {version.label && <span className="text-sm text-muted-foreground">– {version.label}</span>}
            {version.isActive && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{T.active}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setShowEdit(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(T.deleteConfirm(version.versionNumber))) {
                  deleteVersion.mutate({ versionId: version.id });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {version.notes && (
          <p className="text-xs text-muted-foreground ml-10 mt-1">{version.notes}</p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-4">
          {/* Documents */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> {T.documents} ({versionData?.documents?.length ?? 0})
              </h4>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAssignDocs(true)}>
                {T.assign}
              </Button>
            </div>
            {(versionData?.documents ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{T.noDocs}</p>
            ) : (
              <div className="space-y-1">
                {(versionData?.documents ?? []).map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm p-1.5 rounded bg-muted/30">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{doc.fileName}</span>
                    <Badge variant="outline" className="text-xs flex-shrink-0">{docTypeLabel(doc.documentType, lang)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analyses */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <BarChart2 className="h-3.5 w-3.5" /> {T.analyses} ({versionData?.analyses?.length ?? 0})
              </h4>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAssignAnalyses(true)}>
                {T.assign}
              </Button>
            </div>
            {(versionData?.analyses ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{T.noAnalyses}</p>
            ) : (
              <div className="space-y-1">
                {(versionData?.analyses ?? []).map((ana) => (
                  <div key={ana.id} className="flex items-center gap-2 text-sm p-1.5 rounded bg-muted/30">
                    <BarChart2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1">{lang === "en" ? "Analysis" : "Analyse"} #{ana.id}</span>
                    <span className="text-xs text-muted-foreground">{ana.modelUsed ?? "–"}</span>
                    <Badge
                      className={`text-xs flex-shrink-0 ${
                        Number(ana.overallScore) >= 80
                          ? "bg-green-100 text-green-700 border-green-200"
                          : Number(ana.overallScore) >= 50
                          ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                          : "bg-red-100 text-red-700 border-red-200"
                      }`}
                    >
                      {ana.overallScore ?? "–"}/100
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}

      {showEdit && (
        <VersionDialog productId={productId} existing={version} onClose={() => setShowEdit(false)} lang={lang} />
      )}
      {showAssignDocs && (
        <AssignDocumentsDialog
          productId={productId}
          versionId={version.id}
          versionNumber={version.versionNumber}
          onClose={() => setShowAssignDocs(false)}
          lang={lang}
        />
      )}
      {showAssignAnalyses && (
        <AssignAnalysesDialog
          productId={productId}
          versionId={version.id}
          versionNumber={version.versionNumber}
          onClose={() => setShowAssignAnalyses(false)}
          lang={lang}
        />
      )}
    </Card>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export function ProductVersionsTab({ productId }: Props) {
  const { lang } = useLang();
  const [showCreate, setShowCreate] = useState(false);
  const { data: versions, isLoading } = trpc.versions.list.useQuery({ productId });

  const T = lang === "en" ? {
    title: "Product Versions",
    description: "Manage version numbers and assign documents and AI analyses to the respective versions.",
    createButton: "Create Version",
    loading: "Loading versions...",
    emptyTitle: "No versions created yet",
    emptyDescription: "Create a version number and assign documents and analyses.",
    createFirst: "Create First Version",
  } : {
    title: "Produktversionen",
    description: "Verwalten Sie Versionsnummern und ordnen Sie Dokumente sowie KI-Analysen den jeweiligen Versionen zu.",
    createButton: "Version anlegen",
    loading: "Lade Versionen...",
    emptyTitle: "Noch keine Versionen angelegt",
    emptyDescription: "Legen Sie eine Versionsnummer an und ordnen Sie Dokumente und Analysen zu.",
    createFirst: "Erste Version anlegen",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">{T.title}</h3>
          <p className="text-sm text-muted-foreground">{T.description}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {T.createButton}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{T.loading}</p>}

      {!isLoading && (versions ?? []).length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Tag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">{T.emptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{T.emptyDescription}</p>
            <Button className="mt-4" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> {T.createFirst}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(versions ?? []).map((v) => (
          <VersionCard key={v.id} version={v} productId={productId} lang={lang} />
        ))}
      </div>

      {showCreate && (
        <VersionDialog productId={productId} onClose={() => setShowCreate(false)} lang={lang} />
      )}
    </div>
  );
}
