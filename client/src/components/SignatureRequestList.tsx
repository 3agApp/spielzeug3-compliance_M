/**
 * SignatureRequestList
 * Shows all signature requests for a product with status badges and actions.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ExternalLink,
  Eye,
  FileSignature,
  Loader2,
  PenLine,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface SignatureRequestListProps {
  productId: number;
  canCancel?: boolean;
}

type SignatureStatus =
  | "pending"
  | "viewed"
  | "signed"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled";

function StatusBadge({ status }: { status: SignatureStatus }) {
  const { lang, t } = useLang();
  const config: Record<SignatureStatus, { label: string; className: string; icon: React.ReactNode }> = {
    pending: {
      label: t("inline.ausstehend"),
      className: "bg-amber-100 text-amber-800 border-amber-200",
      icon: <Clock className="h-3 w-3" />,
    },
    viewed: {
      label: t("inline.geoeffnet"),
      className: "bg-blue-100 text-blue-800 border-blue-200",
      icon: <Eye className="h-3 w-3" />,
    },
    signed: {
      label: t("inline.unterzeichnet"),
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: <PenLine className="h-3 w-3" />,
    },
    completed: {
      label: t("inline.abgeschlossen"),
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    declined: {
      label: t("inline.abgelehnt"),
      className: "bg-red-100 text-red-800 border-red-200",
      icon: <XCircle className="h-3 w-3" />,
    },
    expired: {
      label: t("inline.abgelaufen"),
      className: "bg-gray-100 text-gray-600 border-gray-200",
      icon: <Clock className="h-3 w-3" />,
    },
    cancelled: {
      label: t("inline.storniert"),
      className: "bg-gray-100 text-gray-600 border-gray-200",
      icon: <X className="h-3 w-3" />,
    },
  };

  const { label, className, icon } = config[status] ?? config.pending;
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      {icon}
      {label}
    </Badge>
  );
}

export default function SignatureRequestList({ productId, canCancel = false }: SignatureRequestListProps) {
  const { lang, t } = useLang();
  const utils = trpc.useUtils();
  const listQuery = trpc.bunnydoc.listByProduct.useQuery({ productId });
  const cancelMutation = trpc.bunnydoc.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("inline.signaturanfrage_storniert"));
      utils.bunnydoc.listByProduct.invalidate({ productId });
    },
    onError: (e) => toast.error(translateError(e.message, lang)),
  });

  if (listQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const requests = listQuery.data ?? [];

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
        <FileSignature className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("inline.noch_keine_signaturanfragen_vorhanden")}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("inline.titel")}</TableHead>
          <TableHead>{t("inline.unterzeichner")}</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>{t("inline.erstellt_1")}</TableHead>
          <TableHead>{t("inline.abgeschlossen")}</TableHead>
          <TableHead className="text-right">{t("inline.aktionen")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((req) => (
          <TableRow key={req.id}>
            <TableCell className="font-medium text-sm max-w-[200px] truncate" title={req.title}>
              {req.title}
            </TableCell>
            <TableCell className="text-sm">
              <div>{req.signerName}</div>
              <div className="text-xs text-muted-foreground">{req.signerEmail}</div>
            </TableCell>
            <TableCell>
              <StatusBadge status={req.status as SignatureStatus} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(req.createdAt).toLocaleDateString(t("inline.dede"))}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {req.completedAt
                ? new Date(req.completedAt).toLocaleDateString(t("inline.dede"))
                : "–"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {req.signingLink && (
                  <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                    <a href={req.signingLink} target="_blank" rel="noopener noreferrer" title={t("inline.signaturlink_oeffnen")}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                {req.signedDocumentUrl && (
                  <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                    <a href={req.signedDocumentUrl} target="_blank" rel="noopener noreferrer" title={t("inline.unterzeichnetes_dokument")}>
                      <FileSignature className="h-3.5 w-3.5 text-emerald-600" />
                    </a>
                  </Button>
                )}
                {canCancel && !["completed", "cancelled", "declined", "expired"].includes(req.status) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title={t("inline.stornieren")}
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate({ id: req.id })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
