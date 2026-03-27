import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  ShieldX,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Status helpers ────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1"><Clock className="h-3 w-3" />Ausstehend</Badge>;
    case "accepted":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" />Angenommen</Badge>;
    case "expired":
      return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 gap-1"><XCircle className="h-3 w-3" />Abgelaufen</Badge>;
    case "revoked":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><ShieldX className="h-3 w-3" />Widerrufen</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function InvitationsManager() {
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newSupplierId, setNewSupplierId] = useState<string>("");
  const [newValidDays, setNewValidDays] = useState("7");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const utils = trpc.useUtils();

  const { data: invitations, isLoading, refetch } = trpc.invitations.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const { data: suppliersRaw } = trpc.suppliers.list.useQuery();

  const createMutation = trpc.invitations.create.useMutation({
    onSuccess: (data) => {
      setCreatedLink(data.inviteUrl);
      setShowCreate(false);
      setShowLinkDialog(true);
      setNewEmail("");
      setNewSupplierId("");
      utils.invitations.list.invalidate();
      toast.success("Einladung erfolgreich erstellt");
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMutation = trpc.invitations.revoke.useMutation({
    onSuccess: () => {
      utils.invitations.list.invalidate();
      toast.success("Einladung widerrufen");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCreate() {
    if (!newEmail || !newSupplierId) {
      toast.error("Bitte E-Mail und Lieferant auswählen");
      return;
    }
    createMutation.mutate({
      email: newEmail,
      supplierId: Number(newSupplierId),
      validDays: Number(newValidDays),
      origin: window.location.origin,
    });
  }

  function copyLink() {
    if (createdLink) {
      navigator.clipboard.writeText(createdLink);
      toast.success("Link in Zwischenablage kopiert");
    }
  }

  const suppliers = (suppliersRaw as any[]) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lieferanten-Einladungen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Laden Sie Lieferanten per Magic-Link ein, sich selbst im Portal zu registrieren
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Aktualisieren
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Einladung erstellen
          </Button>
        </div>
      </div>

      {/* How it works */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <Link2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">So funktioniert der Onboarding-Prozess</p>
              <p className="text-sm text-blue-700 mt-1">
                Erstellen Sie eine Einladung für eine Lieferanten-E-Mail-Adresse. Das System generiert einen eindeutigen Magic-Link,
                den Sie per E-Mail versenden. Der Lieferant klickt auf den Link, meldet sich mit seinem Manus-Konto an und wird
                automatisch dem entsprechenden Lieferantenkonto zugeordnet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {invitations?.length ?? 0} Einladung{(invitations?.length ?? 0) !== 1 ? "en" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Lade Einladungen...
            </div>
          ) : !invitations?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Mail className="h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">Noch keine Einladungen</p>
              <p className="text-sm">Erstellen Sie die erste Einladung für einen Lieferanten.</p>
              <Button size="sm" onClick={() => setShowCreate(true)} className="mt-2 gap-2">
                <Plus className="h-4 w-4" />
                Erste Einladung erstellen
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead>Läuft ab</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{inv.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{inv.supplierName}</p>
                        <p className="text-xs text-muted-foreground">{inv.supplierCode}</p>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString("de-DE")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${new Date(inv.expiresAt) < new Date() ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                        {new Date(inv.expiresAt).toLocaleDateString("de-DE")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs gap-1"
                          onClick={() => revokeMutation.mutate({ invitationId: inv.id })}
                          disabled={revokeMutation.isPending}
                        >
                          <ShieldX className="h-3 w-3" />
                          Widerrufen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Neue Einladung erstellen
            </DialogTitle>
            <DialogDescription>
              Der Lieferant erhält einen Magic-Link, über den er sich selbst registrieren kann.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>E-Mail-Adresse des Lieferanten</Label>
              <Input
                type="email"
                placeholder="lieferant@beispiel.de"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lieferant</Label>
              <Select value={newSupplierId} onValueChange={setNewSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Lieferant auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.supplierCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gültigkeitsdauer</Label>
              <Select value={newValidDays} onValueChange={setNewValidDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Tage</SelectItem>
                  <SelectItem value="7">7 Tage</SelectItem>
                  <SelectItem value="14">14 Tage</SelectItem>
                  <SelectItem value="30">30 Tage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Magic-Link generieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Magic Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Einladung erfolgreich erstellt
            </DialogTitle>
            <DialogDescription>
              Kopieren Sie den Magic-Link und senden Sie ihn per E-Mail an den Lieferanten.
              Der Link ist für {newValidDays} Tage gültig.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="bg-muted rounded-lg p-3 break-all text-sm font-mono text-muted-foreground border">
              {createdLink}
            </div>
            <Button onClick={copyLink} className="w-full gap-2">
              <Copy className="h-4 w-4" />
              Link in Zwischenablage kopieren
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
