import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SyncPage() {
  const { t, lang } = useLang();
  const [syncing, setSyncing] = useState<string | null>(null);

  const logsQuery = trpc.sync.getLogs.useQuery({ limit: 20 });
  const logs = logsQuery.data ?? [];

  const importMutation = trpc.sync.importProducts.useMutation({
    onMutate: () => setSyncing("import"),
    onSuccess: (data: any) => {
      toast.success(lang === "de" ? `Import abgeschlossen: ${data.created ?? 0} erstellt, ${data.updated ?? 0} aktualisiert` : `Import completed: ${data.created ?? 0} created, ${data.updated ?? 0} updated`);
      logsQuery.refetch();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
    onSettled: () => setSyncing(null),
  });

  const exportMutation = trpc.sync.exportApproved.useMutation({
    onMutate: () => setSyncing("export"),
    onSuccess: (data: any) => {
      toast.success(lang === "de" ? `Export abgeschlossen: ${data.data?.length ?? 0} Datensätze exportiert` : `Export completed: ${data.data?.length ?? 0} records exported`);
      logsQuery.refetch();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
    onSettled: () => setSyncing(null),
  });

  const getStatusIcon = (status: string) => {
    if (status === "success") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">{t.nav.sync}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {lang === "de" ? "Bidirektionale Datensynchronisation mit Kontor ERP" : "Bidirectional data synchronization with Kontor ERP"}
        </p>
      </div>

      {/* Sync Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {lang === "de" ? "Import aus Kontor" : "Import from Kontor"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {lang === "de" ? "Importiert Lieferanten, Produkte und Bestellungen aus Kontor ERP" : "Imports suppliers, products and orders from Kontor ERP"}
            </p>
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => importMutation.mutate({ products: [] })}
                disabled={!!syncing}
              >
                {syncing === "import" ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {lang === "de" ? "Produkte importieren (Demo)" : "Import Products (Demo)"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "de" ? "In der Produktionsumgebung werden Daten direkt über die Kontor-API abgerufen." : "In the production environment, data is fetched directly via the Kontor API."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {lang === "de" ? "Export nach Kontor" : "Export to Kontor"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {lang === "de" ? "Exportiert Compliance-Status, genehmigte Daten und Vollständigkeits-Flags nach Kontor ERP" : "Exports compliance status, approved data and completeness flags to Kontor ERP"}
            </p>
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => exportMutation.mutate({})}
                disabled={!!syncing}
              >
                {syncing === "export" ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {lang === "de" ? "Genehmigte Daten exportieren" : "Export Approved Data"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "de" ? "Exportiert alle Produkte mit Status \"approved\" nach Kontor ERP." : "Exports all products with status \"approved\" to Kontor ERP."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{lang === "de" ? "Sync-Protokoll" : "Sync Log"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {lang === "de" ? "Noch keine Sync-Vorgänge" : "No sync operations yet"}
            </div>
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>{lang === "de" ? "Richtung" : "Direction"}</th>
                  <th>{lang === "de" ? "Zeitpunkt" : "Timestamp"}</th>
                  <th>{lang === "de" ? "Fehler" : "Error"}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id}>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(log.status)}
                        <span className="text-xs">{log.status}</span>
                      </div>
                    </td>
                    <td>
                      <Badge variant="outline" className="text-xs">
                        {log.direction === "import" ? "Import" : "Export"}
                      </Badge>
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="text-sm text-red-600">{log.errorMessage ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
