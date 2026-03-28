import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { trpc } from "@/lib/trpc";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminRequirements() {
  const { t } = useLang();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    key: "",
    labelDe: "",
    labelEn: "",
    category: "document" as "document" | "data",
    required: true,
    sortOrder: 0,
  });

  const reqQuery = trpc.admin.listRequirementTypes.useQuery();
  const requirements = reqQuery.data ?? [];

  const utils = trpc.useUtils();
  const createMutation = trpc.admin.createRequirementType.useMutation({
    onSuccess: () => {
      toast.success(t.msg.saveSuccess);
      setCreateOpen(false);
      setForm({ key: "", labelDe: "", labelEn: "", category: "document", required: true, sortOrder: 0 });
      utils.admin.listRequirementTypes.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  const toggleMutation = trpc.admin.updateRequirementType.useMutation({
    onSuccess: () => utils.admin.listRequirementTypes.invalidate(),
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.nav.requirements}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Definieren Sie welche Dokumente und Daten Lieferanten einreichen müssen
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t.action.create}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {requirements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">Keine Anforderungstypen definiert</p>
            </div>
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Schlüssel</th>
                  <th>Label (DE)</th>
                  <th>Label (EN)</th>
                  <th>Kategorie</th>
                  <th>Pflicht</th>
                  <th>Aktiv</th>
                  <th>Reihenfolge</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.key}</td>
                    <td className="text-sm">{r.labelDe}</td>
                    <td className="text-sm text-muted-foreground">{r.labelEn}</td>
                    <td>
                      <Badge variant="outline" className="text-xs">
                        {r.category === "document" ? "Dokument" : "Daten"}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        variant="outline"
                        className={r.required ? "text-red-700 border-red-300 bg-red-50" : "text-slate-600"}
                      >
                        {r.required ? t.common.required : t.common.optional}
                      </Badge>
                    </td>
                    <td>
                      <Switch
                        checked={r.active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: r.id, active: checked })
                        }
                      />
                    </td>
                    <td className="text-sm text-muted-foreground">{r.sortOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Anforderungstyp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Schlüssel (eindeutig, z.B. "test_report") *</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="test_report"
                className="mt-1 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Label Deutsch *</Label>
                <Input
                  value={form.labelDe}
                  onChange={(e) => setForm((f) => ({ ...f, labelDe: e.target.value }))}
                  placeholder="Prüfbericht"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Label Englisch *</Label>
                <Input
                  value={form.labelEn}
                  onChange={(e) => setForm((f) => ({ ...f, labelEn: e.target.value }))}
                  placeholder="Test Report"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v as any }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">Dokument</SelectItem>
                    <SelectItem value="data">Daten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reihenfolge</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.required}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, required: checked }))}
              />
              <Label>Pflichtfeld</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t.action.cancel}</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.key || !form.labelDe || !form.labelEn || createMutation.isPending}
            >
              {t.action.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
