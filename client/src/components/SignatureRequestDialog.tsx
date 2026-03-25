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
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail);
  const [emailMessage, setEmailMessage] = useState(
    `Sehr geehrte Damen und Herren,\n\nbitte unterzeichnen Sie das beigefügte Compliance-Dokument für das Produkt „${productName}".\n\nMit freundlichen Grüßen\nspielzeug3 AG – Compliance-Team`
  );
  const [signingLink, setSigningLink] = useState<string | null>(null);

  const settingsQuery = trpc.bunnydoc.getSettings.useQuery(undefined, {
    enabled: open,
  });

  const sendMutation = trpc.bunnydoc.send.useMutation({
    onSuccess: (data) => {
      toast.success("Signaturanfrage erfolgreich versendet");
      setSigningLink(data.signingLink ?? null);
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSend = () => {
    if (!signerName.trim() || !signerEmail.trim()) {
      toast.error("Bitte Name und E-Mail des Unterzeichners eingeben.");
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
            Zur Unterschrift senden
          </DialogTitle>
          <DialogDescription>
            Sendet eine Signaturanfrage über BunnyDoc an den angegebenen Unterzeichner.
          </DialogDescription>
        </DialogHeader>

        {settingsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !isConfigured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
            <p className="font-medium">BunnyDoc nicht konfiguriert</p>
            <p className="text-amber-700">
              Bitte hinterlegen Sie API-Schlüssel und Template-ID unter{" "}
              <strong>Einstellungen → Signaturen</strong>.
            </p>
          </div>
        ) : isSent ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 space-y-1">
              <p className="font-medium">Signaturanfrage versendet</p>
              <p className="text-emerald-700">
                {signerName} ({signerEmail}) erhält in Kürze eine E-Mail mit dem Dokument.
              </p>
            </div>
            {signingLink && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Direkter Signatur-Link</p>
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
                <Label htmlFor="sig-name">Name des Unterzeichners</Label>
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
              <Label htmlFor="sig-message">Nachricht (optional)</Label>
              <Textarea
                id="sig-message"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Vorlage: <span className="font-mono">{settingsQuery.data?.templateId}</span>
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sendMutation.isPending}>
            {isSent ? "Schließen" : "Abbrechen"}
          </Button>
          {!isSent && isConfigured && (
            <Button onClick={handleSend} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Senden
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
