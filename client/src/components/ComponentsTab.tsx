import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type MaterialType = "wood" | "metal" | "plastic" | "textile" | "electronic" | "paint_coating" | "rubber" | "glass" | "other";
type DocType = "test_report" | "declaration_of_conformity" | "material_certificate" | "reach_declaration" | "rohs_declaration" | "certificate" | "regulatory_document" | "other";

const MATERIAL_LABELS: Record<MaterialType, { de: string; en: string }> = {
  wood: { de: "Holz", en: "Wood" },
  metal: { de: "Metall", en: "Metal" },
  plastic: { de: "Kunststoff", en: "Plastic" },
  textile: { de: "Textil", en: "Textile" },
  electronic: { de: "Elektronik", en: "Electronic" },
  paint_coating: { de: "Farbe/Beschichtung", en: "Paint/Coating" },
  rubber: { de: "Gummi", en: "Rubber" },
  glass: { de: "Glas", en: "Glass" },
  other: { de: "Sonstiges", en: "Other" },
};

const DOC_TYPE_LABELS: Record<DocType, { de: string; en: string }> = {
  test_report: { de: "Testbericht", en: "Test Report" },
  declaration_of_conformity: { de: "Konformitätserklärung", en: "Declaration of Conformity" },
  material_certificate: { de: "Materialzertifikat", en: "Material Certificate" },
  reach_declaration: { de: "REACH-Erklärung", en: "REACH Declaration" },
  rohs_declaration: { de: "RoHS-Erklärung", en: "RoHS Declaration" },
  certificate: { de: "Zertifikat", en: "Certificate" },
  regulatory_document: { de: "Regulatorisches Dokument", en: "Regulatory Document" },
  other: { de: "Sonstiges", en: "Other" },
};

const COMMON_STANDARDS = ["EN 71-1", "EN 71-2", "EN 71-3", "EN 71-7", "EN 62115", "REACH", "RoHS", "CE", "FSC", "PEFC", "ISO 8124", "ASTM F963"];

