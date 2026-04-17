/**
 * client/src/components/CreateIncidentDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dialog zum Erfassen eines neuen Schadensfalls.
 * Das Produkt ist ein Pflichtfeld – nur so können alle Daten (Prüfberichte,
 * Herstellervorgaben, Komponenten, Deklarationen) bei der KI-Bewertung
 * berücksichtigt werden.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
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
}: {
  value: ProductHit | null;
  onChange: (p: ProductHit | null) => void;
  preselectedProductId?: number;
}) {
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
                Art.Nr. {value.internalArticleNumber}
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
            Prüfberichte, Herstellervorgaben und Komponentendaten werden bei der KI-Bewertung berücksichtigt
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
          placeholder="Produktname, Art.Nr. oder EAN suchen..."
          className="pl-9"
        />
      </div>
      {dropdownOpen && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg max-h-64 overflow-y-auto">
          {query.trim().length < 1 ? (
            <p className="text-sm text-muted-foreground px-3 py-2.5">Mindestens 1 Zeichen eingeben...</p>
          ) : searchQuery.isLoading ? (
            <p className="text-sm text-muted-foreground px-3 py-2.5">Suche läuft...</p>
          ) : !searchQuery.data || (searchQuery.data as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2.5">Keine Produkte gefunden.</p>
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
                    {[p.internalArticleNumber && `Art.Nr. ${p.internalArticleNumber}`, p.brand, p.ageGrading].filter(Boolean).join(" · ")}
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
  const utils = trpc.useUtils();

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
      toast.success("Schadensfall erfasst");
      utils.incidents.list.invalidate();
      utils.incidents.getStats.invalidate();
      onCreated(data.id);
      resetForm();
    },
    onError: (err) => {
      toast.error(`Fehler: ${err.message}`);
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
      toast.error("Bitte ein Produkt auswählen – nur so können alle Daten bei der KI-Bewertung berücksichtigt werden.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error("Titel und Beschreibung sind Pflichtfelder.");
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
            Neuen Schadensfall erfassen
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Produkt (Pflichtfeld) – immer als erstes ── */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-semibold">
              <Package className="h-4 w-4 text-blue-600" />
              Betroffenes Produkt *
            </Label>
            <ProductSearchField
              value={selectedProduct}
              onChange={setSelectedProduct}
              preselectedProductId={preselectedProductId}
            />
            {!selectedProduct && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Info className="h-3 w-3 shrink-0" />
                Pflichtfeld – ermöglicht vollständige KI-Bewertung mit Prüfberichten, Herstellervorgaben, Originalzubehör-Compliance und Komponentendaten
              </p>
            )}
          </div>

          {/* ── Vorfalltyp & Schweregrad ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vorfalltyp *</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal_injury">Personenschaden</SelectItem>
                  <SelectItem value="property_damage">Sachschaden</SelectItem>
                  <SelectItem value="near_miss">Beinahe-Vorfall</SelectItem>
                  <SelectItem value="product_defect">Produktmangel</SelectItem>
                  <SelectItem value="regulatory_complaint">Behördenbeschwerde</SelectItem>
                  <SelectItem value="customer_complaint">Kundenbeschwerde</SelectItem>
                  <SelectItem value="other">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Schweregrad *</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Kritisch (Tod / schwere Verletzung)</SelectItem>
                  <SelectItem value="high">Hoch (Verletzung / Krankenhausaufenthalt)</SelectItem>
                  <SelectItem value="medium">Mittel (leichte Verletzung / Arztbesuch)</SelectItem>
                  <SelectItem value="low">Niedrig (kein Personenschaden)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Titel ── */}
          <div className="space-y-1.5">
            <Label>Titel *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kurze, prägnante Beschreibung des Vorfalls"
              required
            />
          </div>

          {/* ── Beschreibung ── */}
          <div className="space-y-1.5">
            <Label>Beschreibung *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaillierte Beschreibung des Vorfalls, der Umstände und bekannter Fakten..."
              rows={4}
              required
            />
          </div>

          {/* ── Melder ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Gemeldet von (Name)</Label>
              <Input
                value={reportedByName}
                onChange={(e) => setReportedByName(e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail des Melders</Label>
              <Input
                type="email"
                value={reportedByEmail}
                onChange={(e) => setReportedByEmail(e.target.value)}
                placeholder="max@beispiel.ch"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Melder-Typ</Label>
              <Select value={reportedByType} onValueChange={setReportedByType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Kunde</SelectItem>
                  <SelectItem value="supplier">Lieferant</SelectItem>
                  <SelectItem value="internal">Intern</SelectItem>
                  <SelectItem value="authority">Behörde</SelectItem>
                  <SelectItem value="other">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Datum des Vorfalls *</Label>
              <Input
                type="date"
                value={reportedAt}
                onChange={(e) => setReportedAt(e.target.value)}
                required
              />
            </div>
          </div>

          {/* ── Betroffene Versionen / Chargen ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Betroffene Versionen</Label>
              <Input
                value={affectedVersions}
                onChange={(e) => setAffectedVersions(e.target.value)}
                placeholder="v1.0, v1.1 (kommagetrennt)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Betroffene Chargennummern</Label>
              <Input
                value={affectedBatchNumbers}
                onChange={(e) => setAffectedBatchNumbers(e.target.value)}
                placeholder="B-2026-001, B-2026-002 (kommagetrennt)"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Geschätzte Anzahl betroffener Einheiten</Label>
            <Input
              type="number"
              min="1"
              value={affectedUnitsEstimate}
              onChange={(e) => setAffectedUnitsEstimate(e.target.value)}
              placeholder="z.B. 500"
            />
          </div>

          {/* ── Personenschaden-Details ── */}
          {incidentType === "personal_injury" && (
            <div className="border rounded-lg p-4 space-y-4 bg-red-50/50">
              <h3 className="font-medium text-sm text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Details zum Personenschaden
              </h3>
              <div className="space-y-1.5">
                <Label>Verletzungsbeschreibung</Label>
                <Textarea
                  value={injuryDescription}
                  onChange={(e) => setInjuryDescription(e.target.value)}
                  placeholder="Art und Schwere der Verletzung..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Alter der verletzten Person</Label>
                  <Input
                    type="number"
                    min="0"
                    max="150"
                    value={injuredPersonAge}
                    onChange={(e) => setInjuredPersonAge(e.target.value)}
                    placeholder="z.B. 5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Personentyp</Label>
                  <Select value={injuredPersonType} onValueChange={setInjuredPersonType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="child">Kind</SelectItem>
                      <SelectItem value="adult">Erwachsener</SelectItem>
                      <SelectItem value="unknown">Unbekannt</SelectItem>
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
                  <Label htmlFor="medicalTreatment" className="cursor-pointer">Arztbesuch erforderlich</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hospitalisation"
                    checked={hospitalisation}
                    onCheckedChange={(v) => setHospitalisation(v === true)}
                  />
                  <Label htmlFor="hospitalisation" className="cursor-pointer">Krankenhausaufenthalt</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onClose(); resetForm(); }}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !selectedProduct}>
              {createMutation.isPending ? "Wird gespeichert..." : "Schadensfall erfassen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
