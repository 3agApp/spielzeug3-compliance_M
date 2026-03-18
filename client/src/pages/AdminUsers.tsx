import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLES = ["supplier", "internal_employee", "compliance_manager", "administrator"] as const;

export default function AdminUsers() {
  const { t } = useLang();
  const [editUser, setEditUser] = useState<any>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editActive, setEditActive] = useState<boolean>(true);

  const usersQuery = trpc.admin.listUsers.useQuery();
  const users = usersQuery.data ?? [];

  const suppliersQuery = trpc.suppliers.list.useQuery();
  const suppliers = suppliersQuery.data ?? [];

  const utils = trpc.useUtils();
  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.success(t.msg.saveSuccess);
      setEditUser(null);
      utils.admin.listUsers.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (user: any) => {
    setEditUser(user);
    setEditRole(user.complianceRole ?? "internal_employee");
    setEditActive(user.active !== false);
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">{t.nav.users}</h1>
        <p className="text-muted-foreground text-sm mt-1">{users.length} {t.common.items}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Users className="h-10 w-10 opacity-30" />
              <p className="text-sm">Keine Benutzer gefunden</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>E-Mail</th>
                    <th>Rolle</th>
                    <th>Lieferant</th>
                    <th>Status</th>
                    <th>Erstellt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.name ?? "–"}</td>
                      <td className="text-sm text-muted-foreground">{u.email ?? "–"}</td>
                      <td>
                        <Badge variant="outline" className="text-xs">
                          {(t.role as any)[u.complianceRole] ?? u.complianceRole ?? "–"}
                        </Badge>
                      </td>
                      <td className="text-sm text-muted-foreground">
                        {(suppliers as any[]).find((s: any) => s.id === u.supplierId)?.name ?? "–"}
                      </td>
                      <td>
                        <Badge
                          variant="outline"
                          className={u.active !== false ? "text-emerald-700 border-emerald-300 bg-emerald-50" : "text-slate-600 border-slate-300"}
                        >
                          {u.active !== false ? t.common.active : t.common.inactive}
                        </Badge>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                          {t.action.edit}
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

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{editUser.name}</p>
                <p className="text-xs text-muted-foreground">{editUser.email}</p>
              </div>
              <div>
                <Label>Rolle</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {(t.role as any)[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editActive ? "active" : "inactive"}
                  onValueChange={(v) => setEditActive(v === "active")}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t.common.active}</SelectItem>
                    <SelectItem value="inactive">{t.common.inactive}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>{t.action.cancel}</Button>
            <Button
              onClick={() =>
                updateMutation.mutate({
                  id: editUser.id,
                  complianceRole: editRole as any,
                  active: editActive,
                })
              }
              disabled={updateMutation.isPending}
            >
              {t.action.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
