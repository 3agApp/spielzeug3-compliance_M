import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Package,
  Tag,
  FileCheck,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Layers,
  AlertCircle,
} from "lucide-react";

// Requirement type labels
const REQ_LABELS: Record<string, { de: string; en: string }> = {
  test_report:               { de: "Testbericht",                   en: "Test Report" },
  declaration_of_conformity: { de: "Konformitätserklärung",         en: "Declaration of Conformity" },
  manual:                    { de: "Bedienungsanleitung",            en: "Manual" },
  certificate:               { de: "Zertifikat",                    en: "Certificate" },
  product_image:             { de: "Produktbild",                   en: "Product Image" },
  safety_image:              { de: "Sicherheitsbild",               en: "Safety Image" },
  regulatory_document:       { de: "Regulatorisches Dokument",      en: "Regulatory Document" },
  safety_text:               { de: "Sicherheitstext",               en: "Safety Text" },
  warning_text:              { de: "Warnhinweis",                   en: "Warning Text" },
  age_grading:               { de: "Altersangabe",                  en: "Age Grading" },
  material_information:      { de: "Materialangaben",               en: "Material Information" },
  usage_restrictions:        { de: "Verwendungseinschränkungen",    en: "Usage Restrictions" },
  safety_instructions:       { de: "Sicherheitshinweise",           en: "Safety Instructions" },
  additional_notes:          { de: "Zusätzliche Hinweise",          en: "Additional Notes" },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

type Step = "details" | "category" | "template" | "confirm";

export default function CreateProductDialog({ open, onOpenChange, onSuccess }: Props) {
  const { lang } = useLang();
  const { user } = useAuth();

  // Steps
  const [step, setStep] = useState<Step>("details");

  // Form state
  const [productName, setProductName]                     = useState("");
  const [supplierId, setSupplierId]                       = useState<number | null>(null);
  const [internalArticleNumber, setInternalArticleNumber] = useState("");
  const [supplierArticleNumber, setSupplierArticleNumber] = useState("");
  const [orderNumber, setOrderNumber]                     = useState("");
  const [ean, setEan]                                     = useState("");
  const [brand, setBrand]                                 = useState("");
  const [selectedCategoryId, setSelectedCategoryId]       = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId]       = useState<number | null>(null);

  // Queries
  const suppliersQuery   = trpc.suppliers.list.useQuery();
  const categoriesQuery  = trpc.templates.listCategories.useQuery();
  const templatesQuery   = trpc.templates.listTemplates.useQuery(
    selectedCategoryId ? { categoryId: selectedCategoryId } : {},
    { enabled: step === "template" || step === "confirm" }
  );

  const utils = trpc.useUtils();
  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success(lang === "de" ? "Produkt erfolgreich angelegt" : "Product created successfully");
      utils.products.list.invalidate();
      utils.products.getDashboardStats.invalidate();
      handleClose();
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Auto-set supplier for supplier role
  useEffect(() => {
    if (user?.supplierId) {
      setSupplierId(user.supplierId);
    }
  }, [user]);

  // Reset on close
  const handleClose = () => {
    setStep("details");
    setProductName("");
    setSupplierId(user?.supplierId ?? null);
    setInternalArticleNumber("");
    setSupplierArticleNumber("");
    setOrderNumber("");
    setEan("");
    setBrand("");
    setSelectedCategoryId(null);
    setSelectedTemplateId(null);
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!productName.trim() || !supplierId) return;
    createMutation.mutate({
      productName: productName.trim(),
      supplierId,
      internalArticleNumber: internalArticleNumber || undefined,
      supplierArticleNumber: supplierArticleNumber || undefined,
      orderNumber: orderNumber || undefined,
      ean: ean || undefined,
      brand: brand || undefined,
      categoryId: selectedCategoryId ?? undefined,
      templateId: selectedTemplateId ?? undefined,
    });
  };

  const selectedTemplate = templatesQuery.data?.find((t) => t.id === selectedTemplateId);
  const selectedCategory = categoriesQuery.data?.find((c) => c.id === selectedCategoryId);

  const isDetailsValid = productName.trim().length > 0 && supplierId !== null;

  // Step labels
  const stepLabels = {
    de: { details: "Produktdaten", category: "Kategorie", template: "Vorlage", confirm: "Bestätigen" },
    en: { details: "Product Data", category: "Category",  template: "Template", confirm: "Confirm" },
  };

  const steps: Step[] = ["details", "category", "template", "confirm"];
  const currentStepIndex = steps.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {lang === "de" ? "Neues Produkt anlegen" : "Create New Product"}
          </DialogTitle>
          <DialogDescription>
            {lang === "de"
              ? "Füllen Sie die Produktdaten aus und wählen Sie optional eine Vorlage für automatische Anforderungen."
              : "Fill in the product details and optionally select a template for automatic requirements."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 py-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : i < currentStepIndex
                  ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
              }`}>
                {i < currentStepIndex ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {stepLabels[lang][s]}
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* ── Step 1: Product Details ── */}
        {step === "details" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="productName" className="text-sm font-medium">
                  {lang === "de" ? "Produktname" : "Product Name"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder={lang === "de" ? "z.B. Holzeisenbahn Set Deluxe" : "e.g. Wooden Train Set Deluxe"}
                  autoFocus
                />
              </div>

              {/* Supplier – only show if not a supplier user */}
              {!user?.supplierId && (
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">
                    {lang === "de" ? "Lieferant" : "Supplier"} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={supplierId?.toString() ?? ""}
                    onValueChange={(v) => setSupplierId(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={lang === "de" ? "Lieferant auswählen…" : "Select supplier…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliersQuery.data?.map((s: any) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  {lang === "de" ? "Interne Artikelnummer" : "Internal Article No."}
                </Label>
                <Input
                  value={internalArticleNumber}
                  onChange={(e) => setInternalArticleNumber(e.target.value)}
                  placeholder="ART-10001"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  {lang === "de" ? "Lieferanten-Artikelnummer" : "Supplier Article No."}
                </Label>
                <Input
                  value={supplierArticleNumber}
                  onChange={(e) => setSupplierArticleNumber(e.target.value)}
                  placeholder="SUP-001"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  {lang === "de" ? "Bestellnummer" : "Order Number"}
                </Label>
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="ORD-2024-001"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">EAN</Label>
                <Input
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  placeholder="4012345678901"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm font-medium">
                  {lang === "de" ? "Marke" : "Brand"}
                </Label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder={lang === "de" ? "z.B. Müller Kids" : "e.g. Müller Kids"}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Category ── */}
        {step === "category" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {lang === "de"
                ? "Wählen Sie eine Produktkategorie. Diese bestimmt, welche Vorlagen verfügbar sind."
                : "Select a product category. This determines which templates are available."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {categoriesQuery.data?.map((cat: any) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setSelectedTemplateId(null);
                  }}
                  className={`text-left p-3 rounded-lg border-2 transition-all hover:border-primary/50 ${
                    selectedCategoryId === cat.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        {lang === "de" ? cat.labelDe : cat.labelEn}
                      </p>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>
                    {selectedCategoryId === cat.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {lang === "de"
                ? "Kategorie ist optional – Sie können auch ohne Vorlage fortfahren."
                : "Category is optional – you can also proceed without a template."}
            </p>
          </div>
        )}

        {/* ── Step 3: Template ── */}
        {step === "template" && (
          <div className="space-y-4">
            {!selectedCategoryId ? (
              <div className="text-center py-8 text-muted-foreground">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  {lang === "de"
                    ? "Keine Kategorie ausgewählt – Vorlage wird übersprungen."
                    : "No category selected – template step will be skipped."}
                </p>
              </div>
            ) : templatesQuery.data?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  {lang === "de"
                    ? "Keine Vorlagen für diese Kategorie vorhanden."
                    : "No templates available for this category."}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {lang === "de"
                    ? "Wählen Sie eine Vorlage. Die Pflicht- und optionalen Dokumente werden automatisch als Anforderungen gesetzt."
                    : "Select a template. Required and optional documents will be automatically set as requirements."}
                </p>
                <div className="space-y-3">
                  {templatesQuery.data?.map((tpl: any) => {
                    const reqDocs  = (tpl.requiredDocuments as string[]) ?? [];
                    const optDocs  = (tpl.optionalDocuments as string[]) ?? [];
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(isSelected ? null : tpl.id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:border-primary/50 ${
                          isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-medium text-sm">{tpl.name}</p>
                            {(lang === "de" ? tpl.descriptionDe : tpl.descriptionEn) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {lang === "de" ? tpl.descriptionDe : tpl.descriptionEn}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          )}
                        </div>
                        {reqDocs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {reqDocs.map((doc) => (
                              <Badge key={doc} variant="default" className="text-xs py-0 bg-red-100 text-red-700 border-red-200">
                                {REQ_LABELS[doc]?.[lang] ?? doc}
                              </Badge>
                            ))}
                            {optDocs.map((doc) => (
                              <Badge key={doc} variant="outline" className="text-xs py-0 text-muted-foreground">
                                {REQ_LABELS[doc]?.[lang] ?? doc}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Confirm ── */}
        {step === "confirm" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {lang === "de"
                ? "Bitte prüfen Sie die Angaben und bestätigen Sie das Anlegen des Produkts."
                : "Please review the details and confirm creating the product."}
            </p>

            {/* Product data summary */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">
                  {lang === "de" ? "Produktdaten" : "Product Data"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">{lang === "de" ? "Name" : "Name"}:</span>
                <span className="font-medium">{productName}</span>
                {internalArticleNumber && (
                  <>
                    <span className="text-muted-foreground">{lang === "de" ? "Int. Artikelnr." : "Int. Article No."}:</span>
                    <span>{internalArticleNumber}</span>
                  </>
                )}
                {supplierArticleNumber && (
                  <>
                    <span className="text-muted-foreground">{lang === "de" ? "Lief. Artikelnr." : "Supp. Article No."}:</span>
                    <span>{supplierArticleNumber}</span>
                  </>
                )}
                {brand && (
                  <>
                    <span className="text-muted-foreground">{lang === "de" ? "Marke" : "Brand"}:</span>
                    <span>{brand}</span>
                  </>
                )}
                {ean && (
                  <>
                    <span className="text-muted-foreground">EAN:</span>
                    <span>{ean}</span>
                  </>
                )}
              </div>
            </div>

            {/* Category + Template summary */}
            {selectedCategory && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">
                    {lang === "de" ? "Kategorie & Vorlage" : "Category & Template"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">{lang === "de" ? "Kategorie" : "Category"}:</span>
                  <span>{lang === "de" ? selectedCategory.labelDe : selectedCategory.labelEn}</span>
                  {selectedTemplate ? (
                    <>
                      <span className="text-muted-foreground">{lang === "de" ? "Vorlage" : "Template"}:</span>
                      <span>{selectedTemplate.name}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">{lang === "de" ? "Vorlage" : "Template"}:</span>
                      <span className="text-muted-foreground italic">
                        {lang === "de" ? "Keine Vorlage" : "No template"}
                      </span>
                    </>
                  )}
                </div>
                {selectedTemplate && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {lang === "de" ? "Automatisch gesetzte Anforderungen:" : "Automatically set requirements:"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {((selectedTemplate.requiredDocuments as string[]) ?? []).map((doc) => (
                        <Badge key={doc} className="text-xs py-0 bg-red-100 text-red-700 border-red-200">
                          <FileCheck className="h-2.5 w-2.5 mr-1" />
                          {REQ_LABELS[doc]?.[lang] ?? doc}
                        </Badge>
                      ))}
                      {((selectedTemplate.optionalDocuments as string[]) ?? []).map((doc) => (
                        <Badge key={doc} variant="outline" className="text-xs py-0 text-muted-foreground">
                          {REQ_LABELS[doc]?.[lang] ?? doc}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedCategory && (
              <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                {lang === "de"
                  ? "Keine Kategorie/Vorlage ausgewählt – Anforderungen können später manuell hinzugefügt werden."
                  : "No category/template selected – requirements can be added manually later."}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between gap-2 pt-2">
          <div>
            {step !== "details" && (
              <Button
                variant="outline"
                onClick={() => {
                  const prev = steps[currentStepIndex - 1];
                  if (prev) setStep(prev);
                }}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {lang === "de" ? "Zurück" : "Back"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              {lang === "de" ? "Abbrechen" : "Cancel"}
            </Button>
            {step !== "confirm" ? (
              <Button
                onClick={() => {
                  const next = steps[currentStepIndex + 1];
                  if (next) setStep(next);
                }}
                disabled={step === "details" && !isDetailsValid}
              >
                {lang === "de" ? "Weiter" : "Next"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !isDetailsValid}
              >
                {createMutation.isPending
                  ? lang === "de" ? "Wird angelegt…" : "Creating…"
                  : lang === "de" ? "Produkt anlegen" : "Create Product"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
