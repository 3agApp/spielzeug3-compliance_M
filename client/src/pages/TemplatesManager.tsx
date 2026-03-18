import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderOpen,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────
const DOCUMENT_TYPES = [
  { key: "test_report", labelDe: "Testbericht", labelEn: "Test Report" },
  { key: "declaration_of_conformity", labelDe: "Konformitätserklärung", labelEn: "Declaration of Conformity" },
  { key: "manual", labelDe: "Handbuch / Bedienungsanleitung", labelEn: "Manual / Instructions" },
  { key: "certificate", labelDe: "Zertifikat (CE, EN 71 etc.)", labelEn: "Certificate (CE, EN 71 etc.)" },
  { key: "product_image", labelDe: "Produktbild", labelEn: "Product Image" },
  { key: "safety_image", labelDe: "Sicherheitsbild / Piktogramm", labelEn: "Safety Image / Pictogram" },
  { key: "regulatory_document", labelDe: "Regulatorisches Dokument", labelEn: "Regulatory Document" },
  { key: "other", labelDe: "Sonstiges", labelEn: "Other" },
];

const DATA_FIELDS = [
  { key: "safety_text", labelDe: "Sicherheitshinweis-Text" },
  { key: "warning_text", labelDe: "Warnhinweis-Text" },
  { key: "age_grading", labelDe: "Altersfreigabe" },
  { key: "material_information", labelDe: "Materialinformationen" },
  { key: "usage_restrictions", labelDe: "Verwendungsbeschränkungen" },
  { key: "safety_instructions", labelDe: "Sicherheitsanweisungen" },
  { key: "additional_notes", labelDe: "Zusätzliche Hinweise" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TemplatesManager() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescDe, setFormDescDe] = useState("");
  const [formDescEn, setFormDescEn] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formRequired, setFormRequired] = useState<string[]>([]);
  const [formOptional, setFormOptional] = useState<string[]>([]);
  const [formDataFields, setFormDataFields] = useState<string[]>([]);

  const utils = trpc.useUtils();

  const { data: categories, isLoading: catLoading } = trpc.templates.listCategories.useQuery();
  const { data: templates, isLoading: tplLoading } = trpc.templates.listTemplates.useQuery(
    selectedCategoryId ? { categoryId: selectedCategoryId } : undefined
  );

  const createMutation = trpc.templates.createTemplate.useMutation({
    onSuccess: () => {
      utils.templates.listTemplates.invalidate();
      setShowCreateTemplate(false);
      resetForm();
      toast.success("Vorlage erstellt");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.templates.updateTemplate.useMutation({
    onSuccess: () => {
      utils.templates.listTemplates.invalidate();
      setEditingTemplate(null);
      resetForm();
      toast.success("Vorlage aktualisiert");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.templates.deleteTemplate.useMutation({
    onSuccess: () => {
      utils.templates.listTemplates.invalidate();
      toast.success("Vorlage deaktiviert");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setFormName("");
    setFormDescDe("");
    setFormDescEn("");
    setFormCategoryId("");
    setFormRequired([]);
    setFormOptional([]);
    setFormDataFields([]);
  }

  function openEdit(tpl: any) {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormDescDe(tpl.descriptionDe ?? "");
    setFormDescEn(tpl.descriptionEn ?? "");
    setFormCategoryId(String(tpl.categoryId));
    setFormRequired((tpl.requiredDocuments as string[]) ?? []);
    setFormOptional((tpl.optionalDocuments as string[]) ?? []);
    setFormDataFields((tpl.requiredDataFields as string[]) ?? []);
  }

  function toggleDoc(key: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  function handleSave() {
    if (!formName || !formCategoryId) {
      toast.error("Bitte Name und Kategorie angeben");
      return;
    }
    const payload = {
      categoryId: Number(formCategoryId),
      name: formName,
      descriptionDe: formDescDe || undefined,
      descriptionEn: formDescEn || undefined,
      requiredDocuments: formRequired,
      optionalDocuments: formOptional,
      requiredDataFields: formDataFields,
    };
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isDialogOpen = showCreateTemplate || !!editingTemplate;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produktvorlagen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Definieren Sie Anforderungs-Templates pro Produktkategorie – diese werden beim Anlegen neuer Produkte automatisch angewendet
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { resetForm(); setShowCreateTemplate(true); }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Neue Vorlage
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Category Sidebar */}
        <div className="col-span-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Kategorien</p>
          <Card className="p-1">
            <button
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                selectedCategoryId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
              onClick={() => setSelectedCategoryId(null)}
            >
              <Layers className="h-4 w-4" />
              Alle Kategorien
            </button>
            {catLoading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              categories?.map((cat) => (
                <button
                  key={cat.id}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    selectedCategoryId === cat.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="truncate">{cat.labelDe}</span>
                </button>
              ))
            )}
          </Card>
        </div>

        {/* Templates List */}
        <div className="col-span-9 space-y-3">
          {tplLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Lade Vorlagen...
            </div>
          ) : !templates?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium">Keine Vorlagen gefunden</p>
                <p className="text-sm">Erstellen Sie die erste Vorlage für diese Kategorie.</p>
                <Button size="sm" onClick={() => { resetForm(); setShowCreateTemplate(true); }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Vorlage erstellen
                </Button>
              </CardContent>
            </Card>
          ) : (
            templates.map((tpl) => {
              const required = (tpl.requiredDocuments as string[]) ?? [];
              const optional = (tpl.optionalDocuments as string[]) ?? [];
              const dataFields = (tpl.requiredDataFields as string[]) ?? [];
              return (
                <Card key={tpl.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{tpl.name}</CardTitle>
                          <Badge variant="outline" className="text-xs">{tpl.categoryLabelDe}</Badge>
                        </div>
                        {tpl.descriptionDe && (
                          <p className="text-sm text-muted-foreground mt-1">{tpl.descriptionDe}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(tpl)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteMutation.mutate({ id: tpl.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1.5">
                          Pflichtdokumente ({required.length})
                        </p>
                        <div className="space-y-1">
                          {required.map((r) => (
                            <div key={r} className="flex items-center gap-1.5 text-xs">
                              <CheckCircle2 className="h-3 w-3 text-red-500" />
                              {DOCUMENT_TYPES.find((d) => d.key === r)?.labelDe ?? r}
                            </div>
                          ))}
                          {required.length === 0 && <p className="text-xs text-muted-foreground">Keine</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5">
                          Optionale Dokumente ({optional.length})
                        </p>
                        <div className="space-y-1">
                          {optional.map((r) => (
                            <div key={r} className="flex items-center gap-1.5 text-xs">
                              <ChevronRight className="h-3 w-3 text-blue-400" />
                              {DOCUMENT_TYPES.find((d) => d.key === r)?.labelDe ?? r}
                            </div>
                          ))}
                          {optional.length === 0 && <p className="text-xs text-muted-foreground">Keine</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1.5">
                          Pflichtfelder ({dataFields.length})
                        </p>
                        <div className="space-y-1">
                          {dataFields.map((r) => (
                            <div key={r} className="flex items-center gap-1.5 text-xs">
                              <CheckCircle2 className="h-3 w-3 text-purple-500" />
                              {DATA_FIELDS.find((d) => d.key === r)?.labelDe ?? r}
                            </div>
                          ))}
                          {dataFields.length === 0 && <p className="text-xs text-muted-foreground">Keine</p>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) { setShowCreateTemplate(false); setEditingTemplate(null); resetForm(); }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Vorlage bearbeiten" : "Neue Vorlage erstellen"}</DialogTitle>
            <DialogDescription>
              Definieren Sie, welche Dokumente und Datenfelder für diese Produktkategorie erforderlich sind.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name der Vorlage *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="z.B. Holzspielzeug Standard" />
              </div>
              <div className="space-y-1.5">
                <Label>Kategorie *</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.labelDe}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Beschreibung (Deutsch)</Label>
                <Textarea value={formDescDe} onChange={(e) => setFormDescDe(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Beschreibung (Englisch)</Label>
                <Textarea value={formDescEn} onChange={(e) => setFormDescEn(e.target.value)} rows={2} />
              </div>
            </div>

            <Separator />

            {/* Document Requirements */}
            <div>
              <p className="text-sm font-semibold mb-3">Dokument-Anforderungen</p>
              <div className="grid grid-cols-2 gap-3">
                {DOCUMENT_TYPES.map((doc) => {
                  const isRequired = formRequired.includes(doc.key);
                  const isOptional = formOptional.includes(doc.key);
                  return (
                    <div key={doc.key} className="flex items-center justify-between p-2 border rounded-lg bg-muted/20">
                      <span className="text-sm">{doc.labelDe}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={isRequired}
                            onCheckedChange={() => {
                              toggleDoc(doc.key, formRequired, setFormRequired);
                              if (!isRequired && isOptional) toggleDoc(doc.key, formOptional, setFormOptional);
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-red-600 font-medium">Pflicht</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={isOptional}
                            onCheckedChange={() => {
                              toggleDoc(doc.key, formOptional, setFormOptional);
                              if (!isOptional && isRequired) toggleDoc(doc.key, formRequired, setFormRequired);
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-blue-600 font-medium">Optional</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Data Fields */}
            <div>
              <p className="text-sm font-semibold mb-3">Pflicht-Datenfelder</p>
              <div className="grid grid-cols-2 gap-2">
                {DATA_FIELDS.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/40">
                    <Checkbox
                      checked={formDataFields.includes(field.key)}
                      onCheckedChange={() => toggleDoc(field.key, formDataFields, setFormDataFields)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-sm">{field.labelDe}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateTemplate(false); setEditingTemplate(null); resetForm(); }}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isPending} className="gap-2">
              {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {editingTemplate ? "Änderungen speichern" : "Vorlage erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
