import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, CircleAlert, Search, ShieldCheck, XCircle } from "lucide-react";

type Lang = "de" | "en";

const COPY = {
  de: {
    title: "Schweizer Marktcharge prüfen",
    description: "Geben Sie die interne CH-Verifikationsnummer vom Siegel oder der Verpackung ein.",
    label: "CH-Verifikationsnummer",
    placeholder: "z.B. SPS-CH-60001-2026-001",
    action: "Charge prüfen",
    verifying: "Prüfung läuft…",
    verifiedTitle: "Für den Schweizer Markt verifiziert",
    verifiedText: "Diese Charge ist durch {importer} registriert, die Produktprüfung ist abgeschlossen und das Produkt ist für den Schweizer Markt abgedeckt.",
    pendingTitle: "Charge registriert – Prüfung noch nicht abgeschlossen",
    pendingText: "Diese Charge ist bei {importer} registriert. Die Compliance-Prüfung des Produkts ist noch nicht abgeschlossen; dies ist keine Bestätigung einer vollständigen Schweizer Marktfreigabe.",
    invalidTitle: "Chargennummer nicht verifiziert",
    invalidText: "Die eingegebene Nummer ist für dieses Produkt nicht als CH-Verifikationsnummer registriert. Bitte prüfen Sie die Eingabe oder wenden Sie sich an den Importeur.",
    unavailableTitle: "Chargenverifikation noch nicht eingerichtet",
    unavailableText: "Für dieses Produkt wurde noch keine interne CH-Verifikationsnummer hinterlegt. Bitte wenden Sie sich an den Importeur.",
    error: "Die Chargenprüfung konnte nicht durchgeführt werden. Bitte versuchen Sie es erneut.",
  },
  en: {
    title: "Verify Swiss market batch",
    description: "Enter the internal Swiss verification number shown on the seal or product packaging.",
    label: "Swiss verification number",
    placeholder: "e.g. SPS-CH-60001-2026-001",
    action: "Verify batch",
    verifying: "Verifying…",
    verifiedTitle: "Verified for the Swiss market",
    verifiedText: "This batch is registered by {importer}, the product review is complete and the product is covered for the Swiss market.",
    pendingTitle: "Batch registered – review still in progress",
    pendingText: "This batch is registered by {importer}. The product compliance review is not yet complete; this is not confirmation of full Swiss market clearance.",
    invalidTitle: "Batch number not verified",
    invalidText: "The number entered is not registered as a Swiss verification number for this product. Please check the number or contact the importer.",
    unavailableTitle: "Batch verification not yet configured",
    unavailableText: "No internal Swiss verification number has been stored for this product yet. Please contact the importer.",
    error: "The batch check could not be completed. Please try again.",
  },
} as const;

const RESULT_STYLE = {
  verified: { icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-900", iconClass: "text-emerald-600" },
  registered_pending: { icon: CircleAlert, className: "border-amber-200 bg-amber-50 text-amber-900", iconClass: "text-amber-600" },
  invalid: { icon: XCircle, className: "border-red-200 bg-red-50 text-red-900", iconClass: "text-red-600" },
  not_configured: { icon: CircleAlert, className: "border-slate-200 bg-slate-50 text-slate-900", iconClass: "text-slate-500" },
} as const;

export function SwissBatchVerificationCard({ uuid, lang }: { uuid: string; lang: Lang }) {
  const copy = COPY[lang];
  const [verificationNumber, setVerificationNumber] = useState("");
  const [submittedNumber, setSubmittedNumber] = useState<string | null>(null);

  const verification = trpc.tenant.verifySwissBatch.useQuery(
    { uuid, verificationNumber: submittedNumber ?? "" },
    { enabled: !!submittedNumber, retry: false }
  );

  const submit = () => {
    const normalized = verificationNumber.trim();
    if (normalized) setSubmittedNumber(normalized);
  };

  const result = verification.data;
  const resultStyle = result ? RESULT_STYLE[result.status] : null;
  const ResultIcon = resultStyle?.icon;
  const importer = result?.importerName ?? "spielzeug3 AG";
  const resultCopy = result?.status === "verified"
    ? { title: copy.verifiedTitle, text: copy.verifiedText }
    : result?.status === "registered_pending"
      ? { title: copy.pendingTitle, text: copy.pendingText }
      : result?.status === "not_configured"
        ? { title: copy.unavailableTitle, text: copy.unavailableText }
        : { title: copy.invalidTitle, text: copy.invalidText };

  return (
    <section className="rounded-2xl overflow-hidden border border-red-100 bg-white shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-[#C8102E] via-red-500 to-rose-400" />
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <ShieldCheck className="h-5 w-5 text-[#C8102E]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{copy.title}</h2>
            <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{copy.description}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <label htmlFor="swiss-batch-verification" className="sr-only">{copy.label}</label>
            <Input
              id="swiss-batch-verification"
              value={verificationNumber}
              onChange={(event) => {
                setVerificationNumber(event.target.value.toUpperCase());
                setSubmittedNumber(null);
              }}
              onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
              placeholder={copy.placeholder}
              className="font-mono text-sm uppercase"
              maxLength={128}
            />
          </div>
          <Button onClick={submit} disabled={!verificationNumber.trim() || verification.isFetching} className="bg-[#C8102E] hover:bg-[#A60D25] text-white">
            {verification.isFetching ? <span>{copy.verifying}</span> : <><Search className="h-4 w-4 mr-2" />{copy.action}</>}
          </Button>
        </div>

        {verification.error && (
          <p className="mt-3 text-xs text-red-600">{copy.error}</p>
        )}

        {result && resultStyle && ResultIcon && (
          <div className={`mt-4 rounded-xl border p-3.5 ${resultStyle.className}`} aria-live="polite">
            <div className="flex items-start gap-3">
              <ResultIcon className={`h-5 w-5 mt-0.5 shrink-0 ${resultStyle.iconClass}`} />
              <div>
                <p className="text-sm font-bold">{resultCopy.title}</p>
                <p className="text-xs leading-relaxed mt-1">{resultCopy.text.replace("{importer}", importer)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
