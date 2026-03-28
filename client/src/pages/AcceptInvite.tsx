import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  LogIn,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function AcceptInvite() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { t, lang } = useLang();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [accepted, setAccepted] = useState(false);

  const { data: validation, isLoading: validating } = trpc.invitations.validateToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const acceptMutation = trpc.invitations.accept.useMutation({
    onSuccess: () => {
      setAccepted(true);
      toast.success(t.invitations.invitationAccepted);
      setTimeout(() => navigate("/"), 2500);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <XCircle className="h-12 w-12 text-red-500" />
            <h2 className="text-xl font-bold">{t.invitations.invalidLink}</h2>
            <p className="text-muted-foreground text-sm">{t.invitations.invalidLinkDesc}</p>
            <Button onClick={() => navigate("/")} variant="outline">{t.invitations.goHome}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validating || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">{t.invitations.validating}</p>
        </div>
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <XCircle className="h-12 w-12 text-red-500" />
            <h2 className="text-xl font-bold">{t.invitations.invalidInvitation}</h2>
            <p className="text-muted-foreground text-sm">
              {(validation as any)?.reason ?? t.invitations.invalidInvitationDesc}
            </p>
            <p className="text-xs text-muted-foreground">{t.invitations.contactSupport}</p>
            <Button onClick={() => navigate("/")} variant="outline">{t.invitations.goHome}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const inv = validation;

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full border-green-200 bg-green-50">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <h2 className="text-xl font-bold text-green-800">{t.invitations.welcomeTitle}</h2>
            <p className="text-green-700 text-sm">
              {lang === "de"
                ? <>Sie wurden erfolgreich dem Lieferantenkonto <strong>{inv.supplierName}</strong> zugeordnet. Sie werden in Kürze weitergeleitet...</>
                : <>You have been successfully assigned to supplier account <strong>{inv.supplierName}</strong>. Redirecting shortly...</>}
            </p>
            <Loader2 className="h-5 w-5 animate-spin text-green-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl">{t.invitations.invitationTitle}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">spielzeug3 AG – Supplier Compliance Portal</p>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{lang === "de" ? "Lieferant:" : "Supplier:"}</span>
              <span className="font-semibold">{inv.supplierName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">{lang === "de" ? "Gültig bis:" : "Valid until:"}</span>
              <span className="font-medium">
                {new Date(inv.expiresAt).toLocaleDateString(lang === "de" ? "de-DE" : "en-GB")}
              </span>
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700">{t.invitations.loginRequired}</p>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => { window.location.href = getLoginUrl(); }}
              >
                <LogIn className="h-4 w-4" />
                {t.invitations.loginAndAccept}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  {lang === "de"
                    ? <>Sie sind angemeldet als <strong>{user?.name ?? user?.email}</strong>. Klicken Sie auf "{t.invitations.acceptInvitation}", um Ihrem Lieferantenkonto zugeordnet zu werden.</>
                    : <>You are signed in as <strong>{user?.name ?? user?.email}</strong>. Click "{t.invitations.acceptInvitation}" to be assigned to your supplier account.</>}
                </p>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => acceptMutation.mutate({ token })}
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t.invitations.acceptInvitation}
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            {lang === "de" ? "Bei Fragen wenden Sie sich an " : "For questions contact "}
            <a href="mailto:compliance@spielzeug3.de" className="underline">
              compliance@spielzeug3.de
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
