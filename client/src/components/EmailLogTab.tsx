/**
 * client/src/components/EmailLogTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays the email send history for a product.
 * Shows timestamp, recipient, subject, status badge, and expandable body preview.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Mail,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailLogEntry {
  id: number;
  to: string;
  subject: string;
  htmlBody: string | null;
  sentAt: Date | string;
  sentBy: string | null;
  status: "sent" | "failed";
  errorMessage: string | null;
}

// ─── Single log row ───────────────────────────────────────────────────────────

function EmailLogRow({ entry }: { entry: EmailLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { lang } = useLang();

  const sentDate = new Date(entry.sentAt);

  return (
    <>
      <div className="rounded-lg border bg-card p-4 space-y-3 hover:bg-muted/20 transition-colors">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            {/* Status icon */}
            <div className={`mt-0.5 shrink-0 ${entry.status === "sent" ? "text-emerald-600" : "text-red-600"}`}>
              {entry.status === "sent"
                ? <CheckCircle2 className="h-4 w-4" />
                : <XCircle className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              {/* Subject */}
              <p className="font-medium text-sm truncate">{entry.subject}</p>
              {/* Recipient */}
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Mail className="h-3 w-3 shrink-0" />
                {entry.to}
              </p>
            </div>
          </div>
          {/* Right side: status badge + timestamp */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={entry.status === "sent"
                ? "text-emerald-700 bg-emerald-50 border-emerald-200 text-xs"
                : "text-red-700 bg-red-50 border-red-200 text-xs"}
            >
              {entry.status === "sent"
                ? (lang === "de" ? "Gesendet" : "Sent")
                : (lang === "de" ? "Fehlgeschlagen" : "Failed")}
            </Badge>
          </div>
        </div>

        {/* Meta row: timestamp + sender */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {sentDate.toLocaleString(lang === "de" ? "de-CH" : "en-GB")}
          </span>
          {entry.sentBy && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {entry.sentBy}
            </span>
          )}
        </div>

        {/* Error message */}
        {entry.status === "failed" && entry.errorMessage && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {entry.errorMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {entry.htmlBody && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-3.5 w-3.5" />
              {lang === "de" ? "E-Mail anzeigen" : "View Email"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded
              ? (lang === "de" ? "Weniger" : "Less")
              : (lang === "de" ? "Details" : "Details")}
          </Button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t pt-3 space-y-2 text-xs text-muted-foreground">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="font-medium text-foreground">{lang === "de" ? "An:" : "To:"}</span>
              <span>{entry.to}</span>
              <span className="font-medium text-foreground">{lang === "de" ? "Betreff:" : "Subject:"}</span>
              <span>{entry.subject}</span>
              <span className="font-medium text-foreground">{lang === "de" ? "Gesendet:" : "Sent at:"}</span>
              <span>{sentDate.toLocaleString(lang === "de" ? "de-CH" : "en-GB")}</span>
              {entry.sentBy && (
                <>
                  <span className="font-medium text-foreground">{lang === "de" ? "Von:" : "By:"}</span>
                  <span>{entry.sentBy}</span>
                </>
              )}
              <span className="font-medium text-foreground">Status:</span>
              <span className={entry.status === "sent" ? "text-emerald-600" : "text-red-600"}>
                {entry.status === "sent"
                  ? (lang === "de" ? "Erfolgreich gesendet" : "Successfully sent")
                  : (lang === "de" ? "Versand fehlgeschlagen" : "Send failed")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Email body preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {entry.subject}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{lang === "de" ? "An:" : "To:"}</span>
              <span>{entry.to}</span>
              <span className="mx-2">·</span>
              <Clock className="h-3 w-3" />
              <span>{sentDate.toLocaleString(lang === "de" ? "de-CH" : "en-GB")}</span>
            </div>
            <div
              className="rounded-md border bg-white p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: entry.htmlBody ?? "" }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface EmailLogTabProps {
  productId: number;
}

export function EmailLogTab({ productId }: EmailLogTabProps) {
  const { lang } = useLang();
  const logsQuery = trpc.emailLogs.getByProduct.useQuery({ productId });

  if (logsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">{lang === "de" ? "Lade E-Mail-Protokoll…" : "Loading email log…"}</span>
      </div>
    );
  }

  const logs = (logsQuery.data ?? []) as EmailLogEntry[];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              {lang === "de" ? "E-Mail-Versandprotokoll" : "Email Send Log"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {logs.length} {lang === "de" ? (logs.length === 1 ? "E-Mail" : "E-Mails") : (logs.length === 1 ? "email" : "emails")}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => logsQuery.refetch()}
                title={lang === "de" ? "Aktualisieren" : "Refresh"}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${logsQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === "de"
              ? "Alle aus diesem Produkt gesendeten E-Mails an Hersteller und Lieferanten."
              : "All emails sent from this product to manufacturers and suppliers."}
          </p>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Mail className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {lang === "de" ? "Keine E-Mails gesendet" : "No emails sent yet"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "de"
                    ? "E-Mails, die über die KI-Analyse an Hersteller gesendet werden, erscheinen hier."
                    : "Emails sent to manufacturers via the AI Analysis will appear here."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((entry) => (
                <EmailLogRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
