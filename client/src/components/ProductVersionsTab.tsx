import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
function docTypeLabel(type: string): string {
  const map: Record<string, string> = {
    test_report: "Prüfbericht",
    declaration_of_conformity: "Konformitätserklärung",
    manual: "Bedienungsanleitung",
    certificate: "Zertifikat",
    product_image: "Produktbild",
    safety_image: "Sicherheitsbild",
    regulatory_document: "Regulatorisches Dokument",
    other: "Sonstiges",
  };
  return map[type] ?? type;
}

// ─── Create / Edit Version Dialog ────────────────────────────────────────────
function VersionDialog({
  productId,
  existing,
  onClose,
}: {
  productId: number;
  existing?: { id: number; versionNumber: string; label: string | null; notes: string | null; isActive: boolean };
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [versionNumber, setVersionNumber] = useState(existing?.versionNumber ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  const create = trpc.versions.create.useMutation({
    onSuccess: () => {
      utils.versions.list.invalidate({ productId });
      toast.success("Version angelegt");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.versions.update.useMutation({
    onSuccess: () => {
      utils.versions.list.invalidate({ productId });
      if (existing) utils.versions.getWithDocuments.invalidate({ versionId: existing.id });
      toast.success("Version aktualisiert");
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
          <DialogTitle>{existing ? "Version bearbeiten" : "Neue Version anlegen"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Versionsnummer *</Label>
            <Input
              placeholder="z.B. 7.4, 2.1.0, Rev. B"
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Bezeichnung (optional)</Label>
            <Input
              placeholder="z.B. Schweizer Edition, Produktionscharge Q1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Notizen / Änderungshinweise</Label>
            <Textarea
              placeholder="Was hat sich in dieser Version geändert?"
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
            <Label htmlFor="isActive">Aktive Version</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={isLoading || !versionNumber.trim()}>
            {isLoading ? "Speichern..." : "Speichern"}
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
}: {
  productId: number;
  versionId: number;
  versionNumber: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: allDocs } = trpc.versions.getProductDocumentsWithVersions.useQuery({ productId });
  const { data: versionData } = trpc.versions.getWithDocuments.useQuery({ versionId });
  const assignedIds = new Set((versionData?.documents ?? []).map((d) => d.id));
  const [selected, setSelected] = useState<Set<number>>(new Set(assignedIds));

  const assignDocs = trpc.versions.assignDocuments.useMutation({
    onSuccess: (res) => {
      utils.versions.getWithDocuments.invalidate({ versionId });
      utils.versions.getProductDocumentsWithVersions.invalidate({ productId });
      toast.success(`${res.assigned} Dokument(e) zugeordnet`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  // Also handle un-assignments (docs that were assigned but are now deselected)
  const assignSingle = trpc.versions.assignDocument.useMutation();

  async function handleSave() {
    const allDocIds = (allDocs ?? []).map((d) => d.id);
    // Assign selected
    const toAssign = allDocIds.filter((id) => selected.has(id));
    // Unassign deselected (only those that were previously assigned to THIS version)
    const toUnassign = allDocIds.filter((id) => assignedIds.has(id) && !selected.has(id));

    for (const id of toUnassign) {
      await assignSingle.mutateAsync({ documentId: id, versionId: null });
    }
    if (toAssign.length > 0) {
      await assignDocs.mutateAsync({ documentIds: toAssign, versionId });
    } else {
      utils.versions.getWithDocuments.invalidate({ versionId });
      utils.versions.getProductDocumentsWithVersions.invalidate({ productId });
      toast.success("Zuordnungen aktualisiert");
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
          <DialogTitle>Dokumente zuordnen – Version {versionNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {(allDocs ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Dokumente vorhanden.</p>
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
                  <Badge variant="outline" className="text-xs">{docTypeLabel(doc.documentType)}</Badge>
                  {doc.productVersionId && doc.productVersionId !== versionId && (
                    <span className="text-xs text-amber-600">Bereits anderer Version zugeordnet</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={assignDocs.isPending}>
            {assignDocs.isPending ? "Speichern..." : `${selected.size} Dokument(e) zuordnen`}
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
}: {
  productId: number;
  versionId: number;
  versionNumber: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: allAnalyses } = trpc.versions.getProductAnalysesWithVersions.useQuery({ productId });
  const { data: versionData } = trpc.versions.getWithDocuments.useQuery({ versionId });
  const assignedIds = new Set((versionData?.analyses ?? []).map((a) => a.id));
  const [selected, setSelected] = useState<Set<number>>(new Set(assignedIds));

  const assignAnalysis = trpc.versions.assignAnalysis.useMutation();

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
    toast.success("Analysen-Zuordnung aktualisiert");
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
          <DialogTitle>KI-Analysen zuordnen – Version {versionNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {(allAnalyses ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Analysen vorhanden.</p>
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
                  Analyse #{ana.id} – Score: {ana.overallScore ?? "–"}/100
                </p>
                <p className="text-xs text-muted-foreground">
                  {ana.modelUsed ?? "–"} · {new Date(ana.createdAt).toLocaleDateString("de-CH")}
                  {ana.productVersionId && ana.productVersionId !== versionId && (
                    <span className="ml-2 text-amber-600">Bereits anderer Version zugeordnet</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={assignAnalysis.isPending}>
            {assignAnalysis.isPending ? "Speichern..." : "Zuordnung speichern"}
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
}: {
  version: { id: number; versionNumber: string; label: string | null; notes: string | null; isActive: boolean; createdAt: Date };
  productId: number;
}) {
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
      toast.success("Version gelöscht");
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
            {version.isActive && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Aktiv</Badge>}
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
                if (confirm(`Version ${version.versionNumber} wirklich löschen?`)) {
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
                <FileText className="h-3.5 w-3.5" /> Dokumente ({versionData?.documents?.length ?? 0})
              </h4>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAssignDocs(true)}>
                Zuordnen
              </Button>
            </div>
            {(versionData?.documents ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Dokumente zugeordnet.</p>
            ) : (
              <div className="space-y-1">
                {(versionData?.documents ?? []).map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm p-1.5 rounded bg-muted/30">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{doc.fileName}</span>
                    <Badge variant="outline" className="text-xs flex-shrink-0">{docTypeLabel(doc.documentType)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analyses */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <BarChart2 className="h-3.5 w-3.5" /> KI-Analysen ({versionData?.analyses?.length ?? 0})
              </h4>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAssignAnalyses(true)}>
                Zuordnen
              </Button>
            </div>
            {(versionData?.analyses ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Analysen zugeordnet.</p>
            ) : (
              <div className="space-y-1">
                {(versionData?.analyses ?? []).map((ana) => (
                  <div key={ana.id} className="flex items-center gap-2 text-sm p-1.5 rounded bg-muted/30">
                    <BarChart2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1">Analyse #{ana.id}</span>
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
        <VersionDialog productId={productId} existing={version} onClose={() => setShowEdit(false)} />
      )}
      {showAssignDocs && (
        <AssignDocumentsDialog
          productId={productId}
          versionId={version.id}
          versionNumber={version.versionNumber}
          onClose={() => setShowAssignDocs(false)}
        />
      )}
      {showAssignAnalyses && (
        <AssignAnalysesDialog
          productId={productId}
          versionId={version.id}
          versionNumber={version.versionNumber}
          onClose={() => setShowAssignAnalyses(false)}
        />
      )}
    </Card>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export function ProductVersionsTab({ productId }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const { data: versions, isLoading } = trpc.versions.list.useQuery({ productId });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Produktversionen</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Versionsnummern und ordnen Sie Dokumente sowie KI-Analysen den jeweiligen Versionen zu.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Version anlegen
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Lade Versionen...</p>}

      {!isLoading && (versions ?? []).length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Tag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Noch keine Versionen angelegt</p>
            <p className="text-xs text-muted-foreground mt-1">
              Legen Sie eine Versionsnummer an und ordnen Sie Dokumente und Analysen zu.
            </p>
            <Button className="mt-4" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Erste Version anlegen
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(versions ?? []).map((v) => (
          <VersionCard key={v.id} version={v} productId={productId} />
        ))}
      </div>

      {showCreate && (
        <VersionDialog productId={productId} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