// ─── i18n strings ─────────────────────────────────────────────────────────────
const UI: Record<"de" | "en", Record<string, string>> = {
  de: {
    components: "Komponenten",
    totalDocs: "Dokumente gesamt",
    approved: "Genehmigt",
    pending: "Ausstehend",
    addComponent: "Komponente hinzufügen",
    noComponents: "Keine Komponenten definiert",
    noComponentsDesc: "Fügen Sie die einzelnen Bestandteile dieses Produkts hinzu und hinterlegen Sie die zugehörigen Testberichte und Zertifikate pro Komponente.",
    addFirstComponent: "Erste Komponente hinzufügen",
    newComponent: "Neue Komponente hinzufügen",
    editComponent: "Komponente bearbeiten",
    uploadDocument: "Dokument hochladen",
    cancel: "Abbrechen",
    create: "Erstellen",
    save: "Speichern",
    creating: "Wird erstellt…",
    saving: "Wird gespeichert…",
    uploading: "Wird hochgeladen…",
    upload: "Hochladen",
    name: "Name",
    description: "Beschreibung",
    materialType: "Materialtyp",
    partNumber: "Teilenummer",
    componentSupplier: "Komponenten-Lieferant",
    namePlaceholder: "z.B. Holzrad 60mm",
    descPlaceholder: "Kurze Beschreibung der Komponente…",
    partNumberPlaceholder: "z.B. HW-60-OAK",
    supplierPlaceholder: "z.B. Holzwerk Müller GmbH",
    selectMaterial: "Auswählen…",
    noMaterial: "– Kein –",
    docType: "Dokumenttyp",
    standard: "Norm/Standard",
    expiryDate: "Ablaufdatum (optional)",
    file: "Datei",
    clickToSelect: "Klicken zum Auswählen (PDF, max. 16 MB)",
    noStandard: "– Keine –",
    noDocs: "Noch keine Dokumente für diese Komponente",
    dok: "Dok.",
    approvedCount: "genehmigt",
    expiry: "Ablauf",
    expired: "Abgelaufen",
    approve: "Genehmigen",
    reject: "Ablehnen",
    edit: "Bearbeiten",
    remove: "Entfernen",
    rejectPrompt: "Ablehnungsgrund (optional):",
    deleteDocConfirm: "Dokument wirklich löschen?",
    deleteComponentConfirm: "wirklich entfernen?",
    loading: "Lade Komponenten…",
    nameRequired: "Name ist erforderlich",
    selectFile: "Bitte eine Datei auswählen",
    created: "Komponente erstellt",
    updated: "Komponente aktualisiert",
    deleted: "Komponente entfernt",
    docUploaded: "Dokument hochgeladen",
    docDeleted: "Dokument gelöscht",
    reviewSaved: "Bewertung gespeichert",
    statusApproved: "Genehmigt",
    statusRejected: "Abgelehnt",
    statusPending: "Ausstehend",
  },
  en: {
    components: "Components",
    totalDocs: "Total Documents",
    approved: "Approved",
    pending: "Pending",
    addComponent: "Add Component",
    noComponents: "No components defined",
    noComponentsDesc: "Add the individual parts of this product and attach the relevant test reports and certificates per component.",
    addFirstComponent: "Add First Component",
    newComponent: "Add New Component",
    editComponent: "Edit Component",
    uploadDocument: "Upload Document",
    cancel: "Cancel",
    create: "Create",
    save: "Save",
    creating: "Creating…",
    saving: "Saving…",
    uploading: "Uploading…",
    upload: "Upload",
    name: "Name",
    description: "Description",
    materialType: "Material Type",
    partNumber: "Part Number",
    componentSupplier: "Component Supplier",
    namePlaceholder: "e.g. Wooden Wheel 60mm",
    descPlaceholder: "Brief description of the component…",
    partNumberPlaceholder: "e.g. HW-60-OAK",
    supplierPlaceholder: "e.g. Müller Woodworks GmbH",
    selectMaterial: "Select…",
    noMaterial: "– None –",
    docType: "Document Type",
    standard: "Standard / Norm",
    expiryDate: "Expiry Date (optional)",
    file: "File",
    clickToSelect: "Click to select (PDF, max. 16 MB)",
    noStandard: "– None –",
    noDocs: "No documents for this component yet",
    dok: "Doc.",
    approvedCount: "approved",
    expiry: "Expires",
    expired: "Expired",
    approve: "Approve",
    reject: "Reject",
    edit: "Edit",
    remove: "Remove",
    rejectPrompt: "Rejection reason (optional):",
    deleteDocConfirm: "Delete this document?",
    deleteComponentConfirm: "really remove?",
    loading: "Loading components…",
    nameRequired: "Name is required",
    selectFile: "Please select a file",
    created: "Component created",
    updated: "Component updated",
    deleted: "Component removed",
    docUploaded: "Document uploaded",
    docDeleted: "Document deleted",
    reviewSaved: "Review saved",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    statusPending: "Pending",
  },
};

