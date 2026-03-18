import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SyncPage() {
  const { t } = useLang();
  const [syncing, setSyncing] = useState<string | null>(null);

  const logsQuery = trpc.sync.getLogs.useQuery({ limit: 20 });
  const logs = logsQuery.data ?? [];

  const importMutation = trpc.sync.importProducts.useMutation({
    onMutate: () => setSyncing("import"),
    onSuccess: (data: any) => {
      toast.success(`Import abgeschlossen: ${data.created ?? 0} erstellt, ${data.updated ?? 0} aktualisiert`);
      logsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setSyncing(null),
  });

  const exportMutation = trpc.sync.exportApproved.useMutation({
    onMutate: () => setSyncing("export"),
    onSuccess: (data: any) => {
      toast.success(`Export abgeschlossen: ${data.data?.length ?? 0} Datensätze exportiert`);
      logsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
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
          Bidirektionale Datensynchronisation mit Kontor ERP
        </p>
      </div>

      {/* Sync Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Import aus Kontor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Importiert Lieferanten, Produkte und Bestellungen aus Kontor ERP
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
                Produkte importieren (Demo)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              In der Produktionsumgebung werden Daten direkt über die Kontor-API abgerufen.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Export nach Kontor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Exportiert Compliance-Status, genehmigte Daten und Vollständigkeits-Flags nach Kontor ERP
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
                Genehmigte Daten exportieren
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Exportiert alle Produkte mit Status "approved" nach Kontor ERP.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sync-Protokoll</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Noch keine Sync-Vorgänge
            </div>
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Richtung</th>
                  <th>Zeitpunkt</th>
                  <th>Fehler</th>
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
