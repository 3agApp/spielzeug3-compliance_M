/**
 * client/src/pages/IncidentDetail.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Detailseite für einen Schadensfall mit Beweisen, Bewertung, Rückruf und Timeline.
 * Supports DE and EN via useLang() hook.
 */
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import ComplianceLayout from "@/components/ComplianceLayout";
import { IncidentCostTracker } from "@/components/IncidentCostTracker";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
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
  FileText,
  RotateCcw,
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

// ─── Language-aware config helpers ────────────────────────────────────────────

function getSeverityConfig(lang: "de" | "en") {
  return {
    critical: { label: lang === "en" ? "Critical" : "Kritisch", className: "bg-red-100 text-red-800 border-red-200" },
    high: { label: lang === "en" ? "High" : "Hoch", className: "bg-orange-100 text-orange-800 border-orange-200" },
    medium: { label: lang === "en" ? "Medium" : "Mittel", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    low: { label: lang === "en" ? "Low" : "Niedrig", className: "bg-blue-100 text-blue-800 border-blue-200" },
  } as const;
}

function getStatusConfig(lang: "de" | "en") {
  return {
    open: { label: lang === "en" ? "Open" : "Offen", className: "bg-gray-100 text-gray-700" },
    under_review: { label: lang === "en" ? "Under Review" : "In Prüfung", className: "bg-blue-100 text-blue-700" },
    assessed: { label: lang === "en" ? "Assessed" : "Bewertet", className: "bg-purple-100 text-purple-700" },
    recall_initiated: { label: lang === "en" ? "Recall Initiated" : "Rückruf eingeleitet", className: "bg-orange-100 text-orange-700" },
    recall_completed: { label: lang === "en" ? "Recall Completed" : "Rückruf abgeschlossen", className: "bg-green-100 text-green-700" },
    closed: { label: lang === "en" ? "Closed" : "Geschlossen", className: "bg-gray-100 text-gray-500" },
    archived: { label: lang === "en" ? "Archived" : "Archiviert", className: "bg-gray-100 text-gray-400" },
  } as const;
}

function getIncidentTypeLabels(lang: "de" | "en"): Record<string, string> {
  return lang === "en" ? {
    personal_injury: "Personal Injury",
    property_damage: "Property Damage",
    near_miss: "Near Miss",
    product_defect: "Product Defect",
    regulatory_complaint: "Regulatory Complaint",
    customer_complaint: "Customer Complaint",
    other: "Other",
  } : {
    personal_injury: "Personenschaden",
    property_damage: "Sachschaden",
    near_miss: "Beinahe-Vorfall",
    product_defect: "Produktmangel",
    regulatory_complaint: "Behördenbeschwerde",
    customer_complaint: "Kundenbeschwerde",
    other: "Sonstiges",
  };
}

function getEvidenceTypeLabels(lang: "de" | "en"): Record<string, string> {
  return lang === "en" ? {
    photo: "Photo",
    customer_statement: "Customer Statement",
    internal_report: "Internal Report",
    medical_report: "Medical Report",
    authority_document: "Authority Document",
    product_sample: "Product Sample",
    video: "Video",
    other: "Other",
  } : {
    photo: "Foto",
    customer_statement: "Kundenaussage",
    internal_report: "Interner Bericht",
    medical_report: "Arztbericht",
    authority_document: "Behördendokument",
    product_sample: "Produktprobe",
    video: "Video",
    other: "Sonstiges",
  };
}

function getRiskLevelConfig(lang: "de" | "en") {
  return {
    critical: { label: lang === "en" ? "Critical" : "Kritisch", className: "bg-red-100 text-red-800" },
    high: { label: lang === "en" ? "High" : "Hoch", className: "bg-orange-100 text-orange-800" },
    medium: { label: lang === "en" ? "Medium" : "Mittel", className: "bg-yellow-100 text-yellow-800" },
    low: { label: lang === "en" ? "Low" : "Niedrig", className: "bg-blue-100 text-blue-800" },
    none: { label: lang === "en" ? "No Risk" : "Kein Risiko", className: "bg-gray-100 text-gray-700" },
  } as const;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AddEvidenceDialog({
  incidentId,
  open,
  onClose,
  onAdded,
  lang,
}: {
  incidentId: number;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  lang: "de" | "en";
}) {
  const T = lang === "en" ? {
    title: "Add Evidence / Document",
    evidenceType: "Evidence Type",
    description: "Description",
    descriptionPlaceholder: "Short description of the evidence...",
    uploadFile: "Upload File",
    orEnterText: "or enter text",
    textLabel: "Statement / Report (Text)",
    textPlaceholder: "Customer statement, internal assessment, authority correspondence...",
    cancel: "Cancel",
    add: "Add",
    uploading: "Uploading...",
    successFile: "Evidence added",
    successText: "Statement / report added",
    errorNoInput: "Please select a file or enter text.",
  } : {
    title: "Beweis / Dokument hinzufügen",
    evidenceType: "Beweistyp",
    description: "Beschreibung",
    descriptionPlaceholder: "Kurze Beschreibung des Beweismittels...",
    uploadFile: "Datei hochladen",
    orEnterText: "oder Text eingeben",
    textLabel: "Aussage / Bericht (Text)",
    textPlaceholder: "Kundenaussage, interne Einschätzung, Behördenkorrespondenz...",
    cancel: "Abbrechen",
    add: "Hinzufügen",
    uploading: "Wird hochgeladen...",
    successFile: "Beweis hinzugefügt",
    successText: "Aussage / Bericht hinzugefügt",
    errorNoInput: "Bitte eine Datei auswählen oder Text eingeben.",
  };

  const evidenceTypeLabels = getEvidenceTypeLabels(lang);

  const [evidenceType, setEvidenceType] = useState("photo");
  const [description, setDescription] = useState("");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = trpc.incidents.uploadEvidence.useMutation({
    onSuccess: () => {
      toast.success(T.successFile);
      onAdded();
      onClose();
      resetForm();
    },
    onError: (err) => toast.error(`${lang === "en" ? "Error" : "Fehler"}: ${err.message}`),
  });

  const addTextMutation = trpc.incidents.addEvidence.useMutation({
    onSuccess: () => {
      toast.success(T.successText);
      onAdded();
      onClose();
      resetForm();
    },
    onError: (err) => toast.error(`${lang === "en" ? "Error" : "Fehler"}: ${err.message}`),
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
        fileName: `${evidenceTypeLabels[evidenceType] ?? evidenceType} – ${new Date().toLocaleDateString(lang === "en" ? "en-GB" : "de-CH")}`,
        fileUrl: "text://inline",
        fileKey: `text-${Date.now()}`,
        description: description.trim() || undefined,
        sourceType: "text",
        textContent: textContent.trim(),
      });
    } else {
      toast.error(T.errorNoInput);
    }
  }

  const isPending = uploading || uploadMutation.isPending || addTextMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{T.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{T.evidenceType}</Label>
            <Select value={evidenceType} onValueChange={setEvidenceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(evidenceTypeLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{T.description}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={T.descriptionPlaceholder}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{T.uploadFile}</Label>
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
              <span className="bg-background px-2 text-muted-foreground">{T.orEnterText}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{T.textLabel}</Label>
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder={T.textPlaceholder}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{T.cancel}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? T.uploading : T.add}
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
  lang,
}: {
  incidentId: number;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  lang: "de" | "en";
}) {
  const T = lang === "en" ? {
    title: "Add Internal Assessment",
    aiTitle: "AI Risk Assessment",
    aiConfidence: "Confidence",
    aiHigh: "High",
    aiMedium: "Medium",
    aiLow: "Low",
    aiApply: "Apply Suggestion",
    aiStart: "Start AI Analysis",
    aiAnalysing: "Analysing...",
    aiRecommendation: "Recommendation:",
    aiRisk: "Risk:",
    aiRecallRecommended: "Recall recommended",
    aiReportingObligation: "Reporting obligation",
    aiImmediately: "immediately",
    aiDays: "days",
    aiRegulations: "Standards:",
    aiCaveats: "Caveats:",
    aiDescription: "Start the AI analysis to automatically receive a risk assessment based on the incident description and product data.",
    assessmentType: "Assessment Type",
    assessmentTypeInitial: "Initial Assessment",
    assessmentTypeTechnical: "Technical Assessment",
    assessmentTypeLegal: "Legal Assessment",
    assessmentTypeFinal: "Final Assessment",
    riskLevel: "Risk Level *",
    riskCritical: "Critical",
    riskHigh: "High",
    riskMedium: "Medium",
    riskLow: "Low",
    riskNone: "No Risk",
    assessmentText: "Assessment *",
    assessmentPlaceholder: "Detailed internal assessment of the incident, causes, and recommended actions...",
    recallRecommended: "Recall recommended",
    recallScope: "Recall Scope",
    recallScopeNone: "No Recall",
    recallScopeTargeted: "Targeted Recall (specific batches)",
    recallScopeVoluntary: "Voluntary Recall",
    recallScopeMandatory: "Mandatory Recall",
    reportingObligation: "Reporting obligation to authorities",
    legalBasis: "Legal Basis",
    legalBasisPlaceholder: "e.g. GPSR Art. 9, PrSG §10, REACH...",
    requiredDocuments: "Required Documents",
    requiredDocumentsPlaceholder: "Test report, declaration of conformity, medical report (comma-separated)",
    internalNotes: "Internal Notes",
    internalNotesPlaceholder: "Internal notes that should not appear in the official report...",
    cancel: "Cancel",
    save: "Save Assessment",
    saving: "Saving...",
    successSaved: "Assessment saved",
    errorRequired: "Assessment text is required.",
    aiSuccess: "AI suggestion created – apply or adjust",
    aiError: "AI analysis failed",
    applicableRegs: "\n\nApplicable Standards: ",
    aiApplied: "AI suggestion applied",
  } : {
    title: "Interne Bewertung hinzufügen",
    aiTitle: "KI-Risikoeinschätzung",
    aiConfidence: "Konfidenz",
    aiHigh: "Hoch",
    aiMedium: "Mittel",
    aiLow: "Niedrig",
    aiApply: "Vorschlag übernehmen",
    aiStart: "KI-Analyse starten",
    aiAnalysing: "Analysiere...",
    aiRecommendation: "Empfehlung:",
    aiRisk: "Risiko:",
    aiRecallRecommended: "Rückruf empfohlen",
    aiReportingObligation: "Meldepflicht",
    aiImmediately: "sofort",
    aiDays: "Tage",
    aiRegulations: "Normen:",
    aiCaveats: "Vorbehalte:",
    aiDescription: "Starten Sie die KI-Analyse, um automatisch eine Risikoeinschätzung basierend auf Fallbeschreibung und Produktdaten zu erhalten.",
    assessmentType: "Bewertungstyp",
    assessmentTypeInitial: "Erstbewertung",
    assessmentTypeTechnical: "Technische Bewertung",
    assessmentTypeLegal: "Rechtliche Bewertung",
    assessmentTypeFinal: "Abschlussbewertung",
    riskLevel: "Risikoniveau *",
    riskCritical: "Kritisch",
    riskHigh: "Hoch",
    riskMedium: "Mittel",
    riskLow: "Niedrig",
    riskNone: "Kein Risiko",
    assessmentText: "Bewertung *",
    assessmentPlaceholder: "Detaillierte interne Einschätzung des Vorfalls, der Ursachen und empfohlenen Massnahmen...",
    recallRecommended: "Rückruf empfohlen",
    recallScope: "Rückruf-Umfang",
    recallScopeNone: "Kein Rückruf",
    recallScopeTargeted: "Gezielter Rückruf (bestimmte Chargen)",
    recallScopeVoluntary: "Freiwilliger Rückruf",
    recallScopeMandatory: "Behördlich angeordneter Rückruf",
    reportingObligation: "Meldepflicht gegenüber Behörden",
    legalBasis: "Rechtliche Grundlage",
    legalBasisPlaceholder: "z.B. GPSR Art. 9, PrSG §10, REACH...",
    requiredDocuments: "Benötigte Dokumente",
    requiredDocumentsPlaceholder: "Prüfbericht, Konformitätserklärung, Arztbericht (kommagetrennt)",
    internalNotes: "Interne Notizen",
    internalNotesPlaceholder: "Interne Hinweise, die nicht im offiziellen Bericht erscheinen sollen...",
    cancel: "Abbrechen",
    save: "Bewertung speichern",
    saving: "Wird gespeichert...",
    successSaved: "Bewertung gespeichert",
    errorRequired: "Bewertungstext ist ein Pflichtfeld.",
    aiSuccess: "KI-Vorschlag erstellt – jetzt übernehmen oder anpassen",
    aiError: "KI-Analyse fehlgeschlagen",
    applicableRegs: "\n\nRelevante Normen: ",
    aiApplied: "KI-Vorschlag übernommen",
  };

  const [riskLevel, setRiskLevel] = useState("medium");
  const [assessmentType, setAssessmentType] = useState("initial");
  const [recallRecommended, setRecallRecommended] = useState(false);
  const [recallScope, setRecallScope] = useState("none");
  const [assessmentText, setAssessmentText] = useState("");
  const [regulatoryObligation, setRegulatoryObligation] = useState(false);
  const [regulatoryBasis, setRegulatoryBasis] = useState("");
  const [requiredDocuments, setRequiredDocuments] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const aiMutation = trpc.incidents.suggestAssessment.useMutation({
    onSuccess: (data) => {
      setAiSuggestion(data);
      setShowAiPanel(true);
      toast.success(T.aiSuccess);
    },
    onError: (err) => toast.error(`${T.aiError}: ${err.message}`),
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
      ? `${T.applicableRegs}${aiSuggestion.applicableRegulations.join(", ")}`
      : "";
    setAssessmentText((aiSuggestion.assessmentText ?? "") + regs);
    toast.success(T.aiApplied);
  }

  const mutation = trpc.incidents.addAssessment.useMutation({
    onSuccess: () => {
      toast.success(T.successSaved);
      onAdded();
      onClose();
    },
    onError: (err) => toast.error(`${lang === "en" ? "Error" : "Fehler"}: ${err.message}`),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assessmentText.trim()) {
      toast.error(T.errorRequired);
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

  const confidenceLabel = (c: string) => {
    if (c === "high") return T.aiHigh;
    if (c === "medium") return T.aiMedium;
    return T.aiLow;
  };

  const riskLabel = (r: string) => {
    if (r === "critical") return T.riskCritical;
    if (r === "high") return T.riskHigh;
    if (r === "medium") return T.riskMedium;
    if (r === "low") return T.riskLow;
    return T.riskNone;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{T.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* AI Banner */}
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-medium text-violet-800">{T.aiTitle}</span>
                {aiSuggestion && (
                  <span className="text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                    {T.aiConfidence}: {confidenceLabel(aiSuggestion.confidence)}
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
                      {T.aiApply}
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
                    <><span className="animate-spin mr-1">&#9696;</span> {T.aiAnalysing}</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" /> {T.aiStart}</>
                  )}
                </Button>
              </div>
            </div>
            {aiSuggestion && showAiPanel && (
              <div className="mt-3 space-y-2 text-sm border-t border-violet-200 pt-3">
                <div className="flex flex-wrap gap-2">
                  <span className="font-medium text-violet-800">{T.aiRecommendation}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    aiSuggestion.riskLevel === "critical" ? "bg-red-100 text-red-800" :
                    aiSuggestion.riskLevel === "high" ? "bg-orange-100 text-orange-800" :
                    aiSuggestion.riskLevel === "medium" ? "bg-yellow-100 text-yellow-800" :
                    "bg-blue-100 text-blue-800"
                  }`}>
                    {T.aiRisk} {riskLabel(aiSuggestion.riskLevel)}
                  </span>
                  {aiSuggestion.recallRecommended && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      {T.aiRecallRecommended}
                    </span>
                  )}
                  {aiSuggestion.regulatoryObligation && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                      {T.aiReportingObligation}: {aiSuggestion.regulatoryDeadlineDays === 0 ? T.aiImmediately : aiSuggestion.regulatoryDeadlineDays ? `${aiSuggestion.regulatoryDeadlineDays} ${T.aiDays}` : "ja"}
                    </span>
                  )}
                </div>
                <p className="text-violet-700 text-xs leading-relaxed">{aiSuggestion.summary}</p>
                {Array.isArray(aiSuggestion.applicableRegulations) && aiSuggestion.applicableRegulations.length > 0 && (
                  <p className="text-xs text-violet-600">
                    <span className="font-medium">{T.aiRegulations}</span> {aiSuggestion.applicableRegulations.join(" · ")}
                  </p>
                )}
                {Array.isArray(aiSuggestion.caveats) && aiSuggestion.caveats.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2">
                    <p className="text-xs font-medium text-amber-800 mb-1">{T.aiCaveats}</p>
                    {aiSuggestion.caveats.map((c: string, i: number) => (
                      <p key={i} className="text-xs text-amber-700">&#8226; {c}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!aiSuggestion && (
              <p className="text-xs text-violet-600 mt-1">{T.aiDescription}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{T.assessmentType}</Label>
              <Select value={assessmentType} onValueChange={setAssessmentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial">{T.assessmentTypeInitial}</SelectItem>
                  <SelectItem value="technical">{T.assessmentTypeTechnical}</SelectItem>
                  <SelectItem value="legal">{T.assessmentTypeLegal}</SelectItem>
                  <SelectItem value="final">{T.assessmentTypeFinal}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{T.riskLevel}</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">{T.riskCritical}</SelectItem>
                  <SelectItem value="high">{T.riskHigh}</SelectItem>
                  <SelectItem value="medium">{T.riskMedium}</SelectItem>
                  <SelectItem value="low">{T.riskLow}</SelectItem>
                  <SelectItem value="none">{T.riskNone}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{T.assessmentText}</Label>
            <Textarea
              value={assessmentText}
              onChange={(e) => setAssessmentText(e.target.value)}
              placeholder={T.assessmentPlaceholder}
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
                {T.recallRecommended}
              </Label>
            </div>
            {recallRecommended && (
              <div className="space-y-1.5 ml-6">
                <Label>{T.recallScope}</Label>
                <Select value={recallScope} onValueChange={setRecallScope}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{T.recallScopeNone}</SelectItem>
                    <SelectItem value="targeted">{T.recallScopeTargeted}</SelectItem>
                    <SelectItem value="voluntary">{T.recallScopeVoluntary}</SelectItem>
                    <SelectItem value="mandatory">{T.recallScopeMandatory}</SelectItem>
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
                {T.reportingObligation}
              </Label>
            </div>
            {regulatoryObligation && (
              <div className="space-y-1.5 ml-6">
                <Label>{T.legalBasis}</Label>
                <Input
                  value={regulatoryBasis}
                  onChange={(e) => setRegulatoryBasis(e.target.value)}
                  placeholder={T.legalBasisPlaceholder}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{T.requiredDocuments}</Label>
            <Input
              value={requiredDocuments}
              onChange={(e) => setRequiredDocuments(e.target.value)}
              placeholder={T.requiredDocumentsPlaceholder}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{T.internalNotes}</Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder={T.internalNotesPlaceholder}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{T.cancel}</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? T.saving : T.save}
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
  lang,
}: {
  incidentId: number;
  open: boolean;
  onClose: () => void;
  onInitiated: () => void;
  lang: "de" | "en";
}) {
  const T = lang === "en" ? {
    title: "Initiate Recall",
    recallType: "Recall Type *",
    recallTypeVoluntary: "Voluntary Recall",
    recallTypeMandatory: "Mandatory Recall",
    recallTypeTargeted: "Targeted Recall",
    startDate: "Start Date",
    recallScope: "Recall Scope / Affected Products *",
    recallScopePlaceholder: "Which products, versions, batches, and markets are affected? What criteria define the recall scope?",
    affectedUnits: "Number of Affected Units",
    affectedUnitsPlaceholder: "e.g. 1500",
    remediationAction: "Customer Remedy",
    remediationRefund: "Refund",
    remediationReplacement: "Replacement",
    remediationRepair: "Repair",
    remediationDisposal: "Disposal",
    remediationOther: "Other",
    customerInstructions: "Customer Instructions",
    customerInstructionsPlaceholder: "What should customers do? Return, contact, etc.",
    announcement: "Announcement Text (for customers / public)",
    announcementPlaceholder: "Official text for the recall announcement...",
    authorities: "Involved Authorities",
    authoritiesPlaceholder: "BAZG, SECO, Stiftung Warentest (comma-separated)",
    cancel: "Cancel",
    initiate: "Initiate Recall",
    initiating: "Initiating...",
    success: "Recall initiated",
    errorRequired: "Recall scope is required.",
  } : {
    title: "Rückruf einleiten",
    recallType: "Rückruf-Typ *",
    recallTypeVoluntary: "Freiwilliger Rückruf",
    recallTypeMandatory: "Behördlich angeordneter Rückruf",
    recallTypeTargeted: "Gezielter Rückruf",
    startDate: "Startdatum",
    recallScope: "Rückruf-Umfang / betroffene Produkte *",
    recallScopePlaceholder: "Welche Produkte, Versionen, Chargen und Märkte sind betroffen? Welche Kriterien definieren den Rückruf-Umfang?",
    affectedUnits: "Anzahl betroffener Einheiten",
    affectedUnitsPlaceholder: "z.B. 1500",
    remediationAction: "Massnahme für Kunden",
    remediationRefund: "Rückerstattung",
    remediationReplacement: "Ersatzprodukt",
    remediationRepair: "Reparatur",
    remediationDisposal: "Entsorgung",
    remediationOther: "Sonstiges",
    customerInstructions: "Anweisungen für Kunden",
    customerInstructionsPlaceholder: "Wie sollen Kunden vorgehen? Rücksendung, Kontaktaufnahme, etc.",
    announcement: "Ankündigungstext (für Kunden / Öffentlichkeit)",
    announcementPlaceholder: "Offizieller Text für die Rückruf-Ankündigung...",
    authorities: "Beteiligte Behörden",
    authoritiesPlaceholder: "BAZG, SECO, Stiftung Warentest (kommagetrennt)",
    cancel: "Abbrechen",
    initiate: "Rückruf einleiten",
    initiating: "Wird eingeleitet...",
    success: "Rückruf eingeleitet",
    errorRequired: "Rückruf-Umfang ist ein Pflichtfeld.",
  };

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
      toast.success(T.success);
      onInitiated();
      onClose();
    },
    onError: (err) => toast.error(`${lang === "en" ? "Error" : "Fehler"}: ${err.message}`),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recallScope.trim()) {
      toast.error(T.errorRequired);
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
            {T.title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{T.recallType}</Label>
              <Select value={recallType} onValueChange={setRecallType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voluntary">{T.recallTypeVoluntary}</SelectItem>
                  <SelectItem value="mandatory">{T.recallTypeMandatory}</SelectItem>
                  <SelectItem value="targeted">{T.recallTypeTargeted}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{T.startDate}</Label>
              <Input
                type="date"
                value={recallStartDate}
                onChange={(e) => setRecallStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{T.recallScope}</Label>
            <Textarea
              value={recallScope}
              onChange={(e) => setRecallScope(e.target.value)}
              placeholder={T.recallScopePlaceholder}
              rows={3}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>{T.affectedUnits}</Label>
            <Input
              type="number"
              min="1"
              value={affectedUnitsCount}
              onChange={(e) => setAffectedUnitsCount(e.target.value)}
              placeholder={T.affectedUnitsPlaceholder}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{T.remediationAction}</Label>
            <Select value={remediationAction} onValueChange={setRemediationAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="refund">{T.remediationRefund}</SelectItem>
                <SelectItem value="replacement">{T.remediationReplacement}</SelectItem>
                <SelectItem value="repair">{T.remediationRepair}</SelectItem>
                <SelectItem value="disposal">{T.remediationDisposal}</SelectItem>
                <SelectItem value="other">{T.remediationOther}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{T.customerInstructions}</Label>
            <Textarea
              value={remediationInstructions}
              onChange={(e) => setRemediationInstructions(e.target.value)}
              placeholder={T.customerInstructionsPlaceholder}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{T.announcement}</Label>
            <Textarea
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder={T.announcementPlaceholder}
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{T.authorities}</Label>
            <Input
              value={authorityNames}
              onChange={(e) => setAuthorityNames(e.target.value)}
              placeholder={T.authoritiesPlaceholder}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{T.cancel}</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {mutation.isPending ? T.initiating : T.initiate}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IncidentDetail() {
  const { lang } = useLang();
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

  const SEVERITY_CONFIG = getSeverityConfig(lang);
  const STATUS_CONFIG = getStatusConfig(lang);
  const INCIDENT_TYPE_LABELS = getIncidentTypeLabels(lang);
  const EVIDENCE_TYPE_LABELS = getEvidenceTypeLabels(lang);
  const RISK_LEVEL_CONFIG = getRiskLevelConfig(lang);

  const T = lang === "en" ? {
    notFound: "Incident not found.",
    backToList: "Back to Overview",
    initiateRecall: "Initiate Recall",
    tabOverview: "Overview",
    tabEvidence: "Evidence",
    tabAssessment: "Assessment",
    tabRecall: "Recall",
    tabCosts: "Costs",
    tabTimeline: "Timeline",
    incidentDetails: "Incident Details",
    description: "Description",
    affectedVersions: "Affected Versions",
    affectedBatches: "Affected Batches",
    estimatedUnits: "Estimated Affected Units",
    reporter: "Reporter",
    personalInjuryDetails: "Personal Injury Details",
    injuryDescription: "Injury Description",
    age: "Age",
    years: "years",
    personType: "Person Type",
    personTypeChild: "Child",
    personTypeAdult: "Adult",
    personTypeUnknown: "Unknown",
    medicalTreatment: "Medical Treatment",
    hospitalisation: "Hospitalisation",
    yes: "Yes",
    no: "No",
    evidenceTitle: "Evidence & Documents",
    addEvidence: "Add Evidence",
    noEvidence: "No evidence recorded yet.",
    noEvidenceHint: "Add photos, customer statements, reports, or documents.",
    assessmentTitle: "Internal Assessments",
    addAssessment: "Add Assessment",
    noAssessment: "No assessment recorded yet.",
    noAssessmentHint: "Record an internal assessment of the risk and recommended actions.",
    riskPrefix: "Risk:",
    assessmentTypeInitial: "Initial",
    assessmentTypeTechnical: "Technical",
    assessmentTypeLegal: "Legal",
    assessmentTypeFinal: "Final",
    recallRecommended: "Recall recommended",
    reportingObligation: "Reporting obligation",
    requiredDocuments: "Required Documents:",
    legalBasis: "Legal Basis:",
    internalNote: "Internal Note:",
    noRecall: "No recall initiated.",
    noTimeline: "No activities yet.",
    statusUpdated: "Status updated",
    evidenceDeleted: "Evidence deleted",
    deleteError: "Error",
    updateError: "Error",
  } : {
    notFound: "Schadensfall nicht gefunden.",
    backToList: "Zurück zur Übersicht",
    initiateRecall: "Rückruf einleiten",
    tabOverview: "Übersicht",
    tabEvidence: "Beweise",
    tabAssessment: "Bewertung",
    tabRecall: "Rückruf",
    tabCosts: "Kosten",
    tabTimeline: "Timeline",
    incidentDetails: "Vorfalldetails",
    description: "Beschreibung",
    affectedVersions: "Betroffene Versionen",
    affectedBatches: "Betroffene Chargen",
    estimatedUnits: "Geschätzte betroffene Einheiten",
    reporter: "Melder",
    personalInjuryDetails: "Personenschaden-Details",
    injuryDescription: "Verletzungsbeschreibung",
    age: "Alter",
    years: "Jahre",
    personType: "Personentyp",
    personTypeChild: "Kind",
    personTypeAdult: "Erwachsener",
    personTypeUnknown: "Unbekannt",
    medicalTreatment: "Arztbesuch",
    hospitalisation: "Krankenhausaufenthalt",
    yes: "Ja",
    no: "Nein",
    evidenceTitle: "Beweise & Dokumente",
    addEvidence: "Beweis hinzufügen",
    noEvidence: "Noch keine Beweise erfasst.",
    noEvidenceHint: "Fügen Sie Fotos, Kundenaussagen, Berichte oder Dokumente hinzu.",
    assessmentTitle: "Interne Bewertungen",
    addAssessment: "Bewertung hinzufügen",
    noAssessment: "Noch keine Bewertung erfasst.",
    noAssessmentHint: "Erfassen Sie eine interne Einschätzung des Risikos und der empfohlenen Massnahmen.",
    riskPrefix: "Risiko:",
    assessmentTypeInitial: "Erstbewertung",
    assessmentTypeTechnical: "Technisch",
    assessmentTypeLegal: "Rechtlich",
    assessmentTypeFinal: "Abschluss",
    recallRecommended: "Rückruf empfohlen",
    reportingObligation: "Meldepflicht",
    requiredDocuments: "Benötigte Dokumente:",
    legalBasis: "Rechtliche Grundlage:",
    internalNote: "Interne Notiz:",
    noRecall: "Kein Rückruf eingeleitet.",
    noTimeline: "Noch keine Aktivitäten.",
    statusUpdated: "Status aktualisiert",
    evidenceDeleted: "Beweis gelöscht",
    deleteError: "Fehler",
    updateError: "Fehler",
  };

  const locale = lang === "en" ? "en-GB" : "de-CH";

  const updateMutation = trpc.incidents.update.useMutation({
    onSuccess: () => {
      toast.success(T.statusUpdated);
      utils.incidents.getById.invalidate({ id: incidentId });
    },
    onError: (err) => toast.error(`${T.updateError}: ${err.message}`),
  });

  const deleteEvidenceMutation = trpc.incidents.deleteEvidence.useMutation({
    onSuccess: () => {
      toast.success(T.evidenceDeleted);
      utils.incidents.getById.invalidate({ id: incidentId });
    },
    onError: (err) => toast.error(`${T.deleteError}: ${err.message}`),
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
          <p>{T.notFound}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/incidents")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {T.backToList}
          </Button>
        </div>
      </ComplianceLayout>
    );
  }

  const severity = SEVERITY_CONFIG[incident.severity as keyof typeof SEVERITY_CONFIG];
  const status = STATUS_CONFIG[incident.status as keyof typeof STATUS_CONFIG];
  const canInitiateRecall = !incident.recall && ["assessed", "under_review", "open"].includes(incident.status);

  const assessmentTypeLabel = (t: string) => {
    if (t === "initial") return T.assessmentTypeInitial;
    if (t === "technical") return T.assessmentTypeTechnical;
    if (t === "legal") return T.assessmentTypeLegal;
    return T.assessmentTypeFinal;
  };

  const personTypeLabel = (t: string) => {
    if (t === "child") return T.personTypeChild;
    if (t === "adult") return T.personTypeAdult;
    return T.personTypeUnknown;
  };

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
                {new Date(incident.reportedAt).toLocaleDateString(locale)}
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
                {T.initiateRecall}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
          <Tabs defaultValue={window.location.hash === "#costs" ? "costs" : "overview"}>
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full max-w-3xl h-auto">
            <TabsTrigger value="overview">{T.tabOverview}</TabsTrigger>
            <TabsTrigger value="evidence">
              {T.tabEvidence}
              {incident.evidences.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{incident.evidences.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assessment">
              {T.tabAssessment}
              {incident.assessments.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{incident.assessments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recall">{T.tabRecall}</TabsTrigger>
            <TabsTrigger value="costs">{T.tabCosts}</TabsTrigger>
            <TabsTrigger value="timeline">{T.tabTimeline}</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{T.incidentDetails}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium">{T.description}</span>
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{incident.description}</p>
                  </div>
                  {incident.affectedVersions && (incident.affectedVersions as string[]).length > 0 && (
                    <div>
                      <span className="font-medium">{T.affectedVersions}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(incident.affectedVersions as string[]).map((v: string) => (
                          <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {incident.affectedBatchNumbers && (incident.affectedBatchNumbers as string[]).length > 0 && (
                    <div>
                      <span className="font-medium">{T.affectedBatches}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(incident.affectedBatchNumbers as string[]).map((b: string) => (
                          <Badge key={b} variant="outline" className="text-xs font-mono">{b}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {incident.affectedUnitsEstimate && (
                    <div>
                      <span className="font-medium">{T.estimatedUnits}</span>
                      <p className="text-muted-foreground">{incident.affectedUnitsEstimate.toLocaleString(locale)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{T.reporter}</CardTitle>
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

              {/* Personal Injury Details */}
              {incident.incidentType === "personal_injury" && (
                <Card className="md:col-span-2 border-red-200 bg-red-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {T.personalInjuryDetails}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {incident.injuryDescription && (
                      <div className="col-span-2 md:col-span-4">
                        <span className="font-medium">{T.injuryDescription}</span>
                        <p className="text-muted-foreground mt-1">{incident.injuryDescription}</p>
                      </div>
                    )}
                    {incident.injuredPersonAge != null && (
                      <div>
                        <span className="font-medium">{T.age}</span>
                        <p className="text-muted-foreground">{incident.injuredPersonAge} {T.years}</p>
                      </div>
                    )}
                    {incident.injuredPersonType && (
                      <div>
                        <span className="font-medium">{T.personType}</span>
                        <p className="text-muted-foreground capitalize">{personTypeLabel(incident.injuredPersonType)}</p>
                      </div>
                    )}
                    <div>
                      <span className="font-medium">{T.medicalTreatment}</span>
                      <p className={incident.medicalTreatmentRequired ? "text-orange-600" : "text-muted-foreground"}>
                        {incident.medicalTreatmentRequired ? T.yes : T.no}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">{T.hospitalisation}</span>
                      <p className={incident.hospitalisation ? "text-red-600" : "text-muted-foreground"}>
                        {incident.hospitalisation ? T.yes : T.no}
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
              <h2 className="font-semibold">{T.evidenceTitle}</h2>
              <Button size="sm" onClick={() => setShowAddEvidence(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {T.addEvidence}
              </Button>
            </div>
            {incident.evidences.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center text-muted-foreground">
                  <Paperclip className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>{T.noEvidence}</p>
                  <p className="text-sm mt-1">{T.noEvidenceHint}</p>
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
                          {new Date(ev.uploadedAt).toLocaleString(locale)}
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
              <h2 className="font-semibold">{T.assessmentTitle}</h2>
              <Button size="sm" onClick={() => setShowAddAssessment(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {T.addAssessment}
              </Button>
            </div>
            {incident.assessments.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center text-muted-foreground">
                  <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>{T.noAssessment}</p>
                  <p className="text-sm mt-1">{T.noAssessmentHint}</p>
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
                            {T.riskPrefix} {riskCfg?.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {assessmentTypeLabel(a.assessmentType)}
                          </Badge>
                          {a.recallRecommended && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              {T.recallRecommended}
                            </Badge>
                          )}
                          {a.regulatoryObligation && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              <Building2 className="h-3 w-3 mr-1" />
                              {T.reportingObligation}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(a.createdAt).toLocaleString(locale)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{a.assessmentText}</p>
                        {a.requiredDocuments && (a.requiredDocuments as string[]).length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">{T.requiredDocuments}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(a.requiredDocuments as string[]).map((d: string) => (
                                <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {a.regulatoryBasis && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">{T.legalBasis}</span> {a.regulatoryBasis}
                          </p>
                        )}
                        {a.internalNotes && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
                            <span className="font-medium">{T.internalNote}</span> {a.internalNotes}
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
                  <p>{T.noRecall}</p>
                  {canInitiateRecall && (
                    <Button
                      className="mt-4 bg-orange-600 hover:bg-orange-700"
                      onClick={() => setShowInitiateRecall(true)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {T.initiateRecall}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <RecallPanel recall={incident.recall} incidentId={incidentId} onUpdated={refetchAll} lang={lang} />
            )}
          </TabsContent>

          {/* ── Costs ── */}
          <TabsContent value="costs" className="space-y-4 mt-4">
            <IncidentCostTracker incidentId={incidentId} />
          </TabsContent>

          {/* ── Timeline ── */}
          <TabsContent value="timeline" className="mt-4">
            <div className="space-y-3">
              {incident.timeline.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="text-center text-muted-foreground">
                    <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>{T.noTimeline}</p>
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
                            {new Date(entry.createdAt).toLocaleString(locale)}
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
        lang={lang}
      />
      <AddAssessmentDialog
        incidentId={incidentId}
        open={showAddAssessment}
        onClose={() => setShowAddAssessment(false)}
        onAdded={refetchAll}
        lang={lang}
      />
      <InitiateRecallDialog
        incidentId={incidentId}
        open={showInitiateRecall}
        onClose={() => setShowInitiateRecall(false)}
        onInitiated={refetchAll}
        lang={lang}
      />
    </ComplianceLayout>
  );
}

// ─── Recall Panel ─────────────────────────────────────────────────────────────

function RecallPanel({
  recall,
  incidentId,
  onUpdated,
  lang,
}: {
  recall: any;
  incidentId: number;
  onUpdated: () => void;
  lang: "de" | "en";
}) {
  const T = lang === "en" ? {
    title: "Recall Details",
    recallInfo: "Recall Information",
    type: "Type",
    typeVoluntary: "Voluntary",
    typeMandatory: "Mandatory",
    typeTargeted: "Targeted",
    affectedUnits: "Affected Units",
    startDate: "Start Date",
    remedy: "Remedy",
    remedyRefund: "Refund",
    remedyReplacement: "Replacement",
    remedyRepair: "Repair",
    remedyDisposal: "Disposal",
    remedyOther: "Other",
    authorityNotification: "Authority Notification",
    authoritiesNotified: "Authorities Notified",
    reportedOn: "Reported on:",
    recallScope: "Recall Scope",
    announcement: "Announcement Text",
    customerInstructions: "Customer Instructions",
    updated: "Recall updated",
    updateError: "Error",
    statusPlanned: "Planned",
    statusAnnounced: "Announced",
    statusActive: "Active",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
  } : {
    title: "Rückruf-Details",
    recallInfo: "Rückruf-Informationen",
    type: "Typ",
    typeVoluntary: "Freiwillig",
    typeMandatory: "Behördlich",
    typeTargeted: "Gezielt",
    affectedUnits: "Betroffene Einheiten",
    startDate: "Startdatum",
    remedy: "Massnahme",
    remedyRefund: "Rückerstattung",
    remedyReplacement: "Ersatzprodukt",
    remedyRepair: "Reparatur",
    remedyDisposal: "Entsorgung",
    remedyOther: "Sonstiges",
    authorityNotification: "Behörden-Meldung",
    authoritiesNotified: "Behörden informiert",
    reportedOn: "Gemeldet am:",
    recallScope: "Rückruf-Umfang",
    announcement: "Ankündigungstext",
    customerInstructions: "Anweisungen für Kunden",
    updated: "Rückruf aktualisiert",
    updateError: "Fehler",
    statusPlanned: "Geplant",
    statusAnnounced: "Angekündigt",
    statusActive: "Aktiv",
    statusCompleted: "Abgeschlossen",
    statusCancelled: "Abgebrochen",
  };

  const locale = lang === "en" ? "en-GB" : "de-CH";

  const [authorityNotified, setAuthorityNotified] = useState(recall.authorityNotified ?? false);

  const updateMutation = trpc.incidents.updateRecall.useMutation({
    onSuccess: () => {
      toast.success(T.updated);
      onUpdated();
    },
    onError: (err) => toast.error(`${T.updateError}: ${err.message}`),
  });

  const RECALL_STATUS_CONFIG = {
    planned: { label: T.statusPlanned, className: "bg-gray-100 text-gray-700" },
    announced: { label: T.statusAnnounced, className: "bg-blue-100 text-blue-700" },
    active: { label: T.statusActive, className: "bg-orange-100 text-orange-700" },
    completed: { label: T.statusCompleted, className: "bg-green-100 text-green-700" },
    cancelled: { label: T.statusCancelled, className: "bg-red-100 text-red-700" },
  } as const;

  const recallStatus = RECALL_STATUS_CONFIG[recall.status as keyof typeof RECALL_STATUS_CONFIG];

  const recallTypeLabel = (t: string) => {
    if (t === "voluntary") return T.typeVoluntary;
    if (t === "mandatory") return T.typeMandatory;
    return T.typeTargeted;
  };

  const remediationLabel = (r: string) => {
    if (r === "refund") return T.remedyRefund;
    if (r === "replacement") return T.remedyReplacement;
    if (r === "repair") return T.remedyRepair;
    if (r === "disposal") return T.remedyDisposal;
    return T.remedyOther;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{T.title}</h2>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{T.recallInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{T.type}</span>
              <span className="font-medium">{recallTypeLabel(recall.recallType)}</span>
            </div>
            {recall.affectedUnitsCount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{T.affectedUnits}</span>
                <span className="font-medium">{recall.affectedUnitsCount.toLocaleString(locale)}</span>
              </div>
            )}
            {recall.recallStartDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{T.startDate}</span>
                <span className="font-medium">{new Date(recall.recallStartDate).toLocaleDateString(locale)}</span>
              </div>
            )}
            {recall.remediationAction && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{T.remedy}</span>
                <span className="font-medium">{remediationLabel(recall.remediationAction)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{T.authorityNotification}</CardTitle>
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
              <Label htmlFor="authorityNotified" className="cursor-pointer">{T.authoritiesNotified}</Label>
            </div>
            {recall.authorityNotifiedAt && (
              <p className="text-xs text-muted-foreground">
                {T.reportedOn} {new Date(recall.authorityNotifiedAt).toLocaleString(locale)}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{T.recallScope}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{recall.recallScope}</p>
          </CardContent>
        </Card>
      )}

      {recall.announcementText && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{T.announcement}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{recall.announcementText}</p>
          </CardContent>
        </Card>
      )}

      {recall.remediationInstructions && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{T.customerInstructions}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{recall.remediationInstructions}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
