import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DOC_TYPE_LABELS: Record<string, string> = {
  test_report: "Testbericht",
  declaration_of_conformity: "Konformitätserklärung",
  manual: "Handbuch",
  certificate: "Zertifikat",
  product_image: "Produktbild",
  safety_image: "Sicherheitsbild",
  regulatory_document: "Regulatorisches Dokument",
  other: "Sonstiges",
};

function urgencyConfig(urgency: string) {
  switch (urgency) {
    case "expired":
      return { label: "Abgelaufen", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle, iconColor: "text-red-500" };
    case "critical":
      return { label: "Kritisch (≤30 Tage)", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle, iconColor: "text-orange-500" };
    case "warning":
      return { label: "Warnung (31–60 Tage)", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock, iconColor: "text-yellow-500" };
    case "upcoming":
      return { label: "Demnächst (61–90 Tage)", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Calendar, iconColor: "text-blue-500" };
    default:
      return { label: urgency, color: "bg-gray-100 text-gray-700", icon: CheckCircle2, iconColor: "text-gray-500" };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ExpiryTracker() {
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [filterDocType, setFilterDocType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [daysAhead, setDaysAhead] = useState(90);

  const { data, isLoading, refetch } = trpc.expiry.getExpiringDocuments.useQuery(
    { daysAhead },
    { refetchOnWindowFocus: false }
  );

  const filtered = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      if (filterUrgency !== "all" && item.urgency !== filterUrgency) return false;
      if (filterDocType !== "all" && item.documentType !== filterDocType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.productName.toLowerCase().includes(q) ||
          item.supplierName.toLowerCase().includes(q) ||
          (item.internalArticleNumber ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, filterUrgency, filterDocType, search]);

  const summary = data?.summary ?? { expired: 0, critical: 0, warning: 0, upcoming: 0, total: 0 };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ablaufdaten-Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Übersicht aller Dokumente mit ablaufenden Zertifikaten und Gültigkeitsdaten
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: "expired", label: "Abgelaufen", value: summary.expired, color: "text-red-600", bg: "bg-red-50 border-red-200", icon: XCircle },
          { key: "critical", label: "Kritisch (≤30 Tage)", value: summary.critical, color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: AlertTriangle },
          { key: "warning", label: "Warnung (31–60 Tage)", value: summary.warning, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", icon: Clock },
          { key: "upcoming", label: "Demnächst (61–90 Tage)", value: summary.upcoming, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: Calendar },
        ].map(({ key, label, value, color, bg, icon: Icon }) => (
          <Card
            key={key}
            className={`border cursor-pointer transition-all hover:shadow-md ${bg} ${filterUrgency === key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilterUrgency(filterUrgency === key ? "all" : key)}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
                </div>
                <Icon className={`h-8 w-8 ${color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Produkt, Lieferant oder Artikelnummer suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filterUrgency} onValueChange={setFilterUrgency}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Dringlichkeit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Dringlichkeiten</SelectItem>
                <SelectItem value="expired">Abgelaufen</SelectItem>
                <SelectItem value="critical">Kritisch (≤30 Tage)</SelectItem>
                <SelectItem value="warning">Warnung (31–60 Tage)</SelectItem>
                <SelectItem value="upcoming">Demnächst (61–90 Tage)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDocType} onValueChange={setFilterDocType}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Dokumenttyp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(daysAhead)} onValueChange={(v) => setDaysAhead(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 Tage Vorschau</SelectItem>
                <SelectItem value="60">60 Tage Vorschau</SelectItem>
                <SelectItem value="90">90 Tage Vorschau</SelectItem>
                <SelectItem value="180">180 Tage Vorschau</SelectItem>
                <SelectItem value="365">365 Tage Vorschau</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filtered.length} Dokument{filtered.length !== 1 ? "e" : ""} gefunden
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Lade Ablaufdaten...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
              <p className="font-medium">Keine ablaufenden Dokumente gefunden</p>
              <p className="text-sm">Im gewählten Zeitraum gibt es keine Warnungen.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dringlichkeit</TableHead>
                  <TableHead>Dokument</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead>Ablaufdatum</TableHead>
                  <TableHead>Verbleibend</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const cfg = urgencyConfig(item.urgency);
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={item.docId} className="hover:bg-muted/30">
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 text-xs ${cfg.color}`}>
                          <Icon className={`h-3 w-3 ${cfg.iconColor}`} />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium truncate max-w-[180px]">{item.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {DOC_TYPE_LABELS[item.documentType] ?? item.documentType}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium truncate max-w-[180px]">{item.productName}</p>
                          {item.internalArticleNumber && (
                            <p className="text-xs text-muted-foreground">{item.internalArticleNumber}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{item.supplierName}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-mono">
                          {item.expiryDate
                            ? new Date(item.expiryDate).toLocaleDateString("de-DE")
                            : "–"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {item.daysUntilExpiry < 0 ? (
                          <span className="text-sm font-semibold text-red-600">
                            {Math.abs(item.daysUntilExpiry)} Tage überfällig
                          </span>
                        ) : (
                          <span className={`text-sm font-semibold ${
                            item.daysUntilExpiry <= 30 ? "text-orange-600" :
                            item.daysUntilExpiry <= 60 ? "text-yellow-600" : "text-blue-600"
                          }`}>
                            {item.daysUntilExpiry} Tage
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/products/${item.productId}`}>
                          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
                            <ExternalLink className="h-3 w-3" />
                            Produkt öffnen
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
