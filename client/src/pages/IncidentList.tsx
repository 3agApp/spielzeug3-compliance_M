/**
 * client/src/pages/IncidentList.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Overview list of all incidents and recalls.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import ComplianceLayout from "@/components/ComplianceLayout";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Plus,
  Search,
  RotateCcw,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Package,
  User,
  Calendar,
} from "lucide-react";
import CreateIncidentDialog from "@/components/CreateIncidentDialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSeverityConfig(lang: Language) {
  const isEn = lang === "en";
  return {
    critical: { label: isEn ? "Critical" : "Kritisch", className: "bg-red-100 text-red-800 border-red-200" },
    high: { label: isEn ? "High" : "Hoch", className: "bg-orange-100 text-orange-800 border-orange-200" },
    medium: { label: isEn ? "Medium" : "Mittel", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    low: { label: isEn ? "Low" : "Niedrig", className: "bg-blue-100 text-blue-800 border-blue-200" },
  };
}

function getStatusConfig(lang: Language) {
  const isEn = lang === "en";
  return {
    open: { label: isEn ? "Open" : "Offen", icon: Clock, className: "bg-gray-100 text-gray-700" },
    under_review: { label: isEn ? "Under Review" : "In Prüfung", icon: Search, className: "bg-blue-100 text-blue-700" },
    assessed: { label: isEn ? "Assessed" : "Bewertet", icon: ShieldAlert, className: "bg-purple-100 text-purple-700" },
    recall_initiated: { label: isEn ? "Recall Initiated" : "Rückruf eingeleitet", icon: RotateCcw, className: "bg-orange-100 text-orange-700" },
    recall_completed: { label: isEn ? "Recall Completed" : "Rückruf abgeschlossen", icon: CheckCircle2, className: "bg-green-100 text-green-700" },
    closed: { label: isEn ? "Closed" : "Geschlossen", icon: CheckCircle2, className: "bg-gray-100 text-gray-500" },
    archived: { label: isEn ? "Archived" : "Archiviert", icon: XCircle, className: "bg-gray-100 text-gray-400" },
  };
}

function getIncidentTypeLabels(lang: Language): Record<string, string> {
  const isEn = lang === "en";
  return {
    personal_injury: isEn ? "Personal Injury" : "Personenschaden",
    property_damage: isEn ? "Property Damage" : "Sachschaden",
    near_miss: isEn ? "Near Miss" : "Beinahe-Vorfall",
    product_defect: isEn ? "Product Defect" : "Produktmangel",
    regulatory_complaint: isEn ? "Regulatory Complaint" : "Behördenbeschwerde",
    customer_complaint: isEn ? "Customer Complaint" : "Kundenbeschwerde",
    other: isEn ? "Other" : "Sonstiges",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IncidentList() {
  const [, navigate] = useLocation();
  const { lang } = useLang();
  const isEn = lang === "en";
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const SEVERITY_CONFIG = getSeverityConfig(lang);
  const STATUS_CONFIG = getStatusConfig(lang);
  const INCIDENT_TYPE_LABELS = getIncidentTypeLabels(lang);

  const { data: stats } = trpc.incidents.getStats.useQuery();
  const { data: incidents = [], isLoading, refetch } = trpc.incidents.list.useQuery(
    {
      status: filterStatus !== "all" ? (filterStatus as any) : undefined,
      severity: filterSeverity !== "all" ? (filterSeverity as any) : undefined,
    }
  );

  const filtered = incidents.filter((inc) =>
    searchQuery === "" ||
    inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inc.product?.productName ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ComplianceLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              {isEn ? "Incidents & Recalls" : "Schadensfälle & Rückrufe"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEn
                ? "Manage incidents, assessments and product recalls"
                : "Verwaltung von Vorfällen, Bewertungen und Produktrückrufen"}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {isEn ? "New Incident" : "Neuer Schadensfall"}
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: isEn ? "Total" : "Gesamt", value: stats.total, className: "text-foreground" },
              { label: isEn ? "Open" : "Offen", value: stats.open, className: "text-gray-600" },
              { label: isEn ? "Under Review" : "In Prüfung", value: stats.underReview, className: "text-blue-600" },
              { label: isEn ? "Recall Active" : "Rückruf aktiv", value: stats.recallActive, className: "text-orange-600" },
              { label: isEn ? "Critical" : "Kritisch", value: stats.critical, className: "text-red-600" },
              { label: isEn ? "High" : "Hoch", value: stats.high, className: "text-orange-500" },
            ].map((s) => (
              <Card key={s.label} className="text-center py-3">
                <div className={`text-2xl font-bold ${s.className}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isEn ? "Search by title or product..." : "Suche nach Titel oder Produkt..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={isEn ? "Status" : "Status"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All Statuses" : "Alle Status"}</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={isEn ? "Severity" : "Schweregrad"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All Severities" : "Alle Schweregrade"}</SelectItem>
              {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="py-16">
            <CardContent className="text-center text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{isEn ? "No incidents found" : "Keine Schadensfälle gefunden"}</p>
              <p className="text-sm mt-1">
                {isEn
                  ? "Create a new incident using the button in the top right."
                  : "Erstellen Sie einen neuen Schadensfall mit dem Button oben rechts."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((incident) => {
              const severity = SEVERITY_CONFIG[incident.severity as keyof typeof SEVERITY_CONFIG];
              const status = STATUS_CONFIG[incident.status as keyof typeof STATUS_CONFIG];
              const StatusIcon = status?.icon ?? Clock;

              return (
                <Card
                  key={incident.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                  style={{
                    borderLeftColor:
                      incident.severity === "critical" ? "#ef4444" :
                      incident.severity === "high" ? "#f97316" :
                      incident.severity === "medium" ? "#eab308" : "#3b82f6",
                  }}
                  onClick={() => navigate(`/incidents/${incident.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm truncate">{incident.title}</span>
                          <Badge variant="outline" className={`text-xs shrink-0 ${severity?.className}`}>
                            {severity?.label}
                          </Badge>
                          <Badge variant="outline" className={`text-xs shrink-0 ${status?.className}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status?.label}
                          </Badge>
                          {(incident.status === "recall_initiated" || incident.status === "recall_completed") && (
                            <Badge variant="outline" className="text-xs shrink-0 bg-red-50 text-red-700 border-red-200">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              {isEn ? "Recall" : "Rückruf"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            {INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType}
                          </span>
                          {incident.product && (
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {incident.product.productName}
                              {incident.product.internalArticleNumber && (
                                <span className="text-muted-foreground/60">({incident.product.internalArticleNumber})</span>
                              )}
                            </span>
                          )}
                          {incident.reportedByName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {incident.reportedByName}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(incident.reportedAt).toLocaleDateString(isEn ? "en-GB" : "de-CH")}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateIncidentDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id: number) => {
          setShowCreate(false);
          refetch();
          navigate(`/incidents/${id}`);
        }}
      />
    </ComplianceLayout>
  );
}
