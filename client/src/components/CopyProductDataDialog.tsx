/**
 * CopyProductDataDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dialog zum Übertragen von Compliance-Daten von einem Quellprodukt auf
 * beliebig viele Zielprodukte.
 *
 * Ablauf:
 *   1. Vorschau laden (welche Datenkategorien sind vorhanden?)
 *   2. Kategorien auswählen (Checkboxen)
 *   3. Zielprodukte suchen und auswählen (Multi-Select mit Suche)
 *   4. Überschreiben-Option wählen
 *   5. Ausführen → Fortschrittsanzeige → Ergebnis-Panel
 */
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  Copy,
  Search,
  CheckCircle2,
  XCircle,
  SkipForward,
  Loader2,
  ChevronRight,
  Package,
  FileText,
  Shield,
  Layers,
  ClipboardList,
  AlertCircle,
  Box,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CopyCategory = "safety" | "documents" | "components" | "batchInfo" | "labelling" | "requirements";

interface CategoryMeta {
  key: CopyCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const CATEGORY_META: CategoryMeta[] = [
  { key: "safety",       label: "Sicherheitsdaten",           icon: <Shield className="h-4 w-4" />,       description: "Sicherheitstext, Warnhinweise, Altersangabe, Materialinfos" },
  { key: "documents",    label: "Dokumente",                  icon: <FileText className="h-4 w-4" />,      description: "Prüfberichte, Zertifikate, Konformitätserklärungen" },
  { key: "components",   label: "Komponenten",                icon: <Layers className="h-4 w-4" />,        description: "Produktkomponenten inkl. Komponentendokumenten" },
  { key: "batchInfo",    label: "Chargeninformationen",       icon: <Box className="h-4 w-4" />,           description: "Chargennummer, Produktionsdatum, Importeur" },
  { key: "labelling",    label: "Kennzeichnungs-Checkliste",  icon: <ClipboardList className="h-4 w-4" />, description: "EU/CH Kennzeichnungsprüfpunkte" },
  { key: "requirements", label: "Fehlende Anforderungen",     icon: <AlertCircle className="h-4 w-4" />,   description: "Anforderungseinträge und deren Status" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  sourceProductId: number;
  sourceProductName: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CopyProductDataDialog({ open, onClose, sourceProductId, sourceProductName }: Props) {
  const [step, setStep] = useState<"configure" | "running" | "done">("configure");
  const [selectedCategories, setSelectedCategories] = useState<Set<CopyCategory>>(new Set());
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<number>>(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);

  // Load preview (available categories on source product)
  const { data: preview, isLoading: previewLoading } = trpc.productCopy.preview.useQuery(
    { sourceProductId },
    { enabled: open }
  );

  // Load all products for target selection
  const { data: allProducts } = trpc.products.list.useQuery(
    {},
    { enabled: open }
  );

  const executeMutation = trpc.productCopy.execute.useMutation();
  const utils = trpc.useUtils();

  // Filter products for target selection (exclude source, apply search)
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    const q = searchQuery.toLowerCase();
    return allProducts.filter((p: any) => {
      if (p.id === sourceProductId) return false;
      if (!q) return true;
      return (
        p.productName?.toLowerCase().includes(q) ||
        p.internalArticleNumber?.toLowerCase().includes(q) ||
        p.ean?.toLowerCase().includes(q)
      );
    });
  }, [allProducts, sourceProductId, searchQuery]);

  // Toggle category selection
  function toggleCategory(key: CopyCategory) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Toggle target product selection
  function toggleTarget(id: number) {
    setSelectedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Select all visible filtered products
  function selectAllFiltered() {
    setSelectedTargetIds((prev) => {
      const next = new Set(prev);
      filteredProducts.forEach((p: any) => next.add(p.id));
      return next;
    });
  }

  // Deselect all
  function clearTargets() {
    setSelectedTargetIds(new Set());
  }

  // Execute copy
  async function handleExecute() {
    if (selectedCategories.size === 0 || selectedTargetIds.size === 0) return;
    setStep("running");
    try {
      const res = await executeMutation.mutateAsync({
        sourceProductId,
        targetProductIds: Array.from(selectedTargetIds),
        categories: Array.from(selectedCategories),
        overwrite,
      });
      setResults(res);
      // Invalidate affected product queries
      await utils.products.list.invalidate();
      setStep("done");
    } catch (err: any) {
      setResults([{ errors: [err?.message ?? "Unbekannter Fehler"] }]);
      setStep("done");
    }
  }

  function handleClose() {
    setStep("configure");
    setSelectedCategories(new Set());
    setSelectedTargetIds(new Set());
    setOverwrite(false);
    setSearchQuery("");
    setResults([]);
    onClose();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const canExecute = selectedCategories.size > 0 && selectedTargetIds.size > 0;

  function getCategoryCount(key: CopyCategory): number {
    if (!preview) return 0;
    return preview.availableCategories.find((c: any) => c.key === key)?.count ?? 0;
  }

  function totalCopied(result: any): number {
    return Object.values(result.copied ?? {}).reduce((a: number, b: any) => a + (b ?? 0), 0);
  }

  function totalSkipped(result: any): number {
    return Object.values(result.skipped ?? {}).reduce((a: number, b: any) => a + (b ?? 0), 0);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Compliance-Daten übertragen
          </DialogTitle>
          <DialogDescription>
            Daten von <span className="font-medium text-foreground">{sourceProductName}</span> auf andere Produkte kopieren.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: configure ─────────────────────────────────────────────── */}
        {step === "configure" && (
          <div className="flex flex-col gap-5 overflow-hidden flex-1">
            {/* Category selection */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-muted-foreground" />
                Schritt 1 – Datenkategorien auswählen
              </h3>
              {previewLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lade verfügbare Daten…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_META.map((cat) => {
                    const count = getCategoryCount(cat.key);
                    const available = count > 0;
                    const checked = selectedCategories.has(cat.key);
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        disabled={!available}
                        onClick={() => available && toggleCategory(cat.key)}
                        className={[
                          "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                          available ? "cursor-pointer hover:bg-accent/50" : "opacity-40 cursor-not-allowed",
                          checked ? "border-primary bg-primary/5" : "border-border",
                        ].join(" ")}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={!available}
                          onCheckedChange={() => available && toggleCategory(cat.key)}
                          className="mt-0.5 pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-sm">
                            {cat.icon}
                            {cat.label}
                            {available && (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {count}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {cat.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Target product selection */}
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                Schritt 2 – Zielprodukte auswählen
                {selectedTargetIds.size > 0 && (
                  <Badge className="ml-auto">{selectedTargetIds.size} ausgewählt</Badge>
                )}
              </h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Produkt suchen (Name, Art.-Nr., EAN)…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button type="button" onClick={selectAllFiltered} className="underline hover:text-foreground">
                  Alle auswählen ({filteredProducts.length})
                </button>
                <span>·</span>
                <button type="button" onClick={clearTargets} className="underline hover:text-foreground">
                  Auswahl aufheben
                </button>
              </div>
              <ScrollArea className="flex-1 border rounded-md" style={{ height: 200 }}>
                <div className="p-1">
                  {filteredProducts.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Keine Produkte gefunden.</p>
                  ) : (
                    filteredProducts.map((p: any) => {
                      const selected = selectedTargetIds.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleTarget(p.id)}
                          className={[
                            "w-full flex items-center gap-3 px-3 py-2 rounded text-left hover:bg-accent/50 transition-colors",
                            selected ? "bg-primary/5" : "",
                          ].join(" ")}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleTarget(p.id)}
                            className="pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.internalArticleNumber ?? "—"}
                              {p.ean ? ` · EAN ${p.ean}` : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Overwrite toggle */}
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
              <Switch id="overwrite" checked={overwrite} onCheckedChange={setOverwrite} />
              <Label htmlFor="overwrite" className="flex flex-col cursor-pointer">
                <span className="text-sm font-medium">Vorhandene Daten überschreiben</span>
                <span className="text-xs text-muted-foreground">
                  {overwrite
                    ? "Bestehende Einträge auf Zielprodukten werden überschrieben."
                    : "Nur fehlende Daten werden ergänzt, vorhandene bleiben unverändert."}
                </span>
              </Label>
            </div>
          </div>
        )}

        {/* ── Step: running ───────────────────────────────────────────────── */}
        {step === "running" && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">
              Übertrage Daten auf {selectedTargetIds.size} Produkt{selectedTargetIds.size !== 1 ? "e" : ""}…
            </p>
            <p className="text-xs text-muted-foreground">Bitte warten.</p>
          </div>
        )}

        {/* ── Step: done ──────────────────────────────────────────────────── */}
        {step === "done" && (
          <ScrollArea className="flex-1 max-h-[400px]">
            <div className="flex flex-col gap-3 pr-2">
              <p className="text-sm font-semibold">
                Übertragung abgeschlossen – {results.length} Produkt{results.length !== 1 ? "e" : ""} verarbeitet
              </p>
              {results.map((r: any, i: number) => {
                const hasErrors = r.errors?.length > 0;
                const copied = totalCopied(r);
                const skipped = totalSkipped(r);
                return (
                  <div
                    key={i}
                    className={[
                      "rounded-lg border p-3 text-sm",
                      hasErrors ? "border-destructive/50 bg-destructive/5" : "border-border",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 font-medium mb-1.5">
                      {hasErrors ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      {r.targetProductName ?? `Produkt #${r.targetProductId}`}
                    </div>
                    {/* Per-category breakdown */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {CATEGORY_META.map((cat) => {
                        const c = r.copied?.[cat.key] ?? 0;
                        const s = r.skipped?.[cat.key] ?? 0;
                        if (c === 0 && s === 0) return null;
                        return (
                          <div key={cat.key} className="flex items-center gap-1">
                            {cat.icon}
                            <span>{cat.label}:</span>
                            {c > 0 && <span className="text-green-600 font-medium">{c} kopiert</span>}
                            {s > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-600">
                                <SkipForward className="h-3 w-3" />
                                {s} übersprungen
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Summary line */}
                    <div className="mt-1.5 text-xs font-medium">
                      {copied} Einträge übertragen, {skipped} übersprungen
                    </div>
                    {/* Errors */}
                    {hasErrors && (
                      <div className="mt-1.5 text-xs text-destructive">
                        {r.errors.map((e: string, j: number) => <p key={j}>{e}</p>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="pt-2">
          {step === "configure" && (
            <>
              <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
              <Button onClick={handleExecute} disabled={!canExecute}>
                <Copy className="h-4 w-4 mr-1.5" />
                {selectedTargetIds.size > 0
                  ? `Auf ${selectedTargetIds.size} Produkt${selectedTargetIds.size !== 1 ? "e" : ""} übertragen`
                  : "Zielprodukte auswählen"}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={handleClose}>Schliessen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
