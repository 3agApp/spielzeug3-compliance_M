import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Search,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";

const ENTITY_TYPES = ["all", "product", "document", "supplier", "user", "sync"] as const;

export default function AuditLog() {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");

  const logsQuery = trpc.admin.getAuditLogs.useQuery({ limit: 100 });
  const logs = logsQuery.data ?? [];

  const filtered = logs.filter((l: any) => {
    const matchesSearch = !search ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.entityType?.toLowerCase().includes(search.toLowerCase()) ||
      l.performedByName?.toLowerCase().includes(search.toLowerCase());
    const matchesType = entityType === "all" || l.entityType === entityType;
    return matchesSearch && matchesType;
  });

  const getIcon = (entityType: string) => {
    switch (entityType) {
      case "product": return <FileText className="h-3.5 w-3.5" />;
      case "document": return <FileText className="h-3.5 w-3.5" />;
      case "supplier": return <User className="h-3.5 w-3.5" />;
      case "user": return <User className="h-3.5 w-3.5" />;
      case "sync": return <RefreshCw className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes("approved") || action.includes("completed")) return "text-emerald-700 border-emerald-300 bg-emerald-50";
    if (action.includes("rejected")) return "text-red-700 border-red-300 bg-red-50";
    if (action.includes("clarification")) return "text-amber-700 border-amber-300 bg-amber-50";
    if (action.includes("submitted")) return "text-blue-700 border-blue-300 bg-blue-50";
    return "text-slate-700 border-slate-300";
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">{t.nav.auditLog}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vollständige Aufzeichnung aller Systemaktionen
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((et) => (
                  <SelectItem key={et} value={et}>
                    {et === "all" ? "Alle Typen" : et}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Shield className="h-10 w-10 opacity-30" />
              <p className="text-sm">Keine Einträge gefunden</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Zeitpunkt</th>
                    <th>Entität</th>
                    <th>Aktion</th>
                    <th>Benutzer</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log: any) => (
                    <tr key={log.id}>
                      <td className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {getIcon(log.entityType)}
                          <span className="text-xs">{log.entityType}</span>
                          {log.entityId && (
                            <span className="text-xs text-muted-foreground">#{log.entityId}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge variant="outline" className={`text-xs ${getActionColor(log.action)}`}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="text-sm">{log.performedByName ?? log.performedByUserId ?? "System"}</td>
                      <td className="text-xs text-muted-foreground max-w-xs truncate">
                        {log.payloadSnapshot
                          ? typeof log.payloadSnapshot === "string"
                            ? log.payloadSnapshot.slice(0, 80)
                            : JSON.stringify(log.payloadSnapshot).slice(0, 80)
                          : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
