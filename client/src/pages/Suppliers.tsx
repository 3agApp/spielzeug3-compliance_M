import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLang } from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { trpc } from "@/lib/trpc";
import { Building2, Pencil, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const EMPTY_FORM = {
  name: "",
  contactEmail: "",
  contactName: "",
  phone: "",
  address: "",
  country: "",
  kontorId: "",
};

export default function Suppliers() {
  const { t } = useLang();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  // ── Create dialog ──────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ...EMPTY_FORM });

  // ── Edit dialog ────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM, active: true });

  const suppliersQuery = trpc.suppliers.list.useQuery();
  const allSuppliers = suppliersQuery.data ?? [];
  const suppliers = search
    ? allSuppliers.filter((s: any) =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.kontorId?.toLowerCase().includes(search.toLowerCase())
      )
    : allSuppliers;

  const utils = trpc.useUtils();

  // ── Create mutation ────────────────────────────────────────────────────────
  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      toast.success(t.msg.saveSuccess);
      setCreateOpen(false);
      setCreateForm({ ...EMPTY_FORM });
      utils.suppliers.list.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  // ── Update mutation ────────────────────────────────────────────────────────
  const updateMutation = trpc.suppliers.update.useMutation({
    onSuccess: () => {
      toast.success(t.msg.saveSuccess);
      setEditOpen(false);
      setEditId(null);
      utils.suppliers.list.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  // Pre-fill edit form when opening
  function openEdit(e: React.MouseEvent, s: any) {
    e.stopPropagation();
    setEditId(s.id);
    setEditForm({
      name: s.name ?? "",
      contactEmail: s.email ?? "",
      contactName: s.contactName ?? "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      country: s.country ?? "",
      kontorId: s.kontorId ?? "",
      active: s.active ?? true,
    });
    setEditOpen(true);
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.nav.suppliers}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {suppliers.length} {t.common.items}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t.action.create}
        </Button>
      </div>

      {/* Search */}
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

      {/* Table */}
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
                    <tr
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setLocation(`/suppliers/${s.id}`)}
                    >
                      <td>
                        <div className="font-medium">{s.name ?? "–"}</div>
                        {s.contactName && (
                          <div className="text-xs text-muted-foreground">{s.contactName}</div>
                        )}
                      </td>
                      <td className="text-sm text-muted-foreground">{s.email ?? "–"}</td>
                      <td className="text-sm">{s.country ?? "–"}</td>
                      <td className="text-xs text-muted-foreground">{s.kontorId ?? "–"}</td>
                      <td>
                        <Badge
                          variant="outline"
                          className={
                            s.active
                              ? "text-emerald-700 border-emerald-300 bg-emerald-50"
                              : "text-slate-600 border-slate-300"
                          }
                        >
                          {s.active ? t.common.active : t.common.inactive}
                        </Badge>
                      </td>
                      <td className="text-sm text-muted-foreground">{s.productCount ?? 0}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => openEdit(e, s)}
                            title="Bearbeiten"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/suppliers/${s.id}`);
                            }}
                          >
                            →
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neuer Lieferant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(
              [
                { key: "name", label: "Name *", required: true },
                { key: "contactEmail", label: "E-Mail" },
                { key: "contactName", label: "Ansprechpartner" },
                { key: "phone", label: "Telefon" },
                { key: "address", label: "Adresse" },
                { key: "country", label: "Land (ISO, z. B. DE)" },
                { key: "kontorId", label: "Kontor-ID" },
              ] as { key: keyof typeof createForm; label: string; required?: boolean }[]
            ).map(({ key, label }) => (
              <div key={key}>
                <Label className="text-sm">{label}</Label>
                <Input
                  value={createForm[key]}
                  onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t.action.cancel}
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  supplierCode:
                    createForm.kontorId ||
                    createForm.name.slice(0, 10).toUpperCase().replace(/\s+/g, "_"),
                  name: createForm.name,
                  email: createForm.contactEmail || undefined,
                  phone: createForm.phone || undefined,
                  address: createForm.address || undefined,
                  country: createForm.country || undefined,
                  kontorId: createForm.kontorId || undefined,
                })
              }
              disabled={!createForm.name || createMutation.isPending}
            >
              {t.action.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lieferant bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(
              [
                { key: "name", label: "Name *" },
                { key: "contactEmail", label: "E-Mail" },
                { key: "contactName", label: "Ansprechpartner" },
                { key: "phone", label: "Telefon" },
                { key: "address", label: "Adresse" },
                { key: "country", label: "Land (ISO, z. B. DE)" },
                { key: "kontorId", label: "Kontor-ID" },
              ] as { key: keyof typeof editForm; label: string }[]
            ).map(({ key, label }) => (
              <div key={key}>
                <Label className="text-sm">{label}</Label>
                <Input
                  value={editForm[key] as string}
                  onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1"
                />
              </div>
            ))}
            {/* Active toggle */}
            <div className="flex items-center justify-between pt-1">
              <Label className="text-sm">Aktiv</Label>
              <Switch
                checked={editForm.active}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t.action.cancel}
            </Button>
            <Button
              onClick={() => {
                if (!editId) return;
                updateMutation.mutate({
                  id: editId,
                  name: editForm.name || undefined,
                  email: editForm.contactEmail || undefined,
                  phone: editForm.phone || undefined,
                  address: editForm.address || undefined,
                  country: editForm.country || undefined,
                  kontorId: editForm.kontorId || undefined,
                  active: editForm.active,
                });
              }}
              disabled={!editForm.name || updateMutation.isPending}
            >
              {t.action.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
