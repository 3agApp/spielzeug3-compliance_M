import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calculator, CircleDollarSign, FileText, FolderPlus, ReceiptText, Upload, WalletCards } from "lucide-react";

const CATEGORIES = [
  "internal_time", "logistics", "legal", "expert_opinion", "laboratory",
  "authority_fees", "customer_remediation", "travel", "communication", "other",
] as const;
const STATUSES = ["planned", "incurred", "invoiced", "paid", "submitted_to_insurer", "partially_reimbursed", "reimbursed", "disputed", "voided"] as const;

function toNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export function IncidentCostTracker({ incidentId }: { incidentId: number }) {
  const { lang } = useLang();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptEntryId, setReceiptEntryId] = useState<number | null>(null);
  const [showCostCenterDialog, setShowCostCenterDialog] = useState(false);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [centerForm, setCenterForm] = useState({ name: "", insurerName: "Baloise", insurerClaimReference: "", notes: "" });
  const [entryForm, setEntryForm] = useState({
    category: "internal_time" as typeof CATEGORIES[number], description: "", incurredAt: new Date().toISOString().slice(0, 10),
    counterparty: "", invoiceNumber: "", hours: "", hourlyRate: "", amountNet: "", vatRate: "0", status: "incurred" as typeof STATUSES[number], insurerReference: "",
  });

  const T = lang === "en" ? {
    title: "Case Cost Centre & Expenses", open: "Open cost centre", opening: "Open cost centre", create: "Create cost centre", costCenter: "Cost centre", caseCosts: "Case costs", insurer: "Insurer", claimReference: "Insurer claim reference", notes: "Notes", noCenter: "No cost centre has been opened for this case yet.", noCenterHint: "Open the cost centre before more work or third-party costs are incurred, so all time, invoices and supporting documents remain assigned to this case.",
    addCost: "Record expense", total: "Total incurred", hours: "Recorded hours", documented: "Entries with receipt", pendingDocs: "Entries without receipt", category: "Cost category", description: "Description", date: "Cost date", supplier: "Supplier / counterparty", invoice: "Invoice / reference no.", time: "Internal time", hourlyRate: "Hourly rate", net: "Net amount", vat: "VAT rate", gross: "Gross amount", status: "Status", save: "Save expense", cancel: "Cancel", receipt: "Receipt", upload: "Upload receipt", uploading: "Uploading…", noEntries: "No cost entries recorded yet.", noEntriesHint: "Record time, logistics, legal, expert opinion and other case-related costs here.", entrySaved: "Expense recorded", centerCreated: "Cost centre opened", receiptSaved: "Receipt attached", updateSaved: "Status updated", amountPreview: "Calculated amount", code: "Code", allCosts: "All costs must be recorded with the exact date, value and source document.",
  } : {
    title: "Fallkostenstelle & Aufwand", open: "Kostenstelle eröffnen", opening: "Kostenstelle eröffnen", create: "Kostenstelle erstellen", costCenter: "Kostenstelle", caseCosts: "Fallkosten", insurer: "Versicherung", claimReference: "Schadenreferenz Versicherung", notes: "Notizen", noCenter: "Für diesen Fall ist noch keine Kostenstelle eröffnet.", noCenterHint: "Eröffnen Sie die Kostenstelle, bevor weitere Arbeitszeit oder Drittaufwendungen anfallen. So bleiben Zeit, Rechnungen und Belege eindeutig diesem Fall zugeordnet.",
    addCost: "Aufwand erfassen", total: "Gesamter Aufwand", hours: "Erfasste Stunden", documented: "Positionen mit Beleg", pendingDocs: "Positionen ohne Beleg", category: "Kostenart", description: "Beschreibung", date: "Kostendatum", supplier: "Leistungserbringer / Gegenpartei", invoice: "Rechnungs- / Referenznummer", time: "Interne Arbeitszeit", hourlyRate: "Stundensatz", net: "Nettobetrag", vat: "MWST-Satz", gross: "Bruttobetrag", status: "Status", save: "Aufwand speichern", cancel: "Abbrechen", receipt: "Beleg", upload: "Beleg hochladen", uploading: "Lädt hoch…", noEntries: "Noch keine Kostenpositionen erfasst.", noEntriesHint: "Erfassen Sie hier Arbeitszeit, Logistik, Anwalt, Gutachten und weitere fallbezogene Kosten.", entrySaved: "Aufwand erfasst", centerCreated: "Kostenstelle eröffnet", receiptSaved: "Beleg hinterlegt", updateSaved: "Status aktualisiert", amountPreview: "Berechneter Betrag", code: "Code", allCosts: "Jede Position sollte mit exaktem Datum, Betrag und Belegquelle erfasst werden.",
  };
  const labels = lang === "en" ? {
    internal_time: "Internal time", logistics: "Logistics", legal: "Legal advice", expert_opinion: "Expert opinion", laboratory: "Laboratory / testing", authority_fees: "Authority fees", customer_remediation: "Customer remediation", travel: "Travel", communication: "Communication", other: "Other",
    planned: "Planned", incurred: "Incurred", invoiced: "Invoiced", paid: "Paid", submitted_to_insurer: "Submitted to insurer", partially_reimbursed: "Partially reimbursed", reimbursed: "Reimbursed", disputed: "Disputed", voided: "Voided", open: "Open", on_hold: "On hold", closed: "Closed",
  } : {
    internal_time: "Interne Arbeitszeit", logistics: "Logistik", legal: "Rechtsberatung", expert_opinion: "Gutachten", laboratory: "Labor / Prüfung", authority_fees: "Behördengebühren", customer_remediation: "Kundenmassnahmen", travel: "Reise", communication: "Kommunikation", other: "Sonstiges",
    planned: "Geplant", incurred: "Angefallen", invoiced: "In Rechnung", paid: "Bezahlt", submitted_to_insurer: "Versicherung eingereicht", partially_reimbursed: "Teilweise erstattet", reimbursed: "Erstattet", disputed: "Strittig", voided: "Storniert", open: "Offen", on_hold: "Pausiert", closed: "Geschlossen",
  } as Record<string, string>;
  const locale = lang === "en" ? "en-GB" : "de-CH";

  const { data, isLoading } = trpc.incidentCosts.getByIncident.useQuery({ incidentId }, { enabled: incidentId > 0 });
  const createCenter = trpc.incidentCosts.createCostCenter.useMutation({
    onSuccess: () => { toast.success(T.centerCreated); setShowCostCenterDialog(false); utils.incidentCosts.getByIncident.invalidate({ incidentId }); },
    onError: (error) => toast.error(error.message),
  });
  const addEntry = trpc.incidentCosts.addEntry.useMutation({
    onSuccess: () => { toast.success(T.entrySaved); setShowEntryDialog(false); setEntryForm((current) => ({ ...current, description: "", counterparty: "", invoiceNumber: "", hours: "", hourlyRate: "", amountNet: "", insurerReference: "" })); utils.incidentCosts.getByIncident.invalidate({ incidentId }); },
    onError: (error) => toast.error(error.message),
  });
  const uploadReceipt = trpc.incidentCosts.uploadReceipt.useMutation({
    onSuccess: () => { toast.success(T.receiptSaved); utils.incidentCosts.getByIncident.invalidate({ incidentId }); },
    onError: (error) => toast.error(error.message),
  });
  const updateEntryStatus = trpc.incidentCosts.updateEntryStatus.useMutation({
    onSuccess: () => { toast.success(T.updateSaved); utils.incidentCosts.getByIncident.invalidate({ incidentId }); },
    onError: (error) => toast.error(error.message),
  });

  const computed = useMemo(() => {
    const net = entryForm.category === "internal_time" ? toNumber(entryForm.hours) * toNumber(entryForm.hourlyRate) : toNumber(entryForm.amountNet);
    const vat = net * (toNumber(entryForm.vatRate) / 100);
    return { net, vat, gross: net + vat };
  }, [entryForm]);
  const formatMoney = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: data?.costCenter?.currency ?? "CHF" }).format(value);

  async function onReceiptSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const entryId = receiptEntryId;
    event.target.value = "";
    if (!file || !entryId) return;
    if (file.size > 15 * 1024 * 1024) { toast.error(lang === "en" ? "The receipt must not exceed 15 MB." : "Der Beleg darf maximal 15 MB gross sein."); return; }
    try {
      uploadReceipt.mutate({ entryId, fileName: file.name, mimeType: file.type || undefined, fileSizeBytes: file.size, fileBase64: await readFileAsBase64(file) });
    } catch { toast.error(lang === "en" ? "The file could not be prepared." : "Die Datei konnte nicht verarbeitet werden."); }
  }

  if (isLoading) return <div className="h-48 rounded-lg bg-muted animate-pulse" />;

  if (!data?.costCenter) {
    return <Card className="border-dashed border-amber-300 bg-amber-50/30">
      <CardContent className="py-10 text-center">
        <WalletCards className="mx-auto h-10 w-10 text-amber-600 mb-3" />
        <h2 className="font-semibold">{T.noCenter}</h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto mt-2">{T.noCenterHint}</p>
        <Button className="mt-5" onClick={() => setShowCostCenterDialog(true)}><FolderPlus className="h-4 w-4 mr-2" />{T.open}</Button>
      </CardContent>
      <CostCenterDialog open={showCostCenterDialog} onOpenChange={setShowCostCenterDialog} form={centerForm} setForm={setCenterForm} onSubmit={() => createCenter.mutate({ incidentId, ...centerForm })} pending={createCenter.isPending} T={T} />
    </Card>;
  }

  const { costCenter, entries, summary } = data;
  return <div className="space-y-4">
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3"><div className="p-2 rounded-lg bg-primary/10"><WalletCards className="h-5 w-5 text-primary" /></div><div><div className="flex gap-2 items-center flex-wrap"><h2 className="font-semibold">{costCenter.name}</h2><Badge variant="outline" className="font-mono">{costCenter.costCenterCode}</Badge><Badge variant="secondary">{labels[costCenter.status] ?? costCenter.status}</Badge></div><p className="text-sm text-muted-foreground mt-1">{T.insurer}: {costCenter.insurerName || "—"}{costCenter.insurerClaimReference ? ` · ${costCenter.insurerClaimReference}` : ""}</p></div></div>
        <Button onClick={() => setShowEntryDialog(true)}><CircleDollarSign className="h-4 w-4 mr-2" />{T.addCost}</Button>
      </CardContent>
    </Card>
    <p className="text-xs text-muted-foreground flex items-center gap-2"><Calculator className="h-3.5 w-3.5" />{T.allCosts}</p>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric title={T.total} value={formatMoney(summary.totalGross)} icon={<CircleDollarSign className="h-4 w-4" />} emphasis />
      <Metric title={T.hours} value={`${summary.totalHours.toLocaleString(locale)} h`} icon={<Calculator className="h-4 w-4" />} />
      <Metric title={T.documented} value={`${summary.documentedEntryCount} / ${summary.activeEntryCount}`} icon={<ReceiptText className="h-4 w-4" />} />
      <Metric title={T.pendingDocs} value={String(summary.undocumentedEntryCount)} icon={<FileText className="h-4 w-4" />} tone={summary.undocumentedEntryCount ? "amber" : "green"} />
    </div>
    {Object.entries(summary.byCategory).some(([, value]: any) => value.count > 0) && <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{lang === "en" ? "Costs by category" : "Kosten nach Kostenart"}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
        {Object.entries(summary.byCategory).filter(([, value]: any) => value.count > 0).map(([category, value]: any) => <div key={category} className="rounded-md border bg-muted/30 px-3 py-2"><p className="text-xs text-muted-foreground truncate">{labels[category] ?? category}</p><p className="font-semibold tabular-nums">{formatMoney(value.gross)}</p><p className="text-xs text-muted-foreground">{value.count} {lang === "en" ? (value.count === 1 ? "entry" : "entries") : (value.count === 1 ? "Position" : "Positionen")}</p></div>)}
      </CardContent>
    </Card>}
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{T.caseCosts}</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 ? <div className="py-10 text-center text-muted-foreground"><CircleDollarSign className="h-9 w-9 mx-auto mb-3 opacity-30" /><p>{T.noEntries}</p><p className="text-sm mt-1">{T.noEntriesHint}</p></div> : <div className="space-y-2">
          {entries.map((entry) => <div key={entry.id} className="rounded-lg border p-3 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><Badge variant="outline">{labels[entry.category] ?? entry.category}</Badge><span className="font-medium text-sm">{entry.description}</span>{entry.receiptFileUrl ? <Badge className="bg-green-100 text-green-800 border-green-200" variant="outline">{T.receipt}</Badge> : <Badge className="bg-amber-50 text-amber-800 border-amber-200" variant="outline">{T.pendingDocs}</Badge>}</div><p className="text-xs text-muted-foreground mt-1">{new Date(entry.incurredAt).toLocaleDateString(locale)}{entry.counterparty ? ` · ${entry.counterparty}` : ""}{entry.invoiceNumber ? ` · ${entry.invoiceNumber}` : ""}{entry.hours ? ` · ${entry.hours} h × ${formatMoney(Number(entry.hourlyRate ?? 0))}` : ""}</p></div>
            <div className="flex items-center gap-2 lg:justify-end"><span className="font-semibold tabular-nums">{formatMoney(Number(entry.amountGross))}</span><Select value={entry.status} onValueChange={(status) => updateEntryStatus.mutate({ id: entry.id, status: status as typeof STATUSES[number] })}><SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.filter((status) => status !== "voided").map((status) => <SelectItem key={status} value={status}>{labels[status]}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex gap-1"><Button variant="ghost" size="sm" asChild disabled={!entry.receiptFileUrl}><a href={entry.receiptFileUrl ?? undefined} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4" /></a></Button><Button variant="ghost" size="sm" onClick={() => { setReceiptEntryId(entry.id); fileInputRef.current?.click(); }} disabled={uploadReceipt.isPending}><Upload className="h-4 w-4 mr-1" />{T.upload}</Button></div>
          </div>)}
        </div>}
      </CardContent>
    </Card>
    <input ref={fileInputRef} type="file" className="hidden" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={onReceiptSelected} />
    <CostCenterDialog open={showCostCenterDialog} onOpenChange={setShowCostCenterDialog} form={centerForm} setForm={setCenterForm} onSubmit={() => createCenter.mutate({ incidentId, ...centerForm })} pending={createCenter.isPending} T={T} />
    <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{T.addCost}</DialogTitle></DialogHeader><div className="grid gap-4 py-2 md:grid-cols-2"><div className="space-y-2"><Label>{T.category}</Label><Select value={entryForm.category} onValueChange={(category) => setEntryForm({ ...entryForm, category: category as typeof CATEGORIES[number] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{labels[category]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{T.date}</Label><Input type="date" value={entryForm.incurredAt} onChange={(event) => setEntryForm({ ...entryForm, incurredAt: event.target.value })} /></div><div className="space-y-2 md:col-span-2"><Label>{T.description}</Label><Textarea value={entryForm.description} onChange={(event) => setEntryForm({ ...entryForm, description: event.target.value })} placeholder={lang === "en" ? "What work or third-party service was incurred?" : "Welcher Aufwand oder welche Drittleistung ist angefallen?"} /></div><div className="space-y-2"><Label>{T.supplier}</Label><Input value={entryForm.counterparty} onChange={(event) => setEntryForm({ ...entryForm, counterparty: event.target.value })} /></div><div className="space-y-2"><Label>{T.invoice}</Label><Input value={entryForm.invoiceNumber} onChange={(event) => setEntryForm({ ...entryForm, invoiceNumber: event.target.value })} /></div>{entryForm.category === "internal_time" ? <><div className="space-y-2"><Label>{T.time}</Label><Input type="number" min="0" step="0.25" value={entryForm.hours} onChange={(event) => setEntryForm({ ...entryForm, hours: event.target.value })} /></div><div className="space-y-2"><Label>{T.hourlyRate} (CHF)</Label><Input type="number" min="0" step="0.01" value={entryForm.hourlyRate} onChange={(event) => setEntryForm({ ...entryForm, hourlyRate: event.target.value })} /></div></> : <div className="space-y-2"><Label>{T.net} (CHF)</Label><Input type="number" min="0" step="0.01" value={entryForm.amountNet} onChange={(event) => setEntryForm({ ...entryForm, amountNet: event.target.value })} /></div>}<div className="space-y-2"><Label>{T.vat} (%)</Label><Input type="number" min="0" max="100" step="0.1" value={entryForm.vatRate} onChange={(event) => setEntryForm({ ...entryForm, vatRate: event.target.value })} /></div><div className="space-y-2"><Label>{T.status}</Label><Select value={entryForm.status} onValueChange={(status) => setEntryForm({ ...entryForm, status: status as typeof STATUSES[number] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.filter((status) => status !== "voided").map((status) => <SelectItem key={status} value={status}>{labels[status]}</SelectItem>)}</SelectContent></Select></div><div className="rounded-md bg-muted p-3 flex items-center justify-between"><span className="text-sm text-muted-foreground">{T.amountPreview}</span><span className="font-semibold">{new Intl.NumberFormat(locale, { style: "currency", currency: "CHF" }).format(computed.gross)}</span></div></div><DialogFooter><Button variant="outline" onClick={() => setShowEntryDialog(false)}>{T.cancel}</Button><Button disabled={!entryForm.description.trim() || addEntry.isPending || (entryForm.category === "internal_time" ? !(toNumber(entryForm.hours) || toNumber(entryForm.hourlyRate)) : !entryForm.amountNet)} onClick={() => addEntry.mutate({ incidentId, category: entryForm.category, description: entryForm.description, incurredAt: new Date(`${entryForm.incurredAt}T12:00:00`), counterparty: entryForm.counterparty || undefined, invoiceNumber: entryForm.invoiceNumber || undefined, ...(entryForm.category === "internal_time" ? { hours: toNumber(entryForm.hours), hourlyRate: toNumber(entryForm.hourlyRate) } : { amountNet: toNumber(entryForm.amountNet) }), vatRate: toNumber(entryForm.vatRate), status: entryForm.status })}><CircleDollarSign className="h-4 w-4 mr-2" />{T.save}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Metric({ title, value, icon, emphasis, tone }: { title: string; value: string; icon: React.ReactNode; emphasis?: boolean; tone?: "amber" | "green" }) {
  const classes = tone === "amber" ? "text-amber-700" : tone === "green" ? "text-green-700" : emphasis ? "text-primary" : "text-foreground";
  return <Card><CardContent className="p-3"><div className="flex items-center justify-between text-muted-foreground text-xs"><span>{title}</span>{icon}</div><p className={`mt-1 text-lg font-semibold tabular-nums ${classes}`}>{value}</p></CardContent></Card>;
}

function CostCenterDialog({ open, onOpenChange, form, setForm, onSubmit, pending, T }: any) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{T.opening}</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>{T.costCenter}</Label><Input value={form.name} placeholder={T.caseCosts} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="space-y-2"><Label>{T.insurer}</Label><Input value={form.insurerName} onChange={(event) => setForm({ ...form, insurerName: event.target.value })} /></div><div className="space-y-2"><Label>{T.claimReference}</Label><Input value={form.insurerClaimReference} onChange={(event) => setForm({ ...form, insurerClaimReference: event.target.value })} /></div><div className="space-y-2"><Label>{T.notes}</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{T.cancel}</Button><Button disabled={pending} onClick={onSubmit}><FolderPlus className="h-4 w-4 mr-2" />{T.create}</Button></DialogFooter></DialogContent></Dialog>;
}
