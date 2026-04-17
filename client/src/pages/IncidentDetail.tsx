/**
 * client/src/pages/IncidentDetail.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Detailseite für einen Schadensfall mit Beweisen, Bewertung, Rückruf und Timeline.
 */
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import ComplianceLayout from "@/components/ComplianceLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Upload,
  FileText,
  MessageSquare,
  RotateCcw,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Paperclip,
  Trash2,
  Plus,
  Package,
  User,
  Calendar,
  Building2,
  ExternalLink,
  Activity,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: { label: "Kritisch", className: "bg-red-100 text-red-800 border-red-200" },
  high: { label: "Hoch", className: "bg-orange-100 text-orange-800 border-orange-200" },
  medium: { label: "Mittel", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  low: { label: "Niedrig", className: "bg-blue-100 text-blue-800 border-blue-200" },
} as const;

const STATUS_CONFIG = {
  open: { label: "Offen", className: "bg-gray-100 text-gray-700" },
  under_review: { label: "In Prüfung", className: "bg-blue-100 text-blue-700" },
  assessed: { label: "Bewertet", className: "bg-purple-100 text-purple-700" },
  recall_initiated: { label: "Rückruf eingeleitet", className: "bg-orange-100 text-orange-700" },
  recall_completed: { label: "Rückruf abgeschlossen", className: "bg-green-100 text-green-700" },
  closed: { label: "Geschlossen", className: "bg-gray-100 text-gray-500" },
  archived: { label: "Archiviert", className: "bg-gray-100 text-gray-400" },
} as const;

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  personal_injury: "Personenschaden",
  property_damage: "Sachschaden",
  near_miss: "Beinahe-Vorfall",
  product_defect: "Produktmangel",
  regulatory_complaint: "Behördenbeschwerde",
  customer_complaint: "Kundenbeschwerde",
  other: "Sonstiges",
};

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  photo: "Foto",
  customer_statement: "Kundenaussage",
  internal_report: "Interner Bericht",
  medical_report: "Arztbericht",
  authority_document: "Behördendokument",
  product_sample: "Produktprobe",
  video: "Video",
  other: "Sonstiges",
};

