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
import { useLang } from "@/lib/i18n";
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

const DOCUMENT_TYPE_KEYS = [
  "test_report",
  "declaration_of_conformity",
  "manual",
  "certificate",
  "product_image",
  "safety_image",
  "regulatory_document",
  "other",
];

const DATA_FIELD_KEYS = [
  "safety_text",
  "warning_text",
  "age_grading",
  "material_information",
  "usage_restrictions",
  "safety_instructions",
  "additional_notes",
];

const DATA_FIELD_LABELS: Record<string, { de: string; en: string }> = {
  safety_text: { de: "Sicherheitshinweis-Text", en: "Safety notice text" },
  warning_text: { de: "Warnhinweis-Text", en: "Warning text" },
  age_grading: { de: "Altersfreigabe", en: "Age grading" },
  material_information: { de: "Materialinformationen", en: "Material information" },
  usage_restrictions: { de: "Verwendungsbeschränkungen", en: "Usage restrictions" },
  safety_instructions: { de: "Sicherheitsanweisungen", en: "Safety instructions" },
  additional_notes: { de: "Zusätzliche Hinweise", en: "Additional notes" },
};

export default function TemplatesManager() {
  const { t, lang } = useLang();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

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
      toast.success(t.templates.templateCreated);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.templates.updateTemplate.useMutation({
    onSuccess: () => {
      utils.templates.listTemplates.invalidate();
      setEditingTemplate(null);
      resetForm();
      toast.success(t.templates.templateUpdated);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.templates.deleteTemplate.useMutation({
    onSuccess: () => {
      utils.templates.listTemplates.invalidate();
      toast.success(t.templates.templateDeleted);
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
      toast.error(lang === "de" ? "Bitte Name und Kategorie angeben" : "Please enter name and category");
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

  const docTypeLabel = (key: string) =>
    (t.docType as Record<string, string>)[key] ?? key;

  const dataFieldLabel = (key: string) =>
    DATA_FIELD_LABELS[key]?.[lang] ?? key;

  const catLabel = (cat: any) =>
    lang === "de" ? cat.labelDe : (cat.labelEn ?? cat.labelDe);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.templates.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.templates.subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={() => { resetForm(); setShowCreateTemplate(true); }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t.templates.newTemplate}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Category Sidebar */}
        <div className="col-span-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {lang === "de" ? "Kategorien" : "Categories"}
          </p>
          <Card className="p-1">
            <button
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                selectedCategoryId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
              onClick={() => setSelectedCategoryId(null)}
            >
              <Layers className="h-4 w-4" />
              {lang === "de" ? "Alle Kategorien" : "All categories"}
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
                  <span className="truncate">{catLabel(cat)}</span>
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
              {t.common.loading}
            </div>
          ) : !templates?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium">{t.templates.noTemplates}</p>
                <p className="text-sm">
                  {lang === "de" ? "Erstellen Sie die erste Vorlage für diese Kategorie." : "Create the first template for this category."}
                </p>
                <Button size="sm" onClick={() => { resetForm(); setShowCreateTemplate(true); }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t.templates.newTemplate}
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
                          <Badge variant="outline" className="text-xs">{catLabel(tpl)}</Badge>
                        </div>
                        {(lang === "de" ? tpl.descriptionDe : (tpl.descriptionEn ?? tpl.descriptionDe)) && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {lang === "de" ? tpl.descriptionDe : (tpl.descriptionEn ?? tpl.descriptionDe)}
                          </p>
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
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1.5">
                          {lang === "de" ? `Pflichtdokumente (${required.length})` : `Required docs (${required.length})`}
                        </p>
                        <div className="space-y-1">
                          {required.map((r) => (
                            <div key={r} className="flex items-center gap-1.5 text-xs">
                              <CheckCircle2 className="h-3 w-3 text-red-500" />
                              {docTypeLabel(r)}
                            </div>
                          ))}
                          {required.length === 0 && <p className="text-xs text-muted-foreground">{t.common.none}</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5">
                          {lang === "de" ? `Optionale Dokumente (${optional.length})` : `Optional docs (${optional.length})`}
                        </p>
                        <div className="space-y-1">
                          {optional.map((r) => (
                            <div key={r} className="flex items-center gap-1.5 text-xs">
                              <ChevronRight className="h-3 w-3 text-blue-400" />
                              {docTypeLabel(r)}
                            </div>
                          ))}
                          {optional.length === 0 && <p className="text-xs text-muted-foreground">{t.common.none}</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1.5">
                          {lang === "de" ? `Pflichtfelder (${dataFields.length})` : `Required fields (${dataFields.length})`}
                        </p>
                        <div className="space-y-1">
                          {dataFields.map((r) => (
                            <div key={r} className="flex items-center gap-1.5 text-xs">
                              <CheckCircle2 className="h-3 w-3 text-purple-500" />
                              {dataFieldLabel(r)}
                            </div>
                          ))}
                          {dataFields.length === 0 && <p className="text-xs text-muted-foreground">{t.common.none}</p>}
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
            <DialogTitle>
              {editingTemplate ? t.templates.editTemplate : t.templates.newTemplate}
            </DialogTitle>
            <DialogDescription>
              {lang === "de"
                ? "Definieren Sie, welche Dokumente und Datenfelder für diese Produktkategorie erforderlich sind."
                : "Define which documents and data fields are required for this product category."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{lang === "de" ? "Name der Vorlage *" : "Template name *"}</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={lang === "de" ? "z.B. Holzspielzeug Standard" : "e.g. Wooden Toy Standard"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.templates.templateCategory} *</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder={lang === "de" ? "Kategorie wählen..." : "Select category..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{catLabel(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{lang === "de" ? "Beschreibung (Deutsch)" : "Description (German)"}</Label>
                <Textarea value={formDescDe} onChange={(e) => setFormDescDe(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "de" ? "Beschreibung (Englisch)" : "Description (English)"}</Label>
                <Textarea value={formDescEn} onChange={(e) => setFormDescEn(e.target.value)} rows={2} />
              </div>
            </div>

            <Separator />

            {/* Document Requirements */}
            <div>
              <p className="text-sm font-semibold mb-3">
                {lang === "de" ? "Dokument-Anforderungen" : "Document requirements"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {DOCUMENT_TYPE_KEYS.map((key) => {
                  const isRequired = formRequired.includes(key);
                  const isOptional = formOptional.includes(key);
                  return (
                    <div key={key} className="flex items-center justify-between p-2 border rounded-lg bg-muted/20">
                      <span className="text-sm">{docTypeLabel(key)}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={isRequired}
                            onCheckedChange={() => {
                              toggleDoc(key, formRequired, setFormRequired);
                              if (!isRequired && isOptional) toggleDoc(key, formOptional, setFormOptional);
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-red-600 font-medium">
                            {lang === "de" ? "Pflicht" : "Required"}
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={isOptional}
                            onCheckedChange={() => {
                              toggleDoc(key, formOptional, setFormOptional);
                              if (!isOptional && isRequired) toggleDoc(key, formRequired, setFormRequired);
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-blue-600 font-medium">
                            {lang === "de" ? "Optional" : "Optional"}
                          </span>
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
              <p className="text-sm font-semibold mb-3">
                {lang === "de" ? "Pflicht-Datenfelder" : "Required data fields"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DATA_FIELD_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/40">
                    <Checkbox
                      checked={formDataFields.includes(key)}
                      onCheckedChange={() => toggleDoc(key, formDataFields, setFormDataFields)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-sm">{dataFieldLabel(key)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateTemplate(false); setEditingTemplate(null); resetForm(); }}>
              {t.action.cancel}
            </Button>
            <Button onClick={handleSave} disabled={isPending} className="gap-2">
              {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {editingTemplate ? t.action.saveChanges : t.templates.newTemplate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
