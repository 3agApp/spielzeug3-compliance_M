import { useAuth } from "@/_core/hooks/useAuth";
import { StatusBadge, CompletenessBar } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowRight,
  Package,
  Search,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const STATUS_OPTIONS = [
  "all",
  "open",
  "in_progress",
  "submitted",
  "under_review",
  "clarification_needed",
  "approved",
  "rejected",
  "completed",
] as const;

export default function Products() {
  const { user } = useAuth();
  const { t } = useLang();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const role = (user as any)?.complianceRole ?? "internal_employee";

  const productsQuery = trpc.products.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
  });

  const products = productsQuery.data ?? [];

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.nav.products}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {products.length} {t.common.items}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.action.search + "..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? t.common.all : (t.status as any)[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {productsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              {t.msg.loading}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Package className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t.msg.noProducts}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>{t.product.productName}</th>
                    <th>{t.product.internalArticleNumber}</th>
                    <th>{t.product.supplierArticleNumber}</th>
                    {role !== "supplier" && <th>{t.product.supplier}</th>}
                    <th>{t.product.brand}</th>
                    <th>{t.product.status}</th>
                    <th>{t.product.completenessScore}</th>
                    <th>{t.product.missingRequirements}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setLocation(`/products/${p.id}`)}
                    >
                      <td>
                        <div className="font-medium">{p.productName}</div>
                        {p.ean && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            EAN: {p.ean}
                          </div>
                        )}
                      </td>
                      <td className="text-muted-foreground text-xs">
                        {p.internalArticleNumber ?? "–"}
                      </td>
                      <td className="text-muted-foreground text-xs">
                        {p.supplierArticleNumber ?? "–"}
                      </td>
                      {role !== "supplier" && (
                        <td className="text-sm">{p.supplierName ?? "–"}</td>
                      )}
                      <td className="text-sm">{p.brand ?? "–"}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="min-w-32">
                        <CompletenessBar
                          score={parseFloat(p.completenessScore ?? "0")}
                        />
                      </td>
                      <td>
                        {(p.missingCount ?? 0) > 0 ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {p.missingCount}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                            OK
                          </Badge>
                        )}
                      </td>
                      <td>
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
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
    </div>
  );
}