const RISK_LEVEL_CONFIG = {
  critical: { label: "Kritisch", className: "bg-red-100 text-red-800" },
  high: { label: "Hoch", className: "bg-orange-100 text-orange-800" },
  medium: { label: "Mittel", className: "bg-yellow-100 text-yellow-800" },
  low: { label: "Niedrig", className: "bg-blue-100 text-blue-800" },
  none: { label: "Kein Risiko", className: "bg-gray-100 text-gray-700" },
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function AddEvidenceDialog({
  incidentId,
  open,
  onClose,
  onAdded,
}: {
  incidentId: number;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [evidenceType, setEvidenceType] = useState("photo");
  const [description, setDescription] = useState("");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = trpc.incidents.uploadEvidence.useMutation({
    onSuccess: () => {
      toast.success("Beweis hinzugefügt");
      onAdded();
      onClose();
      resetForm();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  const addTextMutation = trpc.incidents.addEvidence.useMutation({
    onSuccess: () => {
      toast.success("Aussage / Bericht hinzugefügt");
      onAdded();
      onClose();
      resetForm();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  function resetForm() {
    setEvidenceType("photo");
    setDescription("");
    setTextContent("");
    setFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (file) {
      setUploading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(arrayBuffer))));
        uploadMutation.mutate({
          incidentId,
          evidenceType: evidenceType as any,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          description: description.trim() || undefined,
          fileBase64: base64,
        });
      } finally {
        setUploading(false);
      }
    } else if (textContent.trim()) {
      addTextMutation.mutate({
        incidentId,
        evidenceType: evidenceType as any,
        fileName: `${EVIDENCE_TYPE_LABELS[evidenceType] ?? evidenceType} – ${new Date().toLocaleDateString("de-CH")}`,
        fileUrl: "text://inline",
        fileKey: `text-${Date.now()}`,
        description: description.trim() || undefined,
        sourceType: "text",
        textContent: textContent.trim(),
      });
    } else {
      toast.error("Bitte eine Datei auswählen oder Text eingeben.");
    }
  }

  const isPending = uploading || uploadMutation.isPending || addTextMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Beweis / Dokument hinzufügen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Beweistyp</Label>
            <Select value={evidenceType} onValueChange={setEvidenceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EVIDENCE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung des Beweismittels..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Datei hochladen</Label>
            <Input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.mp4,.mov"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">oder Text eingeben</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Aussage / Bericht (Text)</Label>
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Kundenaussage, interne Einschätzung, Behördenkorrespondenz..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Wird hochgeladen..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddAssessmentDialog({
  incidentId,
  open,
  onClose,
  onAdded,
}: {
  incidentId: number;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [riskLevel, setRiskLevel] = useState("medium");
  const [assessmentType, setAssessmentType] = useState("initial");
  const [recallRecommended, setRecallRecommended] = useState(false);
  const [recallScope, setRecallScope] = useState("none");
  const [assessmentText, setAssessmentText] = useState("");
  const [regulatoryObligation, setRegulatoryObligation] = useState(false);
  const [regulatoryBasis, setRegulatoryBasis] = useState("");
  const [requiredDocuments, setRequiredDocuments] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // KI-Vorschlag State
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const aiMutation = trpc.incidents.suggestAssessment.useMutation({
    onSuccess: (data) => {
      setAiSuggestion(data);
      setShowAiPanel(true);
      toast.success("KI-Vorschlag erstellt – jetzt übernehmen oder anpassen");
    },
    onError: (err) => toast.error(`KI-Analyse fehlgeschlagen: ${err.message}`),
  });

  function applyAiSuggestion() {
    if (!aiSuggestion) return;
    setRiskLevel(aiSuggestion.riskLevel ?? riskLevel);
    setRecallRecommended(aiSuggestion.recallRecommended ?? false);
    if (aiSuggestion.recallRecommended && aiSuggestion.recallScope) {
      const scopeText = (aiSuggestion.recallScope as string).toLowerCase();
      if (scopeText.includes("pflicht") || scopeText.includes("mandatory")) setRecallScope("mandatory");
      else if (scopeText.includes("freiwillig") || scopeText.includes("voluntary")) setRecallScope("voluntary");
      else if (scopeText.includes("gezielt") || scopeText.includes("targeted")) setRecallScope("targeted");
    }
    setRegulatoryObligation(aiSuggestion.regulatoryObligation ?? false);
    if (aiSuggestion.regulatoryObligation && aiSuggestion.regulatoryObligationReason) {
      setRegulatoryBasis(aiSuggestion.regulatoryObligationReason);
    }
    if (Array.isArray(aiSuggestion.requiredDocuments) && aiSuggestion.requiredDocuments.length > 0) {
      setRequiredDocuments(aiSuggestion.requiredDocuments.join(", "));
    }
    const regs = Array.isArray(aiSuggestion.applicableRegulations) && aiSuggestion.applicableRegulations.length > 0
      ? `\n\nRelevante Normen: ${aiSuggestion.applicableRegulations.join(", ")}`
      : "";
    setAssessmentText((aiSuggestion.assessmentText ?? "") + regs);
    toast.success("KI-Vorschlag übernommen");
  }

  const mutation = trpc.incidents.addAssessment.useMutation({
    onSuccess: () => {
      toast.success("Bewertung gespeichert");
      onAdded();
      onClose();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assessmentText.trim()) {
      toast.error("Bewertungstext ist ein Pflichtfeld.");
      return;
    }
    mutation.mutate({
      incidentId,
      assessmentType: assessmentType as any,
      riskLevel: riskLevel as any,
      recallRecommended,
      recallScope: recallScope as any,
      assessmentText: assessmentText.trim(),
      regulatoryObligation,
      regulatoryBasis: regulatoryBasis.trim() || undefined,
      requiredDocuments: requiredDocuments.trim()
        ? requiredDocuments.split(",").map((d) => d.trim()).filter(Boolean)
        : [],
      internalNotes: internalNotes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Interne Bewertung hinzufügen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* KI-Vorschlag Banner */}
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-medium text-violet-800">KI-Risikoeinschätzung</span>
                {aiSuggestion && (
                  <span className="text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                    Konfidenz: {aiSuggestion.confidence === "high" ? "Hoch" : aiSuggestion.confidence === "medium" ? "Mittel" : "Niedrig"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {aiSuggestion && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-violet-700 border-violet-300 hover:bg-violet-100 h-7 text-xs"
                      onClick={applyAiSuggestion}
                    >
                      Vorschlag übernehmen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-violet-600"
                      onClick={() => setShowAiPanel(!showAiPanel)}
                    >
                      {showAiPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white h-7 text-xs"
                  onClick={() => aiMutation.mutate({ incidentId })}
                  disabled={aiMutation.isPending}
                >
                  {aiMutation.isPending ? (
                    <><span className="animate-spin mr-1">&#9696;</span> Analysiere...</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" /> KI-Analyse starten</>
                  )}
                </Button>
              </div>
            </div>
            {aiSuggestion && showAiPanel && (
              <div className="mt-3 space-y-2 text-sm border-t border-violet-200 pt-3">
                <div className="flex flex-wrap gap-2">
                  <span className="font-medium text-violet-800">Empfehlung:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    aiSuggestion.riskLevel === "critical" ? "bg-red-100 text-red-800" :
                    aiSuggestion.riskLevel === "high" ? "bg-orange-100 text-orange-800" :
                    aiSuggestion.riskLevel === "medium" ? "bg-yellow-100 text-yellow-800" :
                    "bg-blue-100 text-blue-800"
                  }`}>
                    Risiko: {aiSuggestion.riskLevel === "critical" ? "Kritisch" : aiSuggestion.riskLevel === "high" ? "Hoch" : aiSuggestion.riskLevel === "medium" ? "Mittel" : "Niedrig"}
                  </span>
                  {aiSuggestion.recallRecommended && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      Rückruf empfohlen
                    </span>
                  )}
                  {aiSuggestion.regulatoryObligation && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                      Meldepflicht: {aiSuggestion.regulatoryDeadlineDays === 0 ? "sofort" : aiSuggestion.regulatoryDeadlineDays ? `${aiSuggestion.regulatoryDeadlineDays} Tage` : "ja"}
                    </span>
                  )}
                </div>
                <p className="text-violet-700 text-xs leading-relaxed">{aiSuggestion.summary}</p>
                {Array.isArray(aiSuggestion.applicableRegulations) && aiSuggestion.applicableRegulations.length > 0 && (
                  <p className="text-xs text-violet-600">
                    <span className="font-medium">Normen:</span> {aiSuggestion.applicableRegulations.join(" · ")}
                  </p>
                )}
                {Array.isArray(aiSuggestion.caveats) && aiSuggestion.caveats.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2">
                    <p className="text-xs font-medium text-amber-800 mb-1">Vorbehalte:</p>
                    {aiSuggestion.caveats.map((c: string, i: number) => (
                      <p key={i} className="text-xs text-amber-700">&#8226; {c}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!aiSuggestion && (
              <p className="text-xs text-violet-600 mt-1">
                Starten Sie die KI-Analyse, um automatisch eine Risikoeinschätzung basierend auf Fallbeschreibung und Produktdaten zu erhalten.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bewertungstyp</Label>
              <Select value={assessmentType} onValueChange={setAssessmentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial">Erstbewertung</SelectItem>
                  <SelectItem value="technical">Technische Bewertung</SelectItem>
                  <SelectItem value="legal">Rechtliche Bewertung</SelectItem>
                  <SelectItem value="final">Abschlussbewertung</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Risikoniveau *</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Kritisch</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="none">Kein Risiko</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Bewertung *</Label>
            <Textarea
              value={assessmentText}
              onChange={(e) => setAssessmentText(e.target.value)}
              placeholder="Detaillierte interne Einschätzung des Vorfalls, der Ursachen und empfohlenen Massnahmen..."
              rows={5}
              required
            />
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="recallRecommended"
                checked={recallRecommended}
                onCheckedChange={(v) => setRecallRecommended(v === true)}
              />
              <Label htmlFor="recallRecommended" className="cursor-pointer font-medium">
                Rückruf empfohlen
              </Label>
            </div>
            {recallRecommended && (
              <div className="space-y-1.5 ml-6">
                <Label>Rückruf-Umfang</Label>
                <Select value={recallScope} onValueChange={setRecallScope}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Rückruf</SelectItem>
                    <SelectItem value="targeted">Gezielter Rückruf (bestimmte Chargen)</SelectItem>
                    <SelectItem value="voluntary">Freiwilliger Rückruf</SelectItem>
                    <SelectItem value="mandatory">Behördlich angeordneter Rückruf</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="regulatoryObligation"
                checked={regulatoryObligation}
                onCheckedChange={(v) => setRegulatoryObligation(v === true)}
              />
              <Label htmlFor="regulatoryObligation" className="cursor-pointer font-medium">
                Meldepflicht gegenüber Behörden
              </Label>
            </div>
            {regulatoryObligation && (
              <div className="space-y-1.5 ml-6">
                <Label>Rechtliche Grundlage</Label>
                <Input
                  value={regulatoryBasis}
                  onChange={(e) => setRegulatoryBasis(e.target.value)}
                  placeholder="z.B. GPSR Art. 9, PrSG §10, REACH..."
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Benötigte Dokumente</Label>
            <Input
              value={requiredDocuments}
              onChange={(e) => setRequiredDocuments(e.target.value)}
              placeholder="Prüfbericht, Konformitätserklärung, Arztbericht (kommagetrennt)"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Interne Notizen</Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Interne Hinweise, die nicht im offiziellen Bericht erscheinen sollen..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Wird gespeichert..." : "Bewertung speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InitiateRecallDialog({
  incidentId,
  open,
  onClose,
  onInitiated,
}: {
  incidentId: number;
  open: boolean;
  onClose: () => void;
  onInitiated: () => void;
}) {
  const [recallType, setRecallType] = useState("voluntary");
  const [recallScope, setRecallScope] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [affectedUnitsCount, setAffectedUnitsCount] = useState("");
  const [recallStartDate, setRecallStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [remediationAction, setRemediationAction] = useState("replacement");
  const [remediationInstructions, setRemediationInstructions] = useState("");
  const [authorityNames, setAuthorityNames] = useState("");

  const mutation = trpc.incidents.initiateRecall.useMutation({
    onSuccess: () => {
      toast.success("Rückruf eingeleitet");
      onInitiated();
      onClose();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recallScope.trim()) {
      toast.error("Rückruf-Umfang ist ein Pflichtfeld.");
      return;
    }
    mutation.mutate({
      incidentId,
      recallType: recallType as any,
      recallScope: recallScope.trim(),
      announcementText: announcementText.trim() || undefined,
      affectedUnitsCount: affectedUnitsCount ? parseInt(affectedUnitsCount) : undefined,
      recallStartDate: new Date(recallStartDate),
      remediationAction: remediationAction as any,
      remediationInstructions: remediationInstructions.trim() || undefined,
      authorityNames: authorityNames.trim()
        ? authorityNames.split(",").map((a) => a.trim()).filter(Boolean)
        : [],
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-700">
            <RotateCcw className="h-5 w-5" />
            Rückruf einleiten
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Rückruf-Typ *</Label>
              <Select value={recallType} onValueChange={setRecallType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voluntary">Freiwilliger Rückruf</SelectItem>
                  <SelectItem value="mandatory">Behördlich angeordnet</SelectItem>
                  <SelectItem value="targeted">Gezielter Rückruf</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Startdatum</Label>
              <Input
                type="date"
                value={recallStartDate}
                onChange={(e) => setRecallStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Rückruf-Umfang / betroffene Produkte *</Label>
            <Textarea
              value={recallScope}
              onChange={(e) => setRecallScope(e.target.value)}
              placeholder="Welche Produkte, Versionen, Chargen und Märkte sind betroffen? Welche Kriterien definieren den Rückruf-Umfang?"
              rows={3}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Anzahl betroffener Einheiten</Label>
            <Input
              type="number"
              min="1"
              value={affectedUnitsCount}
              onChange={(e) => setAffectedUnitsCount(e.target.value)}
              placeholder="z.B. 1500"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Massnahme für Kunden</Label>
            <Select value={remediationAction} onValueChange={setRemediationAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="refund">Rückerstattung</SelectItem>
                <SelectItem value="replacement">Ersatzprodukt</SelectItem>
                <SelectItem value="repair">Reparatur</SelectItem>
                <SelectItem value="disposal">Entsorgung</SelectItem>
                <SelectItem value="other">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Anweisungen für Kunden</Label>
            <Textarea
              value={remediationInstructions}
              onChange={(e) => setRemediationInstructions(e.target.value)}
              placeholder="Wie sollen Kunden vorgehen? Rücksendung, Kontaktaufnahme, etc."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Ankündigungstext (für Kunden / Öffentlichkeit)</Label>
            <Textarea
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="Offizieller Text für die Rückruf-Ankündigung..."
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Beteiligte Behörden</Label>
            <Input
              value={authorityNames}
              onChange={(e) => setAuthorityNames(e.target.value)}
              placeholder="BAZG, SECO, Stiftung Warentest (kommagetrennt)"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {mutation.isPending ? "Wird eingeleitet..." : "Rückruf einleiten"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const incidentId = parseInt(id ?? "0");

  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [showAddAssessment, setShowAddAssessment] = useState(false);
  const [showInitiateRecall, setShowInitiateRecall] = useState(false);

  const utils = trpc.useUtils();

  const { data: incident, isLoading, error } = trpc.incidents.getById.useQuery(
    { id: incidentId },
    { enabled: incidentId > 0 }
  );

  const updateMutation = trpc.incidents.update.useMutation({
    onSuccess: () => {
      toast.success("Status aktualisiert");
      utils.incidents.getById.invalidate({ id: incidentId });
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  const deleteEvidenceMutation = trpc.incidents.deleteEvidence.useMutation({
    onSuccess: () => {
      toast.success("Beweis gelöscht");
      utils.incidents.getById.invalidate({ id: incidentId });
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  function refetchAll() {
    utils.incidents.getById.invalidate({ id: incidentId });
    utils.incidents.getStats.invalidate();
  }

  if (isLoading) {
    return (
      <ComplianceLayout>
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </ComplianceLayout>
    );
  }

  if (error || !incident) {
    return (
      <ComplianceLayout>
        <div className="p-6 text-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Schadensfall nicht gefunden.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/incidents")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Übersicht
          </Button>
        </div>
      </ComplianceLayout>
    );
  }

  const severity = SEVERITY_CONFIG[incident.severity as keyof typeof SEVERITY_CONFIG];
  const status = STATUS_CONFIG[incident.status as keyof typeof STATUS_CONFIG];
  const canInitiateRecall = !incident.recall && ["assessed", "under_review", "open"].includes(incident.status);

  return (
    <ComplianceLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/incidents")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold truncate">{incident.title}</h1>
              <Badge variant="outline" className={severity?.className}>{severity?.label}</Badge>
              <Badge variant="outline" className={status?.className}>{status?.label}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <ShieldAlert className="h-4 w-4" />
                {INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType}
              </span>
              {incident.product && (
                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {incident.product.productName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(incident.reportedAt).toLocaleDateString("de-CH")}
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Select
              value={incident.status}
              onValueChange={(v) => updateMutation.mutate({ id: incidentId, status: v as any })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canInitiateRecall && (
              <Button
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={() => setShowInitiateRecall(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Rückruf einleiten
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="evidence">
              Beweise
              {incident.evidences.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{incident.evidences.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assessment">
              Bewertung
              {incident.assessments.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{incident.assessments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recall">Rückruf</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vorfalldetails</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium">Beschreibung</span>
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{incident.description}</p>
                  </div>
                  {incident.affectedVersions && (incident.affectedVersions as string[]).length > 0 && (
                    <div>
                      <span className="font-medium">Betroffene Versionen</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(incident.affectedVersions as string[]).map((v: string) => (
                          <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {incident.affectedBatchNumbers && (incident.affectedBatchNumbers as string[]).length > 0 && (
                    <div>
                      <span className="font-medium">Betroffene Chargen</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(incident.affectedBatchNumbers as string[]).map((b: string) => (
                          <Badge key={b} variant="outline" className="text-xs font-mono">{b}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {incident.affectedUnitsEstimate && (
                    <div>
                      <span className="font-medium">Geschätzte betroffene Einheiten</span>
                      <p className="text-muted-foreground">{incident.affectedUnitsEstimate.toLocaleString("de-CH")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Melder</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {incident.reportedByName && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{incident.reportedByName}</span>
                    </div>
                  )}
                  {incident.reportedByEmail && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${incident.reportedByEmail}`} className="text-blue-600 hover:underline">
                        {incident.reportedByEmail}
                      </a>
                    </div>
                  )}
                  {incident.product && (
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>{incident.product.productName}</span>
                      {incident.product.internalArticleNumber && (
                        <span className="text-muted-foreground text-xs">({incident.product.internalArticleNumber})</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Personenschaden */}
              {incident.incidentType === "personal_injury" && (
                <Card className="md:col-span-2 border-red-200 bg-red-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Personenschaden-Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {incident.injuryDescription && (
                      <div className="col-span-2 md:col-span-4">
                        <span className="font-medium">Verletzungsbeschreibung</span>
                        <p className="text-muted-foreground mt-1">{incident.injuryDescription}</p>
                      </div>
                    )}
                    {incident.injuredPersonAge != null && (
                      <div>
                        <span className="font-medium">Alter</span>
                        <p className="text-muted-foreground">{incident.injuredPersonAge} Jahre</p>
                      </div>
                    )}
                    {incident.injuredPersonType && (
                      <div>
                        <span className="font-medium">Personentyp</span>
                        <p className="text-muted-foreground capitalize">{incident.injuredPersonType === "child" ? "Kind" : incident.injuredPersonType === "adult" ? "Erwachsener" : "Unbekannt"}</p>
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Arztbesuch</span>
                      <p className={incident.medicalTreatmentRequired ? "text-orange-600" : "text-muted-foreground"}>
                        {incident.medicalTreatmentRequired ? "Ja" : "Nein"}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Krankenhausaufenthalt</span>
                      <p className={incident.hospitalisation ? "text-red-600" : "text-muted-foreground"}>
                        {incident.hospitalisation ? "Ja" : "Nein"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── Evidence ── */}
          <TabsContent value="evidence" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Beweise & Dokumente</h2>
              <Button size="sm" onClick={() => setShowAddEvidence(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Beweis hinzufügen
              </Button>
            </div>
            {incident.evidences.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center text-muted-foreground">
                  <Paperclip className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Noch keine Beweise erfasst.</p>
                  <p className="text-sm mt-1">Fügen Sie Fotos, Kundenaussagen, Berichte oder Dokumente hinzu.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {incident.evidences.map((ev: any) => (
                  <Card key={ev.id}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="p-2 rounded-md bg-muted shrink-0">
                        {ev.mimeType?.startsWith("image/") ? (
                          <img src={ev.fileUrl} alt={ev.fileName} className="h-10 w-10 object-cover rounded" />
                        ) : (
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {EVIDENCE_TYPE_LABELS[ev.evidenceType] ?? ev.evidenceType}
                          </Badge>
                          <span className="text-sm font-medium truncate">{ev.fileName}</span>
                        </div>
                        {ev.description && (
                          <p className="text-xs text-muted-foreground">{ev.description}</p>
                        )}
                        {ev.textContent && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{ev.textContent}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(ev.uploadedAt).toLocaleString("de-CH")}
                          {ev.fileSizeBytes && ` · ${(ev.fileSizeBytes / 1024).toFixed(1)} KB`}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {ev.fileUrl !== "text://inline" && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteEvidenceMutation.mutate({ id: ev.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Assessment ── */}
          <TabsContent value="assessment" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Interne Bewertungen</h2>
              <Button size="sm" onClick={() => setShowAddAssessment(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Bewertung hinzufügen
              </Button>
            </div>
            {incident.assessments.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center text-muted-foreground">
                  <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Noch keine Bewertung erfasst.</p>
                  <p className="text-sm mt-1">Erfassen Sie eine interne Einschätzung des Risikos und der empfohlenen Massnahmen.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {incident.assessments.map((a: any) => {
                  const riskCfg = RISK_LEVEL_CONFIG[a.riskLevel as keyof typeof RISK_LEVEL_CONFIG];
                  return (
                    <Card key={a.id}>
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={riskCfg?.className}>
                            Risiko: {riskCfg?.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {a.assessmentType === "initial" ? "Erstbewertung" :
                             a.assessmentType === "technical" ? "Technisch" :
                             a.assessmentType === "legal" ? "Rechtlich" : "Abschluss"}
                          </Badge>
                          {a.recallRecommended && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Rückruf empfohlen
                            </Badge>
                          )}
                          {a.regulatoryObligation && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              <Building2 className="h-3 w-3 mr-1" />
                              Meldepflicht
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(a.createdAt).toLocaleString("de-CH")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{a.assessmentText}</p>
                        {a.requiredDocuments && (a.requiredDocuments as string[]).length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Benötigte Dokumente:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(a.requiredDocuments as string[]).map((d: string) => (
                                <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {a.regulatoryBasis && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Rechtliche Grundlage:</span> {a.regulatoryBasis}
                          </p>
                        )}
                        {a.internalNotes && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
                            <span className="font-medium">Interne Notiz:</span> {a.internalNotes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Recall ── */}
          <TabsContent value="recall" className="space-y-4 mt-4">
            {!incident.recall ? (
              <Card className="py-12">
                <CardContent className="text-center text-muted-foreground">
                  <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Kein Rückruf eingeleitet.</p>
                  {canInitiateRecall && (
                    <Button
                      className="mt-4 bg-orange-600 hover:bg-orange-700"
                      onClick={() => setShowInitiateRecall(true)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rückruf einleiten
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <RecallPanel recall={incident.recall} incidentId={incidentId} onUpdated={refetchAll} />
            )}
          </TabsContent>

          {/* ── Timeline ── */}
          <TabsContent value="timeline" className="mt-4">
            <div className="space-y-3">
              {incident.timeline.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="text-center text-muted-foreground">
                    <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Noch keine Aktivitäten.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4 pl-10">
                    {incident.timeline.map((entry: any) => (
                      <div key={entry.id} className="relative">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                        <div className="text-sm">
                          <span className="font-medium">{entry.action.replace(/_/g, " ")}</span>
                          {entry.note && <p className="text-muted-foreground mt-0.5">{entry.note}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(entry.createdAt).toLocaleString("de-CH")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <AddEvidenceDialog
        incidentId={incidentId}
        open={showAddEvidence}
        onClose={() => setShowAddEvidence(false)}
        onAdded={refetchAll}
      />
      <AddAssessmentDialog
        incidentId={incidentId}
        open={showAddAssessment}
        onClose={() => setShowAddAssessment(false)}
        onAdded={refetchAll}
      />
      <InitiateRecallDialog
        incidentId={incidentId}
        open={showInitiateRecall}
        onClose={() => setShowInitiateRecall(false)}
        onInitiated={refetchAll}
      />
    </ComplianceLayout>
  );
}

// ─── Recall Panel ─────────────────────────────────────────────────────────────

function RecallPanel({
  recall,
  incidentId,
  onUpdated,
}: {
  recall: any;
  incidentId: number;
  onUpdated: () => void;
}) {
  const [authorityNotified, setAuthorityNotified] = useState(recall.authorityNotified ?? false);

  const updateMutation = trpc.incidents.updateRecall.useMutation({
    onSuccess: () => {
      toast.success("Rückruf aktualisiert");
      onUpdated();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  const RECALL_STATUS_CONFIG = {
    planned: { label: "Geplant", className: "bg-gray-100 text-gray-700" },
    announced: { label: "Angekündigt", className: "bg-blue-100 text-blue-700" },
    active: { label: "Aktiv", className: "bg-orange-100 text-orange-700" },
    completed: { label: "Abgeschlossen", className: "bg-green-100 text-green-700" },
    cancelled: { label: "Abgebrochen", className: "bg-red-100 text-red-700" },
  } as const;

  const recallStatus = RECALL_STATUS_CONFIG[recall.status as keyof typeof RECALL_STATUS_CONFIG];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Rückruf-Details</h2>
          <Badge variant="outline" className={recallStatus?.className}>{recallStatus?.label}</Badge>
        </div>
        <Select
          value={recall.status}
          onValueChange={(v) => updateMutation.mutate({ recallId: recall.id, status: v as any })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RECALL_STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rückruf-Informationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Typ</span>
              <span className="font-medium capitalize">
                {recall.recallType === "voluntary" ? "Freiwillig" :
                 recall.recallType === "mandatory" ? "Behördlich" : "Gezielt"}
              </span>
            </div>
            {recall.affectedUnitsCount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Betroffene Einheiten</span>
                <span className="font-medium">{recall.affectedUnitsCount.toLocaleString("de-CH")}</span>
              </div>
            )}
            {recall.recallStartDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Startdatum</span>
                <span className="font-medium">{new Date(recall.recallStartDate).toLocaleDateString("de-CH")}</span>
              </div>
            )}
            {recall.remediationAction && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Massnahme</span>
                <span className="font-medium capitalize">
                  {recall.remediationAction === "refund" ? "Rückerstattung" :
                   recall.remediationAction === "replacement" ? "Ersatzprodukt" :
                   recall.remediationAction === "repair" ? "Reparatur" :
                   recall.remediationAction === "disposal" ? "Entsorgung" : "Sonstiges"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Behörden-Meldung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Checkbox
                id="authorityNotified"
                checked={authorityNotified}
                onCheckedChange={(v) => {
                  const checked = v === true;
                  setAuthorityNotified(checked);
                  updateMutation.mutate({
                    recallId: recall.id,
                    authorityNotified: checked,
                    authorityNotifiedAt: checked ? new Date() : undefined,
                  });
                }}
              />
              <Label htmlFor="authorityNotified" className="cursor-pointer">Behörden informiert</Label>
            </div>
            {recall.authorityNotifiedAt && (
              <p className="text-xs text-muted-foreground">
                Gemeldet am: {new Date(recall.authorityNotifiedAt).toLocaleString("de-CH")}
              </p>
            )}
            {recall.authorityNames && (recall.authorityNames as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(recall.authorityNames as string[]).map((a: string) => (
                  <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {recall.recallScope && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rückruf-Umfang</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{recall.recallScope}</p>
          </CardContent>
        </Card>
      )}

      {recall.announcementText && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ankündigungstext</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{recall.announcementText}</p>
          </CardContent>
        </Card>
      )}

      {recall.remediationInstructions && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Anweisungen für Kunden</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{recall.remediationInstructions}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
