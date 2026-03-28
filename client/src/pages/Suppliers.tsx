import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Suppliers() {
  const { t } = useLang();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    supplierName: "",
    contactEmail: "",
    contactPerson: "",
    country: "",
    kontorId: "",
  });

  const suppliersQuery = trpc.suppliers.list.useQuery();
  const allSuppliers = suppliersQuery.data ?? [];
  const suppliers = search
    ? allSuppliers.filter((s: any) =>
        s.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
        s.name?.toLowerCase().includes(search.toLowerCase())
      )
    : allSuppliers;

  const utils = trpc.useUtils();
  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      toast.success(t.msg.saveSuccess);
      setCreateOpen(false);
      setForm({ supplierName: "", contactEmail: "", contactPerson: "", country: "", kontorId: "" });
      utils.suppliers.list.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.nav.suppliers}</h1>
          <p className="text-muted-foreground text-sm mt-1">{suppliers.length} {t.common.items}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t.action.create}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.action.search + "..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Building2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">Keine Lieferanten gefunden</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Lieferant</th>
                    <th>Kontakt</th>
                    <th>Land</th>
                    <th>Kontor-ID</th>
                    <th>Status</th>
                    <th>Produkte</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s: any) => (
                    <tr key={s.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setLocation(`/suppliers/${s.id}`)}>
                      <td>
                        <div className="font-medium">{s.supplierName}</div>
                        {s.contactPerson && (
                          <div className="text-xs text-muted-foreground">{s.contactPerson}</div>
                        )}
                      </td>
                      <td className="text-sm text-muted-foreground">{s.contactEmail ?? "–"}</td>
                      <td className="text-sm">{s.country ?? "–"}</td>
                      <td className="text-xs text-muted-foreground">{s.kontorId ?? "–"}</td>
                      <td>
                        <Badge
                          variant="outline"
                          className={s.active ? "text-emerald-700 border-emerald-300 bg-emerald-50" : "text-slate-600 border-slate-300"}
                        >
                          {s.active ? t.common.active : t.common.inactive}
                        </Badge>
                      </td>
                      <td className="text-sm text-muted-foreground">{s.productCount ?? 0}</td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setLocation(`/suppliers/${s.id}`); }}>
                          →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Lieferant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {[
              { key: "supplierName", label: "Name", required: true },
              { key: "contactEmail", label: "E-Mail", required: false },
              { key: "contactPerson", label: "Ansprechpartner", required: false },
              { key: "country", label: "Land", required: false },
              { key: "kontorId", label: "Kontor-ID", required: false },
            ].map(({ key, label, required }) => (
              <div key={key}>
                <Label>{label}{required && " *"}</Label>
                <Input
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t.action.cancel}</Button>
            <Button
              onClick={() => createMutation.mutate({
                supplierCode: form.kontorId || form.supplierName.slice(0, 10).toUpperCase(),
                name: form.supplierName,
                email: form.contactEmail || undefined,
                country: form.country || undefined,
                kontorId: form.kontorId || undefined,
              })}
              disabled={!form.supplierName || createMutation.isPending}
            >
              {t.action.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
