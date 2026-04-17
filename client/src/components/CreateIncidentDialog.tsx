/**
 * client/src/components/CreateIncidentDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dialog zum Erfassen eines neuen Schadensfalls.
 */
import { useState } from "react";
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
import { AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
  preselectedProductId?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateIncidentDialog({ open, onClose, onCreated, preselectedProductId }: Props) {
  const utils = trpc.useUtils();

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
    if (!title.trim() || !description.trim()) {
      toast.error("Titel und Beschreibung sind Pflichtfelder.");
      return;
    }

    createMutation.mutate({
      productId: preselectedProductId,
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Neuen Schadensfall erfassen
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Typ & Schweregrad */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vorfalltyp *</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Kritisch (Tod / schwere Verletzung)</SelectItem>
                  <SelectItem value="high">Hoch (Verletzung / Krankenhausaufenthalt)</SelectItem>
                  <SelectItem value="medium">Mittel (leichte Verletzung / Arztbesuch)</SelectItem>
                  <SelectItem value="low">Niedrig (kein Personenschaden)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Titel */}
          <div className="space-y-1.5">
            <Label>Titel *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kurze, prägnante Beschreibung des Vorfalls"
              required
            />
          </div>

          {/* Beschreibung */}
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

          {/* Melder */}
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

          {/* Betroffene Versionen / Chargen */}
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

          {/* Personenschaden-Details */}
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Wird gespeichert..." : "Schadensfall erfassen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
