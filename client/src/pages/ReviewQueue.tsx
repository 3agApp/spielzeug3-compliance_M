import { useAuth } from "@/_core/hooks/useAuth";
import { StatusBadge, CompletenessBar } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ReviewAction = "approve" | "reject" | "clarification";

export default function ReviewQueue() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [, setLocation] = useLocation();
  const role = (user as any)?.complianceRole ?? "internal_employee";

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const productsQuery = trpc.products.list.useQuery({
    status: role === "internal_employee" ? "submitted" : "under_review",
  });

  // Also fetch submitted + under_review for compliance manager
  const allReviewQuery = trpc.products.list.useQuery(
    { status: "submitted" },
    { enabled: role === "compliance_manager" || role === "administrator" }
  );
  const underReviewQuery = trpc.products.list.useQuery(
    { status: "under_review" },
    { enabled: role === "compliance_manager" || role === "administrator" }
  );

  const products =
    role === "compliance_manager" || role === "administrator"
      ? [...(allReviewQuery.data ?? []), ...(underReviewQuery.data ?? [])]
      : (productsQuery.data ?? []);

  const utils = trpc.useUtils();

  const approveMutation = trpc.products.approve.useMutation({
    onSuccess: () => {
      toast.success(t.msg.approveSuccess);
      closeDialog();
      utils.products.list.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  const rejectMutation = trpc.products.reject.useMutation({
    onSuccess: () => {
      toast.success(t.msg.rejectSuccess);
      closeDialog();
      utils.products.list.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  const clarificationMutation = trpc.products.requestClarification.useMutation({
    onSuccess: () => {
      toast.success(t.msg.clarificationSent);
      closeDialog();
      utils.products.list.invalidate();
    },
     onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  const startReviewMutation = trpc.products.requestClarification.useMutation({
    onSuccess: () => {
      toast.success(lang === "de" ? "Status aktualisiert" : "Status updated");
      utils.products.list.invalidate();
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  const closeDialog = () => {
    setSelectedProduct(null);
    setReviewAction(null);
    setReviewNote("");
  };

  const handleConfirm = () => {
    if (!selectedProduct) return;
    if (reviewAction === "approve") {
      approveMutation.mutate({ productId: selectedProduct.id, note: reviewNote || undefined });
    } else if (reviewAction === "reject") {
      if (!reviewNote.trim()) {
        toast.error(t.review.rejectReason);
        return;
      }
      rejectMutation.mutate({ productId: selectedProduct.id, note: reviewNote });
    } else if (reviewAction === "clarification") {
      if (!reviewNote.trim()) {
        toast.error(t.review.clarificationQuestion);
        return;
      }
      clarificationMutation.mutate({ productId: selectedProduct.id, note: reviewNote });
    }
  };

  const isLoading =
    approveMutation.isPending || rejectMutation.isPending || clarificationMutation.isPending;

  const dialogTitle =
    reviewAction === "approve"
      ? t.review.approveTitle
      : reviewAction === "reject"
      ? t.review.rejectTitle
      : t.review.clarificationTitle;

  const notePlaceholder =
    reviewAction === "reject"
      ? t.review.rejectReason
      : reviewAction === "clarification"
      ? t.review.clarificationQuestion
      : t.review.notePlaceholder;

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">{t.nav.reviewQueue}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {products.length} {t.common.items}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <ClipboardList className="h-10 w-10 opacity-30" />
              <p className="text-sm">{lang === "de" ? "Keine Artikel in der Warteschlange" : "No items in the queue"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>{t.product.productName}</th>
                    <th>{t.product.internalArticleNumber}</th>
                    <th>{t.product.supplier}</th>
                    <th>{t.product.status}</th>
                    <th>{t.product.completenessScore}</th>
                    <th>{t.product.missingRequirements}</th>
                    <th>{lang === "de" ? "Aktionen" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          className="font-medium text-primary hover:underline text-left"
                          onClick={() => setLocation(`/products/${p.id}`)}
                        >
                          {p.productName}
                        </button>
                      </td>
                      <td className="text-muted-foreground text-xs">
                        {p.internalArticleNumber ?? "–"}
                      </td>
                      <td className="text-sm">{p.supplierName ?? "–"}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="min-w-32">
                        <CompletenessBar score={parseFloat(p.completenessScore ?? "0")} />
                      </td>
                      <td>
                        {(p.missingCount ?? 0) > 0 ? (
                          <span className="text-xs text-amber-700 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {p.missingCount}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600">OK</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {/* Internal employee: start review */}
                          {role === "internal_employee" && p.status === "submitted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                startReviewMutation.mutate({ productId: p.id, note: lang === "de" ? "Prüfung gestartet" : "Review started" })
                              }
                            >
                              {lang === "de" ? "Prüfung starten" : "Start review"}
                            </Button>
                          )}

                          {/* Compliance manager / admin: approve/reject/clarify */}
                          {(role === "compliance_manager" || role === "administrator") && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setReviewAction("approve");
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setReviewAction("clarification");
                                }}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-700 border-red-300 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setReviewAction("reject");
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setLocation(`/products/${p.id}`)}
                          >
                            <ArrowRight className="h-4 w-4" />
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

      {/* Review Dialog */}
      <Dialog open={!!selectedProduct && !!reviewAction} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">{selectedProduct.productName}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {selectedProduct.internalArticleNumber}
                </p>
              </div>
              <div>
                <Label>{notePlaceholder}</Label>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={notePlaceholder}
                  rows={4}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {t.action.cancel}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              variant={reviewAction === "reject" ? "destructive" : "default"}
            >
              {isLoading ? t.msg.loading : t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
