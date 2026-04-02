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
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
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

export default function InvitationsManager() {
  const { t, lang } = useLang();
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
      toast.success(t.invitations.invitationSent);
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  const revokeMutation = trpc.invitations.revoke.useMutation({
    onSuccess: () => {
      utils.invitations.list.invalidate();
      toast.success(t.msg.deactivateSuccess);
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  function handleCreate() {
    if (!newEmail || !newSupplierId) {
      toast.error(t("inline.bitte_email_und_lieferant_auswaehlen"));
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
      toast.success(t.msg.linkCopied);
    }
  }

  function statusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1"><Clock className="h-3 w-3" />{t.invitations.status.pending}</Badge>;
      case "accepted":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" />{t.invitations.status.accepted}</Badge>;
      case "expired":
        return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 gap-1"><XCircle className="h-3 w-3" />{t.invitations.status.expired}</Badge>;
      case "revoked":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><ShieldX className="h-3 w-3" />{t.invitations.status.revoked}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  const suppliers = (suppliersRaw as any[]) ?? [];

  const invCountLabel = (count: number) =>
    lang === "de"
      ? `${count} Einladung${count !== 1 ? "en" : ""}`
      : `${count} invitation${count !== 1 ? "s" : ""}`;

  const daysLabel = (d: string) =>
    lang === "de" ? `${d} Tage` : `${d} days`;

  const validForLabel = (d: string) =>
    lang === "de" ? `Der Link ist für ${d} Tage gültig.` : `The link is valid for ${d} days.`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.invitations.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.invitations.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t.action.refresh}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {t.invitations.newInvitation}
          </Button>
        </div>
      </div>

      {/* How it works */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <Link2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">
                {t("inline.so_funktioniert_der_onboardingprozess")}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {lang === "de"
                  ? "Erstellen Sie eine Einladung für eine Lieferanten-E-Mail-Adresse. Das System generiert einen eindeutigen Magic-Link, den Sie per E-Mail versenden. Der Lieferant klickt auf den Link, meldet sich mit seinem Manus-Konto an und wird automatisch dem entsprechenden Lieferantenkonto zugeordnet."
                  : "Create an invitation for a supplier email address. The system generates a unique magic link that you send by email. The supplier clicks the link, signs in with their Manus account, and is automatically assigned to the corresponding supplier account."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{invCountLabel(invitations?.length ?? 0)}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              {t.common.loading}
            </div>
          ) : !invitations?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Mail className="h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">{t.invitations.noInvitations}</p>
              <p className="text-sm">
                {t("inline.erstellen_sie_die_erste_einladung_fuer_einen_lieferanten")}
              </p>
              <Button size="sm" onClick={() => setShowCreate(true)} className="mt-2 gap-2">
                <Plus className="h-4 w-4" />
                {t.invitations.newInvitation}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.email}</TableHead>
                  <TableHead>{t.nav.suppliers}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.invitations.sentAt}</TableHead>
                  <TableHead>{t.invitations.expiresAt}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
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
                        {new Date(inv.createdAt).toLocaleDateString(t("inline.dede"))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${new Date(inv.expiresAt) < new Date() ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                        {new Date(inv.expiresAt).toLocaleDateString(t("inline.dede"))}
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
                          {t.invitations.revokeInvitation}
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
              {t.invitations.newInvitation}
            </DialogTitle>
            <DialogDescription>
              {lang === "de"
                ? "Der Lieferant erhält einen Magic-Link, über den er sich selbst registrieren kann."
                : "The supplier receives a magic link to register themselves."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t.invitations.supplierEmail}</Label>
              <Input
                type="email"
                placeholder={t("inline.lieferantbeispielde")}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.invitations.supplierName}</Label>
              <Select value={newSupplierId} onValueChange={setNewSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("inline.lieferant_auswaehlen")} />
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
              <Label>{t("inline.gueltigkeitsdauer")}</Label>
              <Select value={newValidDays} onValueChange={setNewValidDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["3", "7", "14", "30"].map((d) => (
                    <SelectItem key={d} value={d}>{daysLabel(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t.action.cancel}</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {t("inline.magiclink_generieren")}
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
              {t.invitations.invitationSent}
            </DialogTitle>
            <DialogDescription>
              {lang === "de"
                ? `Kopieren Sie den Magic-Link und senden Sie ihn per E-Mail an den Lieferanten. ${validForLabel(newValidDays)}`
                : `Copy the magic link and send it by email to the supplier. ${validForLabel(newValidDays)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="bg-muted rounded-lg p-3 break-all text-sm font-mono text-muted-foreground border">
              {createdLink}
            </div>
            <Button onClick={copyLink} className="w-full gap-2">
              <Copy className="h-4 w-4" />
              {t.invitations.copyLink}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>{t.action.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
