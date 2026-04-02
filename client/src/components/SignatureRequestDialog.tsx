/**
 * SignatureRequestDialog
 * Opens a dialog to send a document for digital signature via BunnyDoc.
 */
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { ExternalLink, FileSignature, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SignatureRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  productName: string;
  /** Pre-fill signer info from supplier contact */
  defaultSignerName?: string;
  defaultSignerEmail?: string;
  onSuccess?: () => void;
}

export default function SignatureRequestDialog({
  open,
  onOpenChange,
  productId,
  productName,
  defaultSignerName = "",
  defaultSignerEmail = "",
  onSuccess,
}: SignatureRequestDialogProps) {
  const { lang, t } = useLang();
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail);
  const [emailMessage, setEmailMessage] = useState(
    lang === "de"
      ? `Sehr geehrte Damen und Herren,\n\nbitte unterzeichnen Sie das beigefügte Compliance-Dokument für das Produkt „${productName}“.\n\nMit freundlichen Grüßen\nspielzeug3 AG – Compliance-Team`
      : `Dear Sir or Madam,\n\nPlease sign the attached compliance document for the product "${productName}".\n\nKind regards\nspielzeug3 AG – Compliance Team`
  );
  const [signingLink, setSigningLink] = useState<string | null>(null);

  const settingsQuery = trpc.bunnydoc.getSettings.useQuery(undefined, {
    enabled: open,
  });

  const sendMutation = trpc.bunnydoc.send.useMutation({
    onSuccess: (data) => {
      toast.success(t("inline.signaturanfrage_erfolgreich_versendet"));
      setSigningLink(data.signingLink ?? null);
      onSuccess?.();
    },
    onError: (e) => toast.error(translateError(e.message, lang)),
  });

  const handleSend = () => {
    if (!signerName.trim() || !signerEmail.trim()) {
      toast.error(t("inline.bitte_name_und_email_des_unterzeichners_eingeben"));
      return;
    }
    sendMutation.mutate({
      productId,
      signerName: signerName.trim(),
      signerEmail: signerEmail.trim(),
      emailMessage,
    });
  };

  const handleClose = () => {
    if (!sendMutation.isPending) {
      onOpenChange(false);
      // Reset after close animation
      setTimeout(() => {
        setSignerName(defaultSignerName);
        setSignerEmail(defaultSignerEmail);
        setSigningLink(null);
        sendMutation.reset();
      }, 300);
    }
  };

  const isConfigured = settingsQuery.data?.hasApiKey && settingsQuery.data?.templateId;
  const isSent = sendMutation.isSuccess;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            {t("inline.zur_unterschrift_senden")}
          </DialogTitle>
          <DialogDescription>
            {t("inline.sendet_eine_signaturanfrage_ueber_bunnydoc_an_den_angegebenen")}
          </DialogDescription>
        </DialogHeader>

        {settingsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !isConfigured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
            <p className="font-medium">{t("inline.bunnydoc_nicht_konfiguriert")}</p>
            <p className="text-amber-700">
              {lang === "de" ? (
                <>Bitte hinterlegen Sie API-Schlüssel und Template-ID unter{" "}<strong>Einstellungen → Signaturen</strong>.</>
              ) : (
                <>Please add your API key and template ID under{" "}<strong>Settings → Signatures</strong>.</>
              )}
            </p>
          </div>
        ) : isSent ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 space-y-1">
              <p className="font-medium">{t("inline.signaturanfrage_versendet")}</p>
              <p className="text-emerald-700">
                {lang === "de"
                  ? `${signerName} (${signerEmail}) erhält in Kürze eine E-Mail mit dem Dokument.`
                  : `${signerName} (${signerEmail}) will shortly receive an email with the document.`}
              </p>
            </div>
            {signingLink && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t("inline.direkter_signaturlink")}</p>
                <a
                  href={signingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  {signingLink}
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sig-name">{t("inline.name_des_unterzeichners")}</Label>
                <Input
                  id="sig-name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Max Mustermann"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sig-email">E-Mail</Label>
                <Input
                  id="sig-email"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="max@lieferant.de"
                />
              </div>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="sig-message">{t("inline.nachricht_optional")}</Label>
              <Textarea
                id="sig-message"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("inline.vorlage")}: <span className="font-mono">{settingsQuery.data?.templateId}</span>
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sendMutation.isPending}>
            {isSent ? (t("inline.schliessen")) : (t("inline.abbrechen"))}
          </Button>
          {!isSent && isConfigured && (
            <Button onClick={handleSend} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {t("inline.senden")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
