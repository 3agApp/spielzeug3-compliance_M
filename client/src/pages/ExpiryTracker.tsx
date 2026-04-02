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
import { useLang } from "@/lib/i18n";
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function ExpiryTracker() {
  const { t, lang } = useLang();
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

  function urgencyConfig(urgency: string) {
    switch (urgency) {
      case "expired":
        return { label: t.common.expired, color: "bg-red-100 text-red-700 border-red-200", icon: XCircle, iconColor: "text-red-500" };
      case "critical":
        return { label: t.expiry.critical, color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle, iconColor: "text-orange-500" };
      case "warning":
        return { label: t.expiry.warning, color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock, iconColor: "text-yellow-500" };
      case "upcoming":
        return { label: t.expiry.upcoming, color: "bg-blue-100 text-blue-700 border-blue-200", icon: Calendar, iconColor: "text-blue-500" };
      default:
        return { label: urgency, color: "bg-gray-100 text-gray-700", icon: CheckCircle2, iconColor: "text-gray-500" };
    }
  }

  const docTypeLabel = (key: string) =>
    (t.docType as Record<string, string>)[key] ?? key;

  const daysLabel = (days: number) =>
    lang === "de" ? `${days} Tage Vorschau` : `${days} day preview`;

  const overdueLabel = (days: number) =>
    lang === "de" ? `${days} Tage überfällig` : `${days} days overdue`;

  const foundLabel = (count: number) =>
    lang === "de"
      ? `${count} Dokument${count !== 1 ? "e" : ""} gefunden`
      : `${count} document${count !== 1 ? "s" : ""} found`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.expiry.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.expiry.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t.action.refresh}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: "expired", label: t.common.expired, value: summary.expired, color: "text-red-600", bg: "bg-red-50 border-red-200", icon: XCircle },
          { key: "critical", label: t.expiry.critical, value: summary.critical, color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: AlertTriangle },
          { key: "warning", label: t.expiry.warning, value: summary.warning, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", icon: Clock },
          { key: "upcoming", label: t.expiry.upcoming, value: summary.upcoming, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: Calendar },
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
              placeholder={t.msg.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filterUrgency} onValueChange={setFilterUrgency}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t.expiry.urgency} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.expiry.allUrgency}</SelectItem>
                <SelectItem value="expired">{t.common.expired}</SelectItem>
                <SelectItem value="critical">{t.expiry.critical}</SelectItem>
                <SelectItem value="warning">{t.expiry.warning}</SelectItem>
                <SelectItem value="upcoming">{t.expiry.upcoming}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDocType} onValueChange={setFilterDocType}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder={t.expiry.docType} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.expiry.allTypes}</SelectItem>
                {Object.keys(t.docType).map((key) => (
                  <SelectItem key={key} value={key}>{docTypeLabel(key)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(daysAhead)} onValueChange={(v) => setDaysAhead(Number(v))}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[30, 60, 90, 180, 365].map((d) => (
                  <SelectItem key={d} value={String(d)}>{daysLabel(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{foundLabel(filtered.length)}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              {t.common.loading}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
              <p className="font-medium">{t.expiry.noExpiring}</p>
              <p className="text-sm">{t.expiry.noExpiringDesc}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.expiry.urgency}</TableHead>
                  <TableHead>{t.common.document}</TableHead>
                  <TableHead>{t.expiry.product}</TableHead>
                  <TableHead>{t.expiry.supplier}</TableHead>
                  <TableHead>{t.common.expiryDate}</TableHead>
                  <TableHead>{t.expiry.daysLeft}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
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
                              {docTypeLabel(item.documentType)}
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
                            ? new Date(item.expiryDate).toLocaleDateString(t("inline.dede"))
                            : "–"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {item.daysUntilExpiry < 0 ? (
                          <span className="text-sm font-semibold text-red-600">
                            {overdueLabel(Math.abs(item.daysUntilExpiry))}
                          </span>
                        ) : (
                          <span className={`text-sm font-semibold ${
                            item.daysUntilExpiry <= 30 ? "text-orange-600" :
                            item.daysUntilExpiry <= 60 ? "text-yellow-600" : "text-blue-600"
                          }`}>
                            {item.daysUntilExpiry} {t.common.days}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/products/${item.productId}`}>
                          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
                            <ExternalLink className="h-3 w-3" />
                            {t("inline.produkt_oeffnen")}
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
