import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  Plus,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "wouter";

interface Props {
  productId: number;
  lang: string;
  onCreateNew: () => void;
}

const SEVERITY_CONFIG: Record<string, { label: string; labelEn: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  low: { label: "Niedrig", labelEn: "Low", variant: "secondary", icon: <Shield className="h-3 w-3" /> },
  medium: { label: "Mittel", labelEn: "Medium", variant: "default", icon: <ShieldAlert className="h-3 w-3" /> },
  high: { label: "Hoch", labelEn: "High", variant: "destructive", icon: <ShieldAlert className="h-3 w-3" /> },
  critical: { label: "Kritisch", labelEn: "Critical", variant: "destructive", icon: <ShieldCheck className="h-3 w-3" /> },
};

const STATUS_CONFIG: Record<string, { label: string; labelEn: string; color: string }> = {
  open: { label: "Offen", labelEn: "Open", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  under_investigation: { label: "In Prüfung", labelEn: "Under Investigation", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  recall_initiated: { label: "Rückruf eingeleitet", labelEn: "Recall Initiated", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  recall_completed: { label: "Rückruf abgeschlossen", labelEn: "Recall Completed", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  closed: { label: "Geschlossen", labelEn: "Closed", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  no_action_required: { label: "Keine Massnahme", labelEn: "No Action Required", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

const TYPE_LABELS: Record<string, { de: string; en: string }> = {
  personal_injury: { de: "Personenschaden", en: "Personal Injury" },
  property_damage: { de: "Sachschaden", en: "Property Damage" },
  product_defect: { de: "Produktmangel", en: "Product Defect" },
  near_miss: { de: "Beinahe-Unfall", en: "Near Miss" },
  customer_complaint: { de: "Kundenbeschwerde", en: "Customer Complaint" },
  regulatory_notice: { de: "Behördliche Meldung", en: "Regulatory Notice" },
  other: { de: "Sonstiges", en: "Other" },
};

export default function ProductIncidentsTab({ productId, lang, onCreateNew }: Props) {
  const [, setLocation] = useLocation();
  const de = lang === "de";

  const { data: incidents, isLoading } = trpc.incidents.getByProduct.useQuery({ productId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {de ? "Lade Schadensfälle…" : "Loading incidents…"}
      </div>
    );
  }

  const list = incidents ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">
            {de ? "Verknüpfte Schadensfälle" : "Linked Incidents"}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {list.length === 0
              ? (de ? "Keine Vorfälle erfasst" : "No incidents recorded")
              : de
              ? `${list.length} Vorfall${list.length !== 1 ? "sfälle" : ""} erfasst`
              : `${list.length} incident${list.length !== 1 ? "s" : ""} recorded`}
          </p>
        </div>
        <Button size="sm" onClick={onCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          {de ? "Neuer Schadensfall" : "New Incident"}
        </Button>
      </div>

      {/* Empty state */}
      {list.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {de ? "Noch keine Schadensfälle für dieses Produkt" : "No incidents for this product yet"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
              {de
                ? "Erfassen Sie Personenschäden, Produktmängel oder Rückrufe direkt hier."
                : "Record personal injuries, product defects or recalls directly here."}
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={onCreateNew}>
              <Plus className="h-4 w-4" />
              {de ? "Ersten Schadensfall erfassen" : "Record first incident"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Incident list */}
      {list.length > 0 && (
        <div className="space-y-2">
          {list.map((incident: any) => {
            const severityConf = SEVERITY_CONFIG[incident.severity] ?? SEVERITY_CONFIG.medium;
            const statusConf = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.open;
            const typeLabel = TYPE_LABELS[incident.incidentType];
            const hasRecall = ["recall_initiated", "recall_completed"].includes(incident.status);

            return (
              <Card
                key={incident.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setLocation(`/incidents/${incident.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm truncate">{incident.title}</span>
                        {hasRecall && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-0.5 rounded-full">
                            <RotateCcw className="h-3 w-3" />
                            {de ? "Rückruf" : "Recall"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Type */}
                        <span className="text-xs text-muted-foreground">
                          {typeLabel ? (de ? typeLabel.de : typeLabel.en) : incident.incidentType}
                        </span>
                        <span className="text-muted-foreground/40 text-xs">·</span>
                        {/* Date */}
                        <span className="text-xs text-muted-foreground">
                          {new Date(incident.reportedAt).toLocaleDateString(de ? "de-CH" : "en-GB")}
                        </span>
                        {incident.affectedBatchNumbers?.length > 0 && (
                          <>
                            <span className="text-muted-foreground/40 text-xs">·</span>
                            <span className="text-xs text-muted-foreground">
                              {de ? "Charge" : "Batch"}: {incident.affectedBatchNumbers.slice(0, 2).join(", ")}
                              {incident.affectedBatchNumbers.length > 2 ? ` +${incident.affectedBatchNumbers.length - 2}` : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Severity badge */}
                      <Badge variant={severityConf.variant} className="gap-1 text-xs">
                        {severityConf.icon}
                        {de ? severityConf.label : severityConf.labelEn}
                      </Badge>
                      {/* Status badge */}
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${statusConf.color}`}>
                        {de ? statusConf.label : statusConf.labelEn}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  </div>

                  {/* Description preview */}
                  {incident.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {incident.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
