/**
 * client/src/components/CreateIncidentDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dialog zum Erfassen eines neuen Schadensfalls.
 * Das Produkt ist ein Pflichtfeld – nur so können alle Daten (Prüfberichte,
 * Herstellervorgaben, Komponenten, Deklarationen) bei der KI-Bewertung
 * berücksichtigt werden.
 * Supports DE and EN via useLang() hook.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, Package, Search, X, CheckCircle2, Info } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
  preselectedProductId?: number;
}

interface ProductHit {
  id: number;
  productName: string;
  internalArticleNumber?: string | null;
  brand?: string | null;
  ean?: string | null;
  category?: string | null;
  ageGrading?: string | null;
}

// ─── Product Search Field ─────────────────────────────────────────────────────

function ProductSearchField({
  value,
  onChange,
  preselectedProductId,
  lang,
}: {
  value: ProductHit | null;
  onChange: (p: ProductHit | null) => void;
  preselectedProductId?: number;
  lang: "de" | "en";
}) {
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const T = lang === "en" ? {
    searchPlaceholder: "Search product name, article no. or EAN...",
    minChars: "Enter at least 1 character...",
    searching: "Searching...",
    noResults: "No products found.",
    aiNote: "Test reports, manufacturer specifications, and component data will be considered in the AI assessment",
  } : {
    searchPlaceholder: "Produktname, Art.Nr. oder EAN suchen...",
    minChars: "Mindestens 1 Zeichen eingeben...",
    searching: "Suche läuft...",
    noResults: "Keine Produkte gefunden.",
    aiNote: "Prüfberichte, Herstellervorgaben und Komponentendaten werden bei der KI-Bewertung berücksichtigt",
  };

  // Load preselected product once on mount
  const preselectedQuery = trpc.products.getById.useQuery(
    { id: preselectedProductId! },
    { enabled: !!preselectedProductId && !value }
  );
  useEffect(() => {
    if (preselectedQuery.data && !value) {
      onChange(preselectedQuery.data as ProductHit);
    }
  }, [preselectedQuery.data]);

  // Search products
  const searchQuery = trpc.products.list.useQuery(
    { search: query.trim() || undefined },
    { enabled: dropdownOpen && query.trim().length >= 1 }
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Selected product card ──
  if (value) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-3">
        <Package className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-blue-900 truncate">{value.productName}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {value.internalArticleNumber && (
              <span className="text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                {lang === "en" ? "Art.No." : "Art.Nr."} {value.internalArticleNumber}
              </span>
            )}
            {value.brand && (
              <span className="text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                {value.brand}
              </span>
            )}
            {value.ageGrading && (
              <span className="text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                {value.ageGrading}
              </span>
            )}
            {value.category && (
              <span className="text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                {value.category}
              </span>
            )}
          </div>
          <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {T.aiNote}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700 shrink-0"
          onClick={() => { onChange(null); setQuery(""); }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ── Search input + dropdown ──
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
          onFocus={() => setDropdownOpen(true)}
          placeholder={T.searchPlaceholder}
          className="pl-9"
        />
      </div>
      {dropdownOpen && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg max-h-64 overflow-y-auto">
          {query.trim().length < 1 ? (
            <p className="text-sm text-muted-foreground px-3 py-2.5">{T.minChars}</p>
          ) : searchQuery.isLoading ? (
            <p className="text-sm text-muted-foreground px-3 py-2.5">{T.searching}</p>
          ) : !searchQuery.data || (searchQuery.data as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2.5">{T.noResults}</p>
          ) : (
            (searchQuery.data as ProductHit[]).map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent flex items-start gap-2.5 border-b last:border-0"
                onClick={() => { onChange(p); setDropdownOpen(false); setQuery(""); }}
              >
                <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.internalArticleNumber && `${lang === "en" ? "Art.No." : "Art.Nr."} ${p.internalArticleNumber}`, p.brand, p.ageGrading].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateIncidentDialog({ open, onClose, onCreated, preselectedProductId }: Props) {
  const { lang } = useLang();
  const utils = trpc.useUtils();

  const T = lang === "en" ? {
    dialogTitle: "Record New Incident",
    affectedProduct: "Affected Product *",
    productHint: "Required – enables complete AI assessment with test reports, manufacturer specifications, original accessory compliance, and component data",
    incidentType: "Incident Type *",
    typePersonalInjury: "Personal Injury",
    typePropertyDamage: "Property Damage",
    typeNearMiss: "Near Miss",
    typeProductDefect: "Product Defect",
    typeRegulatoryComplaint: "Regulatory Complaint",
    typeCustomerComplaint: "Customer Complaint",
    typeOther: "Other",
    severity: "Severity *",
    severityCritical: "Critical (Death / serious injury)",
    severityHigh: "High (Injury / hospitalisation)",
    severityMedium: "Medium (Minor injury / medical visit)",
    severityLow: "Low (No personal injury)",
    titleLabel: "Title *",
    titlePlaceholder: "Short, concise description of the incident",
    descriptionLabel: "Description *",
    descriptionPlaceholder: "Detailed description of the incident, circumstances, and known facts...",
    reporterName: "Reported by (Name)",
    reporterNamePlaceholder: "John Smith",
    reporterEmail: "Reporter Email",
    reporterEmailPlaceholder: "john@example.com",
    reporterType: "Reporter Type",
    reporterCustomer: "Customer",
    reporterSupplier: "Supplier",
    reporterInternal: "Internal",
    reporterAuthority: "Authority",
    reporterOther: "Other",
    incidentDate: "Incident Date *",
    affectedVersions: "Affected Versions",
    affectedVersionsPlaceholder: "v1.0, v1.1 (comma-separated)",
    affectedBatches: "Affected Batch Numbers",
    affectedBatchesPlaceholder: "B-2026-001, B-2026-002 (comma-separated)",
    estimatedUnits: "Estimated Number of Affected Units",
    estimatedUnitsPlaceholder: "e.g. 500",
    personalInjuryDetails: "Personal Injury Details",
    injuryDescription: "Injury Description",
    injuryDescriptionPlaceholder: "Nature and severity of the injury...",
    injuredAge: "Age of Injured Person",
    injuredAgePlaceholder: "e.g. 5",
    personType: "Person Type",
    personTypeChild: "Child",
    personTypeAdult: "Adult",
    personTypeUnknown: "Unknown",
    medicalTreatment: "Medical treatment required",
    hospitalisation: "Hospitalisation",
    cancel: "Cancel",
    submit: "Record Incident",
    submitting: "Saving...",
    successCreated: "Incident recorded",
    errorNoProduct: "Please select a product – this enables all data to be considered in the AI assessment.",
    errorRequired: "Title and description are required.",
  } : {
    dialogTitle: "Neuen Schadensfall erfassen",
    affectedProduct: "Betroffenes Produkt *",
    productHint: "Pflichtfeld – ermöglicht vollständige KI-Bewertung mit Prüfberichten, Herstellervorgaben, Originalzubehör-Compliance und Komponentendaten",
    incidentType: "Vorfalltyp *",
    typePersonalInjury: "Personenschaden",
    typePropertyDamage: "Sachschaden",
    typeNearMiss: "Beinahe-Vorfall",
    typeProductDefect: "Produktmangel",
    typeRegulatoryComplaint: "Behördenbeschwerde",
    typeCustomerComplaint: "Kundenbeschwerde",
    typeOther: "Sonstiges",
    severity: "Schweregrad *",
    severityCritical: "Kritisch (Tod / schwere Verletzung)",
    severityHigh: "Hoch (Verletzung / Krankenhausaufenthalt)",
    severityMedium: "Mittel (leichte Verletzung / Arztbesuch)",
    severityLow: "Niedrig (kein Personenschaden)",
    titleLabel: "Titel *",
    titlePlaceholder: "Kurze, prägnante Beschreibung des Vorfalls",
    descriptionLabel: "Beschreibung *",
    descriptionPlaceholder: "Detaillierte Beschreibung des Vorfalls, der Umstände und bekannter Fakten...",
    reporterName: "Gemeldet von (Name)",
    reporterNamePlaceholder: "Max Mustermann",
    reporterEmail: "E-Mail des Melders",
    reporterEmailPlaceholder: "max@beispiel.ch",
    reporterType: "Melder-Typ",
    reporterCustomer: "Kunde",
    reporterSupplier: "Lieferant",
    reporterInternal: "Intern",
    reporterAuthority: "Behörde",
    reporterOther: "Sonstiges",
    incidentDate: "Datum des Vorfalls *",
    affectedVersions: "Betroffene Versionen",
    affectedVersionsPlaceholder: "v1.0, v1.1 (kommagetrennt)",
    affectedBatches: "Betroffene Chargennummern",
    affectedBatchesPlaceholder: "B-2026-001, B-2026-002 (kommagetrennt)",
    estimatedUnits: "Geschätzte Anzahl betroffener Einheiten",
    estimatedUnitsPlaceholder: "z.B. 500",
    personalInjuryDetails: "Details zum Personenschaden",
    injuryDescription: "Verletzungsbeschreibung",
    injuryDescriptionPlaceholder: "Art und Schwere der Verletzung...",
    injuredAge: "Alter der verletzten Person",
    injuredAgePlaceholder: "z.B. 5",
    personType: "Personentyp",
    personTypeChild: "Kind",
    personTypeAdult: "Erwachsener",
    personTypeUnknown: "Unbekannt",
    medicalTreatment: "Arztbesuch erforderlich",
    hospitalisation: "Krankenhausaufenthalt",
    cancel: "Abbrechen",
    submit: "Schadensfall erfassen",
    submitting: "Wird gespeichert...",
    successCreated: "Schadensfall erfasst",
    errorNoProduct: "Bitte ein Produkt auswählen – nur so können alle Daten bei der KI-Bewertung berücksichtigt werden.",
    errorRequired: "Titel und Beschreibung sind Pflichtfelder.",
  };

  // Product selection (required)
  const [selectedProduct, setSelectedProduct] = useState<ProductHit | null>(null);

  // Form state
  const [incidentType, setIncidentType] = useState<string>("product_defect");
  const [severity, setSeverity] = useState<string>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reportedByName, setReportedByName] = useState("");
  const [reportedByEmail, setReportedByEmail] = useState("");
  const [reportedByType, setReportedByType] = useState<string>("customer");
  const [reportedAt, setReportedAt] = useState(() => new Date().toISOString().split("T")[0]);
  const [affectedVersions, setAffectedVersions] = useState("");
  const [affectedBatchNumbers, setAffectedBatchNumbers] = useState("");
  const [affectedUnitsEstimate, setAffectedUnitsEstimate] = useState("");

  // Injury fields
  const [injuryDescription, setInjuryDescription] = useState("");
  const [injuredPersonAge, setInjuredPersonAge] = useState("");
  const [injuredPersonType, setInjuredPersonType] = useState<string>("unknown");
  const [medicalTreatmentRequired, setMedicalTreatmentRequired] = useState(false);
  const [hospitalisation, setHospitalisation] = useState(false);

  const createMutation = trpc.incidents.create.useMutation({
    onSuccess: (data) => {
      toast.success(T.successCreated);
      utils.incidents.list.invalidate();
      utils.incidents.getStats.invalidate();
      onCreated(data.id);
      resetForm();
    },
    onError: (err) => {
      toast.error(`${lang === "en" ? "Error" : "Fehler"}: ${err.message}`);
    },
  });

  function resetForm() {
    setSelectedProduct(null);
    setIncidentType("product_defect");
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setReportedByName("");
    setReportedByEmail("");
    setReportedByType("customer");
    setReportedAt(new Date().toISOString().split("T")[0]);
    setAffectedVersions("");
    setAffectedBatchNumbers("");
    setAffectedUnitsEstimate("");
    setInjuryDescription("");
    setInjuredPersonAge("");
    setInjuredPersonType("unknown");
    setMedicalTreatmentRequired(false);
    setHospitalisation(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error(T.errorNoProduct);
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error(T.errorRequired);
      return;
    }
    createMutation.mutate({
      productId: selectedProduct.id,
      incidentType: incidentType as any,
      severity: severity as any,
      title: title.trim(),
      description: description.trim(),
      reportedByName: reportedByName.trim() || undefined,
      reportedByEmail: reportedByEmail.trim() || undefined,
      reportedByType: reportedByType as any,
      reportedAt: new Date(reportedAt),
      affectedVersions: affectedVersions.trim()
        ? affectedVersions.split(",").map((v) => v.trim()).filter(Boolean)
        : [],
      affectedBatchNumbers: affectedBatchNumbers.trim()
        ? affectedBatchNumbers.split(",").map((v) => v.trim()).filter(Boolean)
        : [],
      affectedUnitsEstimate: affectedUnitsEstimate ? parseInt(affectedUnitsEstimate) : undefined,
      injuryDescription: incidentType === "personal_injury" ? injuryDescription.trim() || undefined : undefined,
      injuredPersonAge: incidentType === "personal_injury" && injuredPersonAge ? parseInt(injuredPersonAge) : undefined,
      injuredPersonType: incidentType === "personal_injury" ? (injuredPersonType as any) : undefined,
      medicalTreatmentRequired: incidentType === "personal_injury" ? medicalTreatmentRequired : undefined,
      hospitalisation: incidentType === "personal_injury" ? hospitalisation : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {T.dialogTitle}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Product (required) ── */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-semibold">
              <Package className="h-4 w-4 text-blue-600" />
              {T.affectedProduct}
            </Label>
            <ProductSearchField
              value={selectedProduct}
              onChange={setSelectedProduct}
              preselectedProductId={preselectedProductId}
              lang={lang}
            />
            {!selectedProduct && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Info className="h-3 w-3 shrink-0" />
                {T.productHint}
              </p>
            )}
          </div>

          {/* ── Incident Type & Severity ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{T.incidentType}</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal_injury">{T.typePersonalInjury}</SelectItem>
                  <SelectItem value="property_damage">{T.typePropertyDamage}</SelectItem>
                  <SelectItem value="near_miss">{T.typeNearMiss}</SelectItem>
                  <SelectItem value="product_defect">{T.typeProductDefect}</SelectItem>
                  <SelectItem value="regulatory_complaint">{T.typeRegulatoryComplaint}</SelectItem>
                  <SelectItem value="customer_complaint">{T.typeCustomerComplaint}</SelectItem>
                  <SelectItem value="other">{T.typeOther}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{T.severity}</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">{T.severityCritical}</SelectItem>
                  <SelectItem value="high">{T.severityHigh}</SelectItem>
                  <SelectItem value="medium">{T.severityMedium}</SelectItem>
                  <SelectItem value="low">{T.severityLow}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Title ── */}
          <div className="space-y-1.5">
            <Label>{T.titleLabel}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={T.titlePlaceholder}
              required
            />
          </div>

          {/* ── Description ── */}
          <div className="space-y-1.5">
            <Label>{T.descriptionLabel}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={T.descriptionPlaceholder}
              rows={4}
              required
            />
          </div>

          {/* ── Reporter ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{T.reporterName}</Label>
              <Input
                value={reportedByName}
                onChange={(e) => setReportedByName(e.target.value)}
                placeholder={T.reporterNamePlaceholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{T.reporterEmail}</Label>
              <Input
                type="email"
                value={reportedByEmail}
                onChange={(e) => setReportedByEmail(e.target.value)}
                placeholder={T.reporterEmailPlaceholder}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{T.reporterType}</Label>
              <Select value={reportedByType} onValueChange={setReportedByType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">{T.reporterCustomer}</SelectItem>
                  <SelectItem value="supplier">{T.reporterSupplier}</SelectItem>
                  <SelectItem value="internal">{T.reporterInternal}</SelectItem>
                  <SelectItem value="authority">{T.reporterAuthority}</SelectItem>
                  <SelectItem value="other">{T.reporterOther}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{T.incidentDate}</Label>
              <Input
                type="date"
                value={reportedAt}
                onChange={(e) => setReportedAt(e.target.value)}
                required
              />
            </div>
          </div>

          {/* ── Affected Versions / Batches ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{T.affectedVersions}</Label>
              <Input
                value={affectedVersions}
                onChange={(e) => setAffectedVersions(e.target.value)}
                placeholder={T.affectedVersionsPlaceholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{T.affectedBatches}</Label>
              <Input
                value={affectedBatchNumbers}
                onChange={(e) => setAffectedBatchNumbers(e.target.value)}
                placeholder={T.affectedBatchesPlaceholder}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{T.estimatedUnits}</Label>
            <Input
              type="number"
              min="1"
              value={affectedUnitsEstimate}
              onChange={(e) => setAffectedUnitsEstimate(e.target.value)}
              placeholder={T.estimatedUnitsPlaceholder}
            />
          </div>

          {/* ── Personal Injury Details ── */}
          {incidentType === "personal_injury" && (
            <div className="border rounded-lg p-4 space-y-4 bg-red-50/50">
              <h3 className="font-medium text-sm text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {T.personalInjuryDetails}
              </h3>
              <div className="space-y-1.5">
                <Label>{T.injuryDescription}</Label>
                <Textarea
                  value={injuryDescription}
                  onChange={(e) => setInjuryDescription(e.target.value)}
                  placeholder={T.injuryDescriptionPlaceholder}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{T.injuredAge}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="150"
                    value={injuredPersonAge}
                    onChange={(e) => setInjuredPersonAge(e.target.value)}
                    placeholder={T.injuredAgePlaceholder}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{T.personType}</Label>
                  <Select value={injuredPersonType} onValueChange={setInjuredPersonType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="child">{T.personTypeChild}</SelectItem>
                      <SelectItem value="adult">{T.personTypeAdult}</SelectItem>
                      <SelectItem value="unknown">{T.personTypeUnknown}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="medicalTreatment"
                    checked={medicalTreatmentRequired}
                    onCheckedChange={(v) => setMedicalTreatmentRequired(v === true)}
                  />
                  <Label htmlFor="medicalTreatment" className="cursor-pointer">{T.medicalTreatment}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hospitalisation"
                    checked={hospitalisation}
                    onCheckedChange={(v) => setHospitalisation(v === true)}
                  />
                  <Label htmlFor="hospitalisation" className="cursor-pointer">{T.hospitalisation}</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onClose(); resetForm(); }}>
              {T.cancel}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !selectedProduct}>
              {createMutation.isPending ? T.submitting : T.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