// ─── Review status badge ──────────────────────────────────────────────────────
function ReviewBadge({ status, lang }: { status: string; lang: "de" | "en" }) {
  const u = UI[lang];
  if (status === "approved") return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />{u.statusApproved}</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />{u.statusRejected}</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />{u.statusPending}</Badge>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface ComponentsTabProps {
  productId: number;
  readOnly?: boolean;
}

export default function ComponentsTab({ productId, readOnly = false }: ComponentsTabProps) {
  const { lang: language } = useLang();
  const lang = (language as "de" | "en") === "en" ? "en" : "de";
  const u = UI[lang];
  const { user } = useAuth();
  const role = (user as any)?.complianceRole ?? "internal_employee";
  const canEdit = !readOnly && ["supplier", "internal_employee", "compliance_manager", "administrator"].includes(role);
  const canReview = ["compliance_manager", "administrator"].includes(role);

  const utils = trpc.useUtils();

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: components = [], isLoading } = trpc.components.listByProduct.useQuery({ productId });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = trpc.components.create.useMutation({
    onSuccess: () => { utils.components.listByProduct.invalidate({ productId }); toast.success(u.created); setShowCreateDialog(false); resetForm(); },
    onError: (e) => toast.error(translateError(e.message, language)),
  });
  const updateMutation = trpc.components.update.useMutation({
    onSuccess: () => { utils.components.listByProduct.invalidate({ productId }); toast.success(u.updated); setEditingComponent(null); },
    onError: (e) => toast.error(translateError(e.message, language)),
  });
  const deleteMutation = trpc.components.delete.useMutation({
    onSuccess: () => { utils.components.listByProduct.invalidate({ productId }); toast.success(u.deleted); },
    onError: (e) => toast.error(translateError(e.message, language)),
  });
  const uploadDocMutation = trpc.components.uploadDocument.useMutation({
    onSuccess: () => { utils.components.listByProduct.invalidate({ productId }); toast.success(u.docUploaded); setUploadingForComponent(null); resetDocForm(); },
    onError: (e) => toast.error(translateError(e.message, language)),
  });
  const deleteDocMutation = trpc.components.deleteDocument.useMutation({
    onSuccess: () => { utils.components.listByProduct.invalidate({ productId }); toast.success(u.docDeleted); },
    onError: (e) => toast.error(translateError(e.message, language)),
  });
  const reviewDocMutation = trpc.components.reviewDocument.useMutation({
    onSuccess: () => { utils.components.listByProduct.invalidate({ productId }); toast.success(u.reviewSaved); },
    onError: (e) => toast.error(translateError(e.message, language)),
  });

  // ── Local state ──────────────────────────────────────────────────────────────
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingComponent, setEditingComponent] = useState<any>(null);
  const [uploadingForComponent, setUploadingForComponent] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({ name: "", description: "", materialType: "" as MaterialType | "", supplierName: "", partNumber: "" });
  const [docForm, setDocForm] = useState({ documentType: "test_report" as DocType, standard: "", expiryDate: "", fileName: "", fileBase64: "", mimeType: "", fileSizeBytes: 0 });

  const resetForm = () => setForm({ name: "", description: "", materialType: "", supplierName: "", partNumber: "" });
  const resetDocForm = () => setDocForm({ documentType: "test_report", standard: "", expiryDate: "", fileName: "", fileBase64: "", mimeType: "", fileSizeBytes: 0 });

  // ── File selection ────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setDocForm((f) => ({ ...f, fileName: file.name, fileBase64: base64, mimeType: file.type, fileSizeBytes: file.size }));
    };
    reader.readAsDataURL(file);
  };

  // ── Submit handlers ───────────────────────────────────────────────────────────
  const handleCreateComponent = () => {
    if (!form.name.trim()) return toast.error(u.nameRequired);
    createMutation.mutate({
      productId,
      name: form.name.trim(),
      description: form.description || undefined,
      materialType: (form.materialType as MaterialType) || undefined,
      supplierName: form.supplierName || undefined,
      partNumber: form.partNumber || undefined,
    });
  };

  const handleUpdateComponent = () => {
    if (!editingComponent) return;
    updateMutation.mutate({
      id: editingComponent.id,
      name: form.name.trim(),
      description: form.description || undefined,
      materialType: (form.materialType as MaterialType) || undefined,
      supplierName: form.supplierName || undefined,
      partNumber: form.partNumber || undefined,
    });
  };

  const handleUploadDoc = () => {
    if (!uploadingForComponent || !docForm.fileBase64) return toast.error(u.selectFile);
    uploadDocMutation.mutate({
      componentId: uploadingForComponent,
      documentType: docForm.documentType,
      standard: docForm.standard || undefined,
      fileName: docForm.fileName,
      fileBase64: docForm.fileBase64,
      mimeType: docForm.mimeType,
      fileSizeBytes: docForm.fileSizeBytes,
      expiryDate: docForm.expiryDate || undefined,
    });
  };

  const openEditDialog = (component: any) => {
    setForm({
      name: component.name,
      description: component.description ?? "",
      materialType: component.materialType ?? "",
      supplierName: component.supplierName ?? "",
      partNumber: component.partNumber ?? "",
    });
    setEditingComponent(component);
  };

  // ── Summary stats ─────────────────────────────────────────────────────────────
  const totalDocs = components.reduce((s, c) => s + (c.documentCount ?? 0), 0);
  const approvedDocs = components.reduce((s, c) => s + (c.approvedDocumentCount ?? 0), 0);
  const pendingDocs = components.reduce((s, c) => s + (c.pendingDocumentCount ?? 0), 0);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground">{u.loading}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{components.length}</div>
            <div className="text-xs text-muted-foreground">{u.components}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{totalDocs}</div>
            <div className="text-xs text-muted-foreground">{u.totalDocs}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{approvedDocs}</div>
            <div className="text-xs text-muted-foreground">{u.approved}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{pendingDocs}</div>
            <div className="text-xs text-muted-foreground">{u.pending}</div>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            {u.addComponent}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {components.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-foreground mb-1">{u.noComponents}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              {u.noComponentsDesc}
            </p>
            {canEdit && (
              <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                {u.addFirstComponent}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Component list as Accordion */}
      {components.length > 0 && (
        <Accordion type="multiple" className="space-y-3">
          {components.map((component) => (
            <ComponentAccordionItem
              key={component.id}
              component={component}
              canEdit={canEdit}
              canReview={canReview}
              lang={lang}
              u={u}
              onEdit={() => openEditDialog(component)}
              onDelete={() => {
                if (confirm(`"${component.name}" ${u.deleteComponentConfirm}`)) {
                  deleteMutation.mutate({ id: component.id });
                }
              }}
              onUpload={() => { resetDocForm(); setUploadingForComponent(component.id); }}
              onDeleteDoc={(docId) => {
                if (confirm(u.deleteDocConfirm)) deleteDocMutation.mutate({ documentId: docId });
              }}
              onReviewDoc={(docId, status, note) => reviewDocMutation.mutate({ documentId: docId, reviewStatus: status, reviewNote: note })}
              productId={productId}
            />
          ))}
        </Accordion>
      )}

      {/* Create Component Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{u.newComponent}</DialogTitle>
          </DialogHeader>
          <ComponentForm form={form} setForm={setForm} lang={lang} u={u} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{u.cancel}</Button>
            <Button onClick={handleCreateComponent} disabled={createMutation.isPending}>
              {createMutation.isPending ? u.creating : u.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Component Dialog */}
      <Dialog open={!!editingComponent} onOpenChange={(o) => !o && setEditingComponent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{u.editComponent}</DialogTitle>
          </DialogHeader>
          <ComponentForm form={form} setForm={setForm} lang={lang} u={u} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingComponent(null)}>{u.cancel}</Button>
            <Button onClick={handleUpdateComponent} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? u.saving : u.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadingForComponent !== null} onOpenChange={(o) => !o && setUploadingForComponent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{u.uploadDocument}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{u.docType} *</Label>
                <Select value={docForm.documentType} onValueChange={(v) => setDocForm((f) => ({ ...f, documentType: v as DocType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((k) => (
                      <SelectItem key={k} value={k}>{DOC_TYPE_LABELS[k][lang]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{u.standard}</Label>
                <Select value={docForm.standard} onValueChange={(v) => setDocForm((f) => ({ ...f, standard: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="e.g. EN 71-3" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{u.noStandard}</SelectItem>
                    {COMMON_STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{u.expiryDate}</Label>
              <Input type="date" value={docForm.expiryDate} onChange={(e) => setDocForm((f) => ({ ...f, expiryDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{u.file} *</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {docForm.fileName ? (
                  <div className="flex items-center justify-center gap
-2 text-sm">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-medium">{docForm.fileName}</span>
                    <span className="text-muted-foreground">({(docForm.fileSizeBytes / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    <Upload className="w-6 h-6 mx-auto mb-2" />
                    {u.clickToSelect}
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileSelect} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadingForComponent(null)}>{u.cancel}</Button>
            <Button onClick={handleUploadDoc} disabled={uploadDocMutation.isPending || !docForm.fileBase64}>
              {uploadDocMutation.isPending ? u.uploading : u.upload}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Component Form ───────────────────────────────────────────────────────────
function ComponentForm({ form, setForm, lang, u }: { form: any; setForm: any; lang: "de" | "en"; u: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{u.name} *</Label>
        <Input placeholder={u.namePlaceholder} value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>{u.description}</Label>
        <Textarea placeholder={u.descPlaceholder} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{u.materialType}</Label>
          <Select value={form.materialType || "_none"} onValueChange={(v) => setForm((f: any) => ({ ...f, materialType: v === "_none" ? "" : v }))}>
            <SelectTrigger><SelectValue placeholder={u.selectMaterial} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{u.noMaterial}</SelectItem>
              {(Object.keys(MATERIAL_LABELS) as (keyof typeof MATERIAL_LABELS)[]).map((k) => (
                <SelectItem key={k} value={k}>{MATERIAL_LABELS[k][lang]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{u.partNumber}</Label>
          <Input placeholder={u.partNumberPlaceholder} value={form.partNumber} onChange={(e) => setForm((f: any) => ({ ...f, partNumber: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{u.componentSupplier}</Label>
        <Input placeholder={u.supplierPlaceholder} value={form.supplierName} onChange={(e) => setForm((f: any) => ({ ...f, supplierName: e.target.value }))} />
      </div>
    </div>
  );
}

// ─── Accordion Item for each component ───────────────────────────────────────
function ComponentAccordionItem({
  component,
  canEdit,
  canReview,
  lang,
  u,
  onEdit,
  onDelete,
  onUpload,
  onDeleteDoc,
  onReviewDoc,
  productId,
}: {
  component: any;
  canEdit: boolean;
  canReview: boolean;
  lang: "de" | "en";
  u: Record<string, string>;
  onEdit: () => void;
  onDelete: () => void;
  onUpload: () => void;
  onDeleteDoc: (docId: number) => void;
  onReviewDoc: (docId: number, status: "approved" | "rejected", note: string | undefined) => void;
  productId: number;
}) {
  const { data: componentWithDocs } = trpc.components.getWithDocuments.useQuery(
    { componentId: component.id },
    { staleTime: 30_000 }
  );

  const docs = componentWithDocs?.documents ?? [];
  const approvedCount = docs.filter((d: any) => d.reviewStatus === "approved").length;
  const totalCount = docs.length;
  const completionPct = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  const materialLabel = component.materialType
    ? (MATERIAL_LABELS[component.materialType as MaterialType]?.[lang] ?? component.materialType)
    : null;

  const dateLocale = lang === "de" ? "de-CH" : "en-GB";

  return (
    <AccordionItem value={`component-${component.id}`} className="border rounded-lg overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/30">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{component.name}</span>
              {materialLabel && (
                <Badge variant="outline" className="text-xs">{materialLabel}</Badge>
              )}
              {component.partNumber && (
                <span className="text-xs text-muted-foreground font-mono">{component.partNumber}</span>
              )}
            </div>
            {component.supplierName && (
              <div className="text-xs text-muted-foreground mt-0.5">{component.supplierName}</div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 mr-2">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{totalCount} {u.dok}</div>
              <div className="text-xs font-medium text-foreground">{approvedCount} {u.approvedCount}</div>
            </div>
            {totalCount > 0 && (
              <div className="w-16">
                <Progress value={completionPct} className="h-1.5" />
              </div>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-2">
        {/* Component description */}
        {component.description && (
          <p className="text-sm text-muted-foreground mb-4 italic">{component.description}</p>
        )}

        {/* Documents list */}
        <div className="space-y-2 mb-4">
          {docs.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
              {u.noDocs}
            </div>
          )}
          {docs.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{doc.fileName}</span>
                  {doc.standard && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{doc.standard}</Badge>
                  )}
                  <ReviewBadge status={doc.reviewStatus} lang={lang} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {DOC_TYPE_LABELS[doc.documentType as DocType]?.[lang] ?? doc.documentType}
                  {doc.expiryDate && (
                    <span className="ml-2">
                      · {u.expiry}: {new Date(doc.expiryDate).toLocaleDateString(dateLocale)}
                      {new Date(doc.expiryDate) < new Date() && (
                        <span className="text-red-500 ml-1"><AlertTriangle className="w-3 h-3 inline" /> {u.expired}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
                {canReview && doc.reviewStatus === "pending" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => onReviewDoc(doc.id, "approved", undefined)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />{u.approve}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        const note = prompt(u.rejectPrompt) ?? undefined;
                        onReviewDoc(doc.id, "rejected", note);
                      }}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />{u.reject}
                    </Button>
                  </>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => onDeleteDoc(doc.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onUpload}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {u.uploadDocument}
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              {u.edit}
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {u.remove}
            </Button>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
