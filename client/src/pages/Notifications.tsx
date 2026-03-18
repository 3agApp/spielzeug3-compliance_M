import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Notifications() {
  const { t } = useLang();
  const [, setLocation] = useLocation();

  const notificationsQuery = trpc.notifications.list.useQuery();
  const notifications = notificationsQuery.data ?? [];

  const utils = trpc.useUtils();
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
    onError: (e: any) => toast.error(e.message),
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
    onError: (e: any) => toast.error(e.message),
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const getTypeColor = (type: string) => {
    if (type === "approved") return "text-emerald-700 border-emerald-300 bg-emerald-50";
    if (type === "rejected") return "text-red-700 border-red-300 bg-red-50";
    if (type === "clarification_requested") return "text-amber-700 border-amber-300 bg-amber-50";
    if (type === "submitted") return "text-blue-700 border-blue-300 bg-blue-50";
    return "text-slate-700 border-slate-300";
  };

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.nav.notifications}</h1>
          {unreadCount > 0 && (
            <p className="text-muted-foreground text-sm mt-1">{unreadCount} ungelesen</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Alle als gelesen markieren
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Bell className="h-10 w-10 opacity-30" />
              <p className="text-sm">Keine Benachrichtigungen</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`p-4 flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors ${
                    !n.isRead ? "bg-blue-50/40" : ""
                  }`}
                  onClick={() => {
                    if (!n.isRead) markReadMutation.mutate({ id: n.id });
                    if (n.relatedProductId) setLocation(`/products/${n.relatedProductId}`);
                  }}
                >
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${!n.isRead ? "bg-blue-500" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs ${getTypeColor(n.type)}`}>
                          {n.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
