import { useAuth } from "@/_core/hooks/useAuth";
import { StatusBadge, CompletenessBar } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { trpc } from "@/lib/trpc";
import { AiAnalysisCard } from "@/components/AiAnalysisCard";
import ComponentsTab from "@/components/ComponentsTab";
import SignatureRequestDialog from "@/components/SignatureRequestDialog";
import SignatureRequestList from "@/components/SignatureRequestList";
import { SealStatusPill } from "@/components/SealBadge";
import type { SealStatus } from "@/components/SealBadge";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Package,
  QrCode,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
  Globe,
  GlobeLock,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const DOC_TYPES = [
  "test_report",
  "declaration_of_conformity",
  "manual",
  "certificate",
  "product_image",
  "safety_image",
  "regulatory_document",
  "other",
] as const;

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const productId = parseInt(id ?? "0");
  const { user } = useAuth();
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState("documents");
  const [, setLocation] = useLocation();
  const role = (user as any)?.complianceRole ?? "internal_employee";
  const isInternalRole = ["administrator", "compliance_manager", "internal_employee", "super_admin"].includes(role);

  const productQuery = trpc.products.getById.useQuery({ id: productId });
  const product = productQuery.data as any;

  // Seal info for header badge
  const sealInfoQuery = trpc.tenant.getSealInfo.useQuery(
    { productId },
    { enabled: !productQuery.isLoading && isInternalRole }
  );
  const sealInfo = sealInfoQuery.data;

  // Signature badge – load latest non-cancelled request for header display
  const latestSigQuery = trpc.bunnydoc.latestByProduct.useQuery(
    { productId },
    { enabled: !productQuery.isLoading && ["administrator", "compliance_manager", "internal_employee"].includes(role) }
  );
  const latestSig = latestSigQuery.data;

  const documentsQuery = trpc.documents.listByProduct.useQuery({ productId });
  const documents = documentsQuery.data ?? [];

  const safetyQuery = trpc.safety.getByProduct.useQuery({ productId });
  const safety = safetyQuery.data as any;

  const commentsQuery = trpc.comments.listByProduct.useQuery({ productId });
  const comments = commentsQuery.data ?? [];

  const utils = trpc.useUtils();

  // Submit mutation
  const submitMutation = trpc.products.submit.useMutation({
    onSuccess: () => {
      toast.success(t.msg.submitSuccess);
      utils.products.getById.invalidate({ id: productId });
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  // Delete document state
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const [deleteDocName, setDeleteDocName] = useState<string>("");
  const [deleteComment, setDeleteComment] = useState("");
  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: (res: any) => {
      setDeleteDocId(null);
      setDeleteDocName("");
      setDeleteComment("");
      documentsQuery.refetch();
      utils.products.getById.invalidate({ id: productId });
      toast.success(t.msg.deleteSuccess);
      if (res?.confirmedAtReset) {
        toast.warning(t.seal.confirmedReset, {
          description: t.seal.confirmedResetDesc,
          duration: 6000,
        });
      }
    },
    onError: (e: any) => toast.error(translateError(e.message, t)),
  });

  // Comment mutation
  const [commentText, setCommentText] = useState("");
  const [internalOnly, setInternalOnly] = useState(false);
  const commentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      utils.comments.listByProduct.invalidate({ productId });
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  if (productQuery.isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground">
        {t.msg.loading}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t.product.notFound ?? "Produkt nicht gefunden."}</p>
        <Button variant="ghost" onClick={() => setLocation("/products")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> {t.common.back}
        </Button>
      </div>
    );
  }

  const supplierConfirmedAt = role === "supplier" ? (product as any)?.supplierConfirmedAt : null;
  const hasSupplierConfirmed = !!supplierConfirmedAt;

  const canSubmit =
    role === "supplier" &&
    ["open", "in_progress", "clarification_needed"].includes(product.status);

  // Supplier can only submit after confirming completeness
  const submitBlocked = canSubmit && !hasSupplierConfirmed;

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Back + Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/products")} className="-ml-2 mb-3">
          <ArrowLeft className="mr-2 h-4 w-4" /> {t.common.back}
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{product.productName}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <StatusBadge status={product.status} />
              {/* Seal status badge */}
              {isInternalRole && sealInfo?.publicUuid && (
                <button
                  type="button"
                  onClick={() => setActiveTab("seal")}
                  title={t.seal.title}
                  className="focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
                >
                  <SealStatusPill status={(sealInfo.sealStatus ?? "not_verified") as SealStatus} />
                </button>
              )}
              {/* Signature status badge – visible for internal roles */}
              {latestSig && (
                <button
                  type="button"
                  onClick={() => setActiveTab("signatures")}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring"
                  title={t.signatures.title}
                  style={{
                    backgroundColor:
                      latestSig.status === "completed" ? "#d1fae5" :
                      latestSig.status === "signed"    ? "#d1fae5" :
                      latestSig.status === "viewed"    ? "#dbeafe" :
                      latestSig.status === "declined"  ? "#fee2e2" :
                      latestSig.status === "expired"   ? "#f3f4f6" :
                                                         "#fef3c7",
                    color:
                      latestSig.status === "completed" ? "#065f46" :
                      latestSig.status === "signed"    ? "#065f46" :
                      latestSig.status === "viewed"    ? "#1e40af" :
                      latestSig.status === "declined"  ? "#991b1b" :
                      latestSig.status === "expired"   ? "#4b5563" :
                                                         "#92400e",
                    borderColor:
                      latestSig.status === "completed" ? "#6ee7b7" :
                      latestSig.status === "signed"    ? "#6ee7b7" :
                      latestSig.status === "viewed"    ? "#93c5fd" :
                      latestSig.status === "declined"  ? "#fca5a5" :
                      latestSig.status === "expired"   ? "#d1d5db" :
                                                         "#fcd34d",
                  }}
                >
                  <FileSignature className="h-3 w-3" />
                  {latestSig.status === "completed" ? t.signatures.status.completed :
                   latestSig.status === "signed"    ? t.signatures.status.completed :
                   latestSig.status === "viewed"    ? t.signatures.status.viewed :
                   latestSig.status === "declined"  ? t.signatures.status.declined :
                   latestSig.status === "expired"   ? t.signatures.status.expired :
                                                      t.signatures.status.pending}
                </button>
              )}
              {product.internalArticleNumber && (
                <span className="text-sm text-muted-foreground">
                  {t.product.internalArticleNumber}: {product.internalArticleNumber}
                </span>
              )}
              {product.brand && (
                <span className="text-sm text-muted-foreground">{product.brand}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {canSubmit && (
              <>
                {submitBlocked && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 max-w-xs text-right">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{t.msg.submitBlockedHint} <strong>{t.msg.submitBlockedBold}</strong> {t.msg.submitBlockedSuffix}</span>
                  </div>
                )}
                <Button
                  onClick={() => {
                    if (submitBlocked) {
                      setActiveTab("seal");
                      toast.warning(t.msg.submitBlockedToast, {
                        description: t.msg.submitBlockedToastDesc,
                      });
                      return;
                    }
                    submitMutation.mutate({ productId, note: undefined });
                  }}
                  disabled={submitMutation.isPending}
                  variant={submitBlocked ? "outline" : "default"}
                  className={submitBlocked ? "opacity-60 cursor-not-allowed" : ""}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {t.action.submit}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Meta info + Completeness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">{t.product.internalArticleNumber}</p>
                <p className="font-medium mt-0.5">{product.internalArticleNumber ?? "–"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t.product.supplierArticleNumber}</p>
                <p className="font-medium mt-0.5">{product.supplierArticleNumber ?? "–"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t.product.orderNumber}</p>
                <p className="font-medium mt-0.5">{product.orderNumber ?? "–"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">EAN</p>
                <p className="font-medium mt-0.5">{product.ean ?? "–"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t.product.brand}</p>
                <p className="font-medium mt-0.5">{product.brand ?? "–"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t.product.supplier}</p>
                <p className="font-medium mt-0.5">{product.supplierName ?? "–"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t.product.completenessScore}</p>
              <CompletenessBar score={parseFloat(product.completenessScore ?? "0")} />
            </div>
            {product.missingRequirements && product.missingRequirements.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  {t.product.missingRequirements} ({product.missingRequirements.length})
                </p>
                <div className="space-y-1">
                  {product.missingRequirements.slice(0, 5).map((req: any) => (
                    <div key={req.id} className="text-xs px-2 py-1 bg-amber-50 border border-amber-200 rounded text-amber-700">
                      {(t.reqType as any)[req.requirementKey] ?? req.requirementKey}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {product.reviewNote && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs font-medium text-blue-700 mb-1">{t.review.note}</p>
                <p className="text-xs text-blue-600">{product.reviewNote}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="components" className="gap-2">
            <Package className="h-4 w-4" />
            {t.components.title}
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            {t.product.documents} ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="safety" className="gap-2">
            <Shield className="h-4 w-4" />
            {t.product.safetyData}
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            {t.product.comments} ({comments.length})
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="h-4 w-4" />
            {t.aiAnalysis.title}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Clock className="h-4 w-4" />
            {t.product.timeline}
          </TabsTrigger>
          <TabsTrigger value="signatures" className="gap-2">
            <FileSignature className="h-4 w-4" />
            {t.signatures.title}
          </TabsTrigger>
          <TabsTrigger value="batch" className="gap-2">
            <Package className="h-4 w-4" />
            {t.batch.tabLabel}
          </TabsTrigger>
          {(isInternalRole || role === "supplier") && (
            <TabsTrigger value="seal" className="gap-2">
              <ShieldCheck className="h-5 w-5" />
              {t.seal.title}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Components Tab */}
        <TabsContent value="components" className="mt-4">
          <ComponentsTab productId={productId} readOnly={role !== "supplier" && role !== "internal_employee" && role !== "compliance_manager" && role !== "administrator"} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4 space-y-4">
          {(role === "supplier" || isInternalRole) && (
            <UploadDocumentCard
              productId={productId}
              role={role}
              isOperator={isInternalRole}
              t={t}
              onSuccess={(confirmedAtReset?: boolean) => {
                documentsQuery.refetch();
                utils.products.getById.invalidate({ id: productId });
                if (confirmedAtReset) {
                  toast.warning(t.seal.confirmedReset, {
                    description: t.seal.confirmedResetDesc,
                    duration: 6000,
                  });
                }
              }}
            />
          )}
          <Card>
            <CardContent className="p-0">
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <FileText className="h-8 w-8 opacity-30" />
                  <p className="text-sm">{t.msg.noDocuments}</p>
                </div>
              ) : (
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      <th>{t.documents.typeLabel}</th>
                      <th>{t.documents.filenameLabel}</th>
                      <th>{t.common.version}</th>
                      <th>Status</th>
                      <th>{t.common.uploadedAt}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc: any) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        productId={productId}
                        role={role}
                        isInternalRole={isInternalRole}
                        t={t}
                        onDelete={(id: number, name: string) => {
                          setDeleteDocId(id);
                          setDeleteDocName(name);
                          setDeleteComment("");
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delete Document Confirmation Dialog */}
        <Dialog open={deleteDocId !== null} onOpenChange={(open) => { if (!open) { setDeleteDocId(null); setDeleteComment(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                {t.documents.deleteTitle}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {t.documents.deleteConfirmText} <span className="font-semibold text-foreground">{deleteDocName}</span> {t.documents.deleteConfirmSuffix}
              </p>
              {isInternalRole && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="deleteComment" className="text-sm">
                      {t.documents.deleteReason}
                      <span className="ml-1 text-xs text-muted-foreground">({t.common.optional})</span>
                    </Label>
                    <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">
                      {t.documents.operatorBadge}
                    </Badge>
                  </div>
                  <Textarea
                    id="deleteComment"
                    placeholder={t.documents.deleteReasonPlaceholder}
                    value={deleteComment}
                    onChange={(e) => setDeleteComment(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="resize-none text-sm"
                  />
                  <p className="text-xs text-muted-foreground text-right">{deleteComment.length}/500</p>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setDeleteDocId(null); setDeleteComment(""); }}>
                {t.action.cancel}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (deleteDocId === null) return;
                  deleteMutation.mutate({
                    documentId: deleteDocId,
                    productId,
                    operatorComment: isInternalRole && deleteComment.trim() ? deleteComment.trim() : undefined,
                  });
                }}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {t.action.delete}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Safety Tab */}
        <TabsContent value="safety" className="mt-4">
          <SafetyDataCard
            productId={productId}
            safety={safety}
            role={role}
            t={t}
            onSuccess={() => safetyQuery.refetch()}
          />
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t.msg.noComments}</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((c: any) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-lg border text-sm ${
                        c.visibilityInternalOnly
                          ? "bg-amber-50 border-amber-200"
                          : "bg-muted/30 border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs">
                          {c.userName ?? c.userId} · {(t.role as any)[c.userRole] ?? c.userRole}
                        </span>
                        <div className="flex items-center gap-2">
                          {c.visibilityInternalOnly && (
                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                              {t.msg.internalOnly}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm">{c.commentText}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* New comment */}
              <div className="border-t pt-4 space-y-3">
                <Textarea
                  placeholder={t.review.notePlaceholder}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  {role !== "supplier" && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={internalOnly}
                        onChange={(e) => setInternalOnly(e.target.checked)}
                        className="rounded"
                      />
                      {t.msg.internalOnly}
                    </label>
                  )}
                  <Button
                    size="sm"
                    onClick={() =>
                      commentMutation.mutate({
                        productId,
                        commentText,
                        visibilityInternalOnly: internalOnly,
                      })
                    }
                    disabled={!commentText.trim() || commentMutation.isPending}
                    className="ml-auto"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {t.action.addComment}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="ai" className="mt-4">
          <AiAnalysisCard
            productId={productId}
            canTrigger={["administrator", "compliance_manager", "internal_employee"].includes(role)}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineCard productId={productId} t={t} />
        </TabsContent>
        {/* Signatures Tab */}
        <TabsContent value="signatures" className="mt-4">
          <SignaturesTab
            productId={productId}
            productName={product.productName}
            canManage={["administrator", "compliance_manager"].includes(role)}
          />
        </TabsContent>
        {/* Batch Tab */}
        <TabsContent value="batch" className="mt-4">
          <BatchTab productId={productId} canEdit={isInternalRole} />
        </TabsContent>
        {/* Seal Tab */}
        {(isInternalRole || role === "supplier") && (
          <TabsContent value="seal" className="mt-4">
            <SealTab
              productId={productId}
              productName={product.productName}
              canManage={["administrator", "compliance_manager", "super_admin"].includes(role)}
              isAdmin={["administrator", "super_admin"].includes(role)}
              isSupplier={role === "supplier"}
              onSealActivated={() => sealInfoQuery.refetch()}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── Signatures Tab ─────────────────────────────────────────────────────────
function SignaturesTab({
  productId,
  productName,
  canManage,
}: {
  productId: number;
  productName: string;
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <FileSignature className="mr-2 h-4 w-4" />
            Zur Unterschrift senden
          </Button>
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          <SignatureRequestList
            productId={productId}
            canCancel={canManage}
          />
        </CardContent>
      </Card>
      <SignatureRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productId={productId}
        productName={productName}
        onSuccess={() => utils.bunnydoc.listByProduct.invalidate({ productId })}
      />
    </div>
  );
}

// ─── Seal Tab ───────────────────────────────────────────────────────────────────────────────────────
function SealTab({
  productId,
  productName,
  canManage,
  isAdmin,
  isSupplier = false,
  onSealActivated,
}: {
  productId: number;
  productName: string;
  canManage: boolean;
  isAdmin: boolean;
  isSupplier?: boolean;
  onSealActivated?: () => void;
}) {
  const { t } = useLang();
  const utils = trpc.useUtils();
  const sealQuery = trpc.tenant.getSealInfo.useQuery({ productId });
  const seal = sealQuery.data;

  // Supplier confirmation
  const productQuery = trpc.products.getById.useQuery({ id: productId }, { enabled: isSupplier });
  const supplierConfirmedAt = isSupplier ? (productQuery.data as any)?.supplierConfirmedAt : null;
  const supplierConfirmedBy = isSupplier ? (productQuery.data as any)?.supplierConfirmedBy : null;

  // Missing requirements checklist (only for supplier)
  const requirementsQuery = trpc.products.getMissingRequirements.useQuery(
    { productId },
    { enabled: isSupplier }
  );
  const allRequirements = requirementsQuery.data ?? [];
  const mandatoryReqs = allRequirements.filter((r: any) => r.required);
  const missingMandatory = mandatoryReqs.filter(
    (r: any) => r.status === "missing" || r.status === "rejected"
  );
  const allMandatoryMet = mandatoryReqs.length === 0 || missingMandatory.length === 0;

  const confirmMutation = trpc.products.supplierConfirm.useMutation({
    onSuccess: (data) => {
      toast.success(t.seal.confirmSuccess, {
        description: `${t.seal.confirmedOn} ${new Date(data.confirmedAt).toLocaleDateString()}.`,
      });
      productQuery.refetch();
    },
    onError: (e) => toast.error(t.seal.confirmFailed, { description: translateError(e.message, t) }),
  });

  const activateMutation = trpc.tenant.activateSeal.useMutation({
    onSuccess: () => {
      toast.success(t.seal.activateSuccess);
      sealQuery.refetch();
      onSealActivated?.();
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  const setVisibleMutation = trpc.tenant.setPublicVisible.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.visible ? t.seal.visibleOn : t.seal.visibleOff);
      sealQuery.refetch();
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  const setOverrideMutation = trpc.tenant.setSealStatusOverride.useMutation({
    onSuccess: () => {
      toast.success(t.seal.overrideSaved);
      sealQuery.refetch();
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  const sealStatus = (seal?.sealStatus ?? "not_verified") as SealStatus;
  return (
    <div className="space-y-4">
      {/* Supplier: Declaration of Completeness */}
      {isSupplier && (
        <Card className={supplierConfirmedAt ? "border-green-300 bg-green-50/40" : "border-amber-200 bg-amber-50/30"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {supplierConfirmedAt ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              {t.seal.completenessDeclaration}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {supplierConfirmedAt ? (
              <div className="space-y-2">
                <p className="text-sm text-green-800 font-medium">
                  ✅ {t.seal.completenessConfirmed}
                </p>
                <p className="text-xs text-green-700">
                  {t.seal.confirmedBy} <strong>{supplierConfirmedBy}</strong> {t.seal.confirmedOn2}{" "}
                  {new Date(supplierConfirmedAt).toLocaleDateString("de-CH", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.seal.renewHint}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-amber-800">
                  {t.seal.completenessPrompt}
                </p>
                <ul className="text-xs text-amber-700 space-y-1 list-none">
                  <li className="flex items-start gap-2"><span className="mt-0.5">&#9675;</span>{t.seal.checklistDocs}</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5">&#9675;</span>{t.seal.checklistSafety}</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5">&#9675;</span>{t.seal.checklistProduct}</li>
                </ul>
              </div>
            )}
            {/* Mandatory requirements checklist */}
            {!supplierConfirmedAt && mandatoryReqs.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    {t.seal.mandatoryDocs}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    allMandatoryMet
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {mandatoryReqs.length - missingMandatory.length} / {mandatoryReqs.length} {t.seal.completeCount}
                  </span>
                </div>
                <ul className="divide-y">
                  {mandatoryReqs.map((req: any) => {
                    const isMet = req.status !== "missing" && req.status !== "rejected";
                    const label = ({
                      test_report: (t.reqType as any).test_report,
                      declaration_of_conformity: (t.reqType as any).declaration_of_conformity,
                      manual: (t.reqType as any).manual,
                      certificate: (t.reqType as any).certificate,
                      product_image: (t.reqType as any).product_image,
                      safety_image: (t.reqType as any).safety_image,
                      regulatory_document: (t.reqType as any).regulatory_document,
                      safety_text: (t.reqType as any).safety_text,
                      warning_text: (t.reqType as any).warning_text,
                      age_grading: (t.reqType as any).age_grading,
                      material_information: (t.reqType as any).material_information,
                      usage_restrictions: (t.reqType as any).usage_restrictions,
                      safety_instructions: (t.reqType as any).safety_instructions,
                      additional_notes: (t.reqType as any).additional_notes,
                    } as Record<string, string>)[req.requirementType] ?? req.requirementType;
                    const statusLabel = ({
                      missing: (t.status as any).missing ?? "Fehlend",
                      provided: (t.status as any).provided ?? "Hochgeladen",
                      under_review: t.status.under_review,
                      approved: (t.status as any).approved ?? "Genehmigt",
                      rejected: (t.status as any).rejected ?? "Abgelehnt",
                    } as Record<string, string>)[req.status] ?? req.status;
                    return (
                      <li key={req.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                        {isMet ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className={`flex-1 ${isMet ? "text-foreground" : "text-red-700 font-medium"}`}>
                          {label}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isMet
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}>
                          {statusLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {!allMandatoryMet && (
                  <div className="bg-red-50 border-t border-red-100 px-3 py-2">
                    <p className="text-xs text-red-700">
                      {t.seal.mandatoryMissing}{" "}
                      <button
                        className="underline font-medium hover:text-red-900"
                        onClick={() => {
                          const tabTrigger = document.querySelector('[data-value="documents"]') as HTMLElement;
                          tabTrigger?.click();
                        }}
                      >
                        {t.seal.mandatoryMissingLink}
                      </button>{" "}
                      {t.seal.mandatoryMissingSuffix}
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button
              size="sm"
              variant={supplierConfirmedAt ? "outline" : "default"}
              className={`${
                supplierConfirmedAt
                  ? ""
                  : allMandatoryMet
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "opacity-50 cursor-not-allowed"
              }`}
              onClick={() => {
                if (!allMandatoryMet && !supplierConfirmedAt) {
                  toast.warning(t.seal.mandatoryMissingToast, {
                    description: `${missingMandatory.length} ${t.seal.mandatoryMissingToastDesc}`,
                  });
                  return;
                }
                confirmMutation.mutate({ productId });
              }}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {supplierConfirmedAt ? t.seal.renewConfirm : t.seal.confirmBtn}
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-[#C8102E]" />
            Swiss Product Seal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{t.seal.sealStatusLabel}</p>
              <SealStatusPill status={sealStatus} />
            </div>
            {seal?.sealEnabledAt && (
              <div>
                <p className="text-xs text-muted-foreground">{t.seal.activatedAt}</p>
                <p className="text-sm font-medium">
                  {new Date(seal.sealEnabledAt).toLocaleDateString("de-CH")}
                </p>
              </div>
            )}
          </div>

          {!seal?.publicUuid && canManage && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 font-medium mb-2">{t.seal.notActivatedTitle}</p>
              <p className="text-xs text-amber-700 mb-3">
                {t.seal.notActivatedDesc}
              </p>
              <Button
                size="sm"
                onClick={() => activateMutation.mutate({ productId })}
                disabled={activateMutation.isPending}
                className="bg-[#C8102E] hover:bg-[#a00d24] text-white"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {activateMutation.isPending ? t.seal.activating : t.seal.activateWithQr}
              </Button>
            </div>
          )}

          {seal?.publicUuid && (
            <>
              {/* Public URL + Visibility Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t.seal.publicPage}</p>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {seal.publicVisible !== false ? t.seal.publicToggleOn : t.seal.publicToggleOff}
                      </span>
                      <button
                        type="button"
                        onClick={() => setVisibleMutation.mutate({ productId, visible: !(seal.publicVisible !== false) })}
                        disabled={setVisibleMutation.isPending}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                          seal.publicVisible !== false ? "bg-green-500" : "bg-gray-300"
                        }`}
                        title={seal.publicVisible !== false ? t.seal.publicToggleTitleOn : t.seal.publicToggleTitleOff}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            seal.publicVisible !== false ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                    {seal.publicUrl}
                  </code>
                  <a href={seal.publicUrl ?? ""} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" title={t.seal.openPage}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>

                {/* Landingpage-Vorschau-Button */}
                {canManage && (
                  <a
                    href={seal.publicUrl ?? ""}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 mt-1 border-dashed hover:border-solid hover:bg-accent"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t.seal.landingPreview}
                    </Button>
                  </a>
                )}
              </div>

              {/* Admin: Status Override */}
              {isAdmin && (
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <p className="text-xs font-medium mb-2 text-muted-foreground">{t.seal.overrideLabel}</p>
                  <Select
                    value={seal.sealStatusOverride ?? "__auto"}
                    onValueChange={(val) =>
                      setOverrideMutation.mutate({
                        productId,
                        override: val === "__auto" ? null : (val as any),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto">{t.seal.overrideAuto}</SelectItem>
                      <SelectItem value="verified">{t.seal.overrideVerified}</SelectItem>
                      <SelectItem value="in_progress">{t.seal.overrideInProgress}</SelectItem>
                      <SelectItem value="not_verified">{t.seal.overrideNotVerified}</SelectItem>
                    </SelectContent>
                  </Select>
                  {seal.sealStatusOverride && (
                    <p className="text-xs text-amber-600 mt-1">{t.seal.overrideActive}</p>
                  )}
                </div>
              )}

              {/* QR Code */}
              {seal.qrCodeUrl && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{t.seal.qrCodeLabel}</p>
                  <div className="flex items-start gap-4">
                    <div className="border rounded-lg p-3 bg-white shadow-sm">
                      <img
                        src={seal.qrCodeUrl}
                        alt="QR-Code"
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                    <div className="space-y-2">
                      <a href={seal.qrCodeUrl} download={`qr-${productName}.png`}>
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="mr-2 h-4 w-4" />
                          {t.seal.downloadPng}
                        </Button>
                      </a>
                      {seal.qrCodeSvgUrl && (
                        <a href={seal.qrCodeSvgUrl} download={`qr-${productName}.svg`}>
                          <Button variant="outline" size="sm" className="w-full">
                            <QrCode className="mr-2 h-4 w-4" />
                            {t.seal.downloadSvg}
                          </Button>
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t.seal.printRecommendation}
                      </p>
                       <SealLabelDownloadButton productId={productId} sealStatus={sealStatus} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Produktspezifischer HTML-Einbettungscode ── */}
              {seal?.publicUuid && seal?.qrCodeUrl && (
                <ProductEmbedCode
                  publicUuid={seal.publicUuid}
                  qrCodeUrl={seal.qrCodeUrl}
                  publicUrl={seal.publicUrl ?? ""}
                  productName={productName}
                  sealStatus={sealStatus}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
// ─── Produktspezifischer Embed-Code ─────────────────────────────────
function ProductEmbedCode({
  publicUuid,
  qrCodeUrl,
  publicUrl,
  productName,
  sealStatus,
}: {
  publicUuid: string;
  qrCodeUrl: string;
  publicUrl: string;
  productName: string;
  sealStatus: SealStatus;
}) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"dynamic" | "badge" | "widget" | "minimal">("dynamic");
  const [showPreview, setShowPreview] = useState(true);

  // Basis-URL des aktuellen Servers für den API-Aufruf im Widget-Script
  const apiBase = window.location.origin;

  const statusLabel = sealStatus === "verified" ? t.seal.statusVerified : sealStatus === "in_progress" ? t.seal.statusInProgress : t.seal.statusNotVerified;
  const statusColor = sealStatus === "verified" ? "#16a34a" : sealStatus === "in_progress" ? "#d97706" : "#6b7280";
  const statusBg = sealStatus === "verified" ? "#f0fdf4" : sealStatus === "in_progress" ? "#fffbeb" : "#f9fafb";
  const statusBorder = sealStatus === "verified" ? "#86efac" : sealStatus === "in_progress" ? "#fcd34d" : "#e5e7eb";

  const widgetCode = `<!-- Swiss Product Seal Widget: ${productName} -->
<div id="swiss-seal-widget" style="display:inline-block;font-family:system-ui,sans-serif;">
  <a href="${publicUrl}" target="_blank" rel="noopener noreferrer"
     style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid ${statusBorder};border-radius:12px;background:${statusBg};text-decoration:none;color:inherit;max-width:320px;">
    <img src="${qrCodeUrl}" alt="QR-Code" width="64" height="64" style="border-radius:6px;flex-shrink:0;" />
    <div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">Swiss Product Seal</div>
      <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:4px;">${productName}</div>
      <div style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;color:${statusColor};background:white;border:1px solid ${statusBorder};border-radius:20px;padding:2px 8px;">
        <span style="width:6px;height:6px;border-radius:50%;background:${statusColor};display:inline-block;"></span>
        ${statusLabel}
      </div>
    </div>
  </a>
</div>`;

  const badgeCode = `<!-- Swiss Product Seal Badge: ${productName} -->
<a href="${publicUrl}" target="_blank" rel="noopener noreferrer"
   style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid ${statusBorder};border-radius:20px;background:${statusBg};text-decoration:none;font-family:system-ui,sans-serif;font-size:12px;font-weight:500;color:${statusColor};">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
  Swiss Product Seal · ${statusLabel}
</a>`;

  const minimalCode = `<!-- Swiss Product Seal QR: ${productName} -->
<a href="${publicUrl}" target="_blank" rel="noopener noreferrer" title="Swiss Product Seal – ${statusLabel}">
  <img src="${qrCodeUrl}" alt="Swiss Product Seal QR-Code" width="80" height="80" style="border-radius:8px;" />
</a>`;

  // Dynamisches JS-Widget: lädt Status per fetch() zur Laufzeit, zeigt immer aktuellen Prüfstatus
  const dynamicCode = `<!-- Swiss Product Seal – Dynamisches Widget (Status wird live geladen) -->
<div id="sps-widget-${publicUuid}"></div>
<script>
(function() {
  var uuid = "${publicUuid}";
  var apiUrl = "${apiBase}/api/v1/products/" + uuid;
  var el = document.getElementById("sps-widget-" + uuid);
  if (!el) return;
  el.innerHTML = '<span style="font-size:12px;color:#9ca3af;">Swiss Product Seal wird geladen…</span>';
  fetch(apiUrl)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var colors = { verified: { bg: "#f0fdf4", border: "#86efac", text: "#16a34a", label: "Verifiziert" }, in_progress: { bg: "#fffbeb", border: "#fcd34d", text: "#d97706", label: "In Pr\u00fcfung" }, not_verified: { bg: "#f9fafb", border: "#e5e7eb", text: "#6b7280", label: "Nicht verifiziert" } };
      var c = colors[d.sealStatus] || colors.not_verified;
      var qr = d.qrCodeUrl ? '<img src="' + d.qrCodeUrl + '" alt="QR" width="64" height="64" style="border-radius:6px;flex-shrink:0;" />' : '';
      el.innerHTML = '<a href="' + d.landingPageUrl + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid ' + c.border + ';border-radius:12px;background:' + c.bg + ';text-decoration:none;color:inherit;max-width:320px;font-family:system-ui,sans-serif;">'
        + qr
        + '<div><div style="font-size:11px;color:#6b7280;margin-bottom:2px;">Swiss Product Seal</div>'
        + '<div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:4px;">' + d.productName + '</div>'
        + '<div style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;color:' + c.text + ';background:white;border:1px solid ' + c.border + ';border-radius:20px;padding:2px 8px;">'
        + '<span style="width:6px;height:6px;border-radius:50%;background:' + c.text + ';display:inline-block;"></span>' + c.label
        + '</div></div></a>';
    })
    .catch(function() {
      el.innerHTML = '<a href="${publicUrl}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#6b7280;text-decoration:none;">Swiss Product Seal →</a>';
    });
})();
<\/script>
<noscript><a href="${publicUrl}" target="_blank" rel="noopener noreferrer">Swiss Product Seal</a></noscript>`;

  const codes: Record<string, string> = { dynamic: dynamicCode, widget: widgetCode, badge: badgeCode, minimal: minimalCode };
  const currentCode = codes[activeTab];

  // srcdoc für die isolierte Vorschau
  // Bei der dynamischen Variante: Script-Tag wird ausgeführt (allow-scripts), lädt echte API
  const previewHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 20px; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100px; box-sizing: border-box; font-family: system-ui, sans-serif; }
</style>
</head>
<body>
${currentCode.replace(/<!--.*?-->/g, "").replace(/<\/script>/g, "</script>").trim()}
</body>
</html>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode).then(() => {
      setCopied(true);
      toast.success("Einbettungscode kopiert!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">HTML-Einbettungscode</span>
          <span className="text-xs text-muted-foreground">– direkt in Onlineshop oder Webseite einbetten</span>
        </div>
        <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 h-7 text-xs">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Kopiert!" : "Kopieren"}
        </Button>
      </div>

      {/* Variant Tabs */}
      <div className="flex border-b bg-muted/20 overflow-x-auto">
        {(["dynamic", "widget", "badge", "minimal"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary text-primary bg-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "dynamic" ? (
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Dynamisch (empfohlen)
              </span>
            ) : tab === "widget" ? "Widget (QR + Status)" : tab === "badge" ? "Badge (Text)" : "Minimal (nur QR)"}
          </button>
        ))}
      </div>

      {/* Code Block */}
      <div className="relative">
        <pre className="p-4 text-xs font-mono bg-[#0f172a] text-[#e2e8f0] overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
          <code>{currentCode}</code>
        </pre>
      </div>

      {/* Live-Vorschau */}
      <div className="border-t">
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Vorschau
          </span>
          <span className="text-[10px] text-muted-foreground">{showPreview ? "▲ ausblenden" : "▼ einblenden"}</span>
        </button>
        {showPreview && (
          <div className="border-t bg-[#f8fafc] px-4 py-4 flex items-center justify-center min-h-[100px]">
            <iframe
              key={currentCode}
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
              title="Widget-Vorschau"
              className="w-full border-0 rounded-lg"
              style={{ minHeight: activeTab === "widget" ? 100 : 60, maxHeight: 140 }}
              onLoad={(e) => {
                const iframe = e.currentTarget;
                try {
                  const body = iframe.contentDocument?.body;
                  if (body) iframe.style.height = Math.max(body.scrollHeight + 8, 60) + "px";
                } catch {}
              }}
            />
          </div>
        )}
      </div>

      {/* Integration Hints */}
      <div className="px-4 py-3 bg-muted/20 border-t">
        <p className="text-xs text-muted-foreground mb-2 font-medium">{t.seal.embedHowTo}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-1.5">
            <span className="font-semibold text-foreground mt-0.5">WooCommerce</span>
            <span>{t.seal.embedHowToStep1}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="font-semibold text-foreground mt-0.5">Shopify</span>
            <span>{t.seal.embedHowToStep2}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="font-semibold text-foreground mt-0.5">Webseite</span>
            <span>{t.seal.embedHowToStep3}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── Seal Label Download Button ─────────────────────────────────────
function SealLabelDownloadButton({
  productId,
  sealStatus,
}: {
  productId: number;
  sealStatus: SealStatus;
}) {
  const [downloading, setDownloading] = useState(false);
  const { t, lang } = useLang();

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = `/api/reports/seal-label?status=${sealStatus}&productId=${productId}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const statusSlug = sealStatus.replace(/_/g, "-");
      a.download = `Swiss-Product-Seal_${statusSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success(t.seal.printLabelSuccess, { description: t.seal.printLabelSuccessDesc });
    } catch (err: any) {
      toast.error(t.seal.printLabelError, { description: translateError(err.message, lang) ?? t.errors.unknownError });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={handleDownload}
      disabled={downloading}
    >
      {downloading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-2 h-4 w-4" />
      )}
      {downloading ? t.seal.printLabelGenerating : t.seal.printLabel}
    </Button>
  );
}

// ─── Document Row with Version History ──────────────────────────────────────
function DocumentRow({ doc, productId, role, isInternalRole, t, onDelete }: any) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const archivedQuery = trpc.documents.listArchivedVersions.useQuery(
    { productId, documentType: doc.documentType },
    { enabled: expanded }
  );
  const archivedVersions = archivedQuery.data ?? [];

  const togglePublicDownload = trpc.documents.togglePublicDownload.useMutation({
    onMutate: async ({ publicDownload }) => {
      // Optimistic update
      await utils.documents.listByProduct.cancel({ productId });
      const prev = utils.documents.listByProduct.getData({ productId });
      utils.documents.listByProduct.setData({ productId }, (old: any) =>
        old?.map((d: any) => d.id === doc.id ? { ...d, publicDownload } : d)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      utils.documents.listByProduct.setData({ productId }, ctx?.prev);
      toast.error(t.documents.togglePublicError);
    },
    onSuccess: (data) => {
      toast.success(data.publicDownload
        ? t.documents.togglePublicOn
        : t.documents.togglePublicOff
      );
    },
    onSettled: () => utils.documents.listByProduct.invalidate({ productId }),
  });

  return (
    <>
      <tr>
        <td>
          <Badge variant="outline" className="text-xs">
            {(t.docType as any)[doc.documentType] ?? doc.documentType}
          </Badge>
        </td>
        <td className="font-medium text-sm">{doc.fileName}</td>
        <td>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs">v{doc.version}</span>
            {doc.version > 1 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                title={expanded ? t.documents.versionHistoryHide : t.documents.versionHistoryShow}
              >
                <History className="h-3 w-3" />
                {doc.version - 1}
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
          </div>
        </td>
        <td>
          <StatusBadge
            status={
              doc.reviewStatus === "approved"
                ? "approved"
                : doc.reviewStatus === "rejected"
                ? "rejected"
                : "submitted"
            }
          />
        </td>
        <td className="text-muted-foreground text-xs">
          <div className="flex flex-col gap-0.5">
            <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
            {doc.expiryDate && (() => {
              const expired = new Date(doc.expiryDate) < new Date();
              return (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    expired
                      ? "text-red-600"
                      : "text-muted-foreground"
                  }`}
                  title={expired ? t.documents.expiredTitle : t.documents.validUntilTitle}
                >
                  {expired && <AlertCircle className="h-3 w-3 flex-shrink-0" />}
                  {t.documents.validUntil}: {new Date(doc.expiryDate).toLocaleDateString()}
                </span>
              );
            })()}
            {/* Warn if expired AND still publicly visible */}
            {doc.expiryDate && doc.publicDownload && new Date(doc.expiryDate) < new Date() && (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1 py-0.5">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                {t.documents.expiredPublic}
              </span>
            )}
          </div>
        </td>
        <td className="flex items-center gap-1">
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" title={t.action.download}>
              <FileText className="h-4 w-4" />
            </Button>
          </a>
          {/* Public download toggle – only for internal roles, only on approved docs */}
          {isInternalRole && doc.reviewStatus === "approved" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={togglePublicDownload.isPending}
              title={doc.publicDownload
                ? t.documents.togglePublicOnTitle
                : t.documents.togglePublicOffTitle}
              className={doc.publicDownload
                ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"}
              onClick={() => togglePublicDownload.mutate({
                documentId: doc.id,
                publicDownload: !doc.publicDownload,
              })}
            >
              {doc.publicDownload
                ? <Globe className="h-4 w-4" />
                : <GlobeLock className="h-4 w-4" />}
            </Button>
          )}
          {(role === "supplier" || isInternalRole) && (
            <Button
              variant="ghost"
              size="sm"
              title={t.documents.deleteTitle}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDelete(doc.id, doc.fileName)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="bg-amber-50/60 border-t border-amber-100 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <History className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-800">{t.documents.archivedVersionsTitle}</span>
              </div>
              {archivedQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t.documents.archivedLoading}
                </div>
              ) : archivedVersions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t.documents.archivedNone}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-medium pb-1 pr-4">{t.documents.archivedFilename}</th>
                      <th className="text-left font-medium pb-1 pr-4">{t.documents.archivedVersionLabel}</th>
                      <th className="text-left font-medium pb-1 pr-4">{t.documents.archivedUploadedAt}</th>
                      <th className="text-left font-medium pb-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedVersions.map((av: any) => (
                      <tr key={av.id} className="opacity-70">
                        <td className="pr-4 py-0.5">{av.fileName}</td>
                        <td className="pr-4 py-0.5 text-muted-foreground">v{av.version}</td>
                        <td className="pr-4 py-0.5 text-muted-foreground">{new Date(av.uploadedAt).toLocaleDateString()}</td>
                        <td className="py-0.5">
                          <a href={av.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1">
                              <Download className="h-3 w-3" />
                              {t.action.download}
                            </Button>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Upload Document Card ────────────────────────────────────────────
function UploadDocumentCard({ productId, role, isOperator, t, onSuccess }: any) {
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<string>("test_report");
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [operatorComment, setOperatorComment] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: (data) => {
      toast.success(t.msg.uploadSuccess);
      setOpen(false);
      setFile(null);
      setOperatorComment("");
      onSuccess?.(data?.confirmedAtReset ?? false);
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  const handleUpload = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadMutation.mutate({
        productId,
        documentType: docType as any,
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type,
        fileSizeBytes: file.size,
        expiryDate: expiryDate || undefined,
        operatorComment: isOperator && operatorComment.trim() ? operatorComment.trim() : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button onClick={() => setOpen(true)} variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          {t.action.upload}
        </Button>
        {isOperator && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
            <Shield className="h-3 w-3" />
            {t.documents.operatorUploadBadge}
          </span>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isOperator ? t.documents.operatorUploadTitle : t.action.upload}</DialogTitle>
          </DialogHeader>
          {isOperator && (
            <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{t.documents.operatorUploadNote} <strong>{t.documents.operatorUploadNoteBold}</strong> {t.documents.operatorUploadNoteSuffix}</span>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label>{t.documents.typeLabel}</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {(t.docType as any)[dt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.documents.fileLabel}</Label>
              <Input
                ref={fileRef}
                type="file"
                className="mt-1"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <Label>{t.common.expiryDate} ({t.common.optional})</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1"
              />
            </div>
            {isOperator && (
              <div>
                <Label className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                  {t.documents.reasonLabel}
                  <span className="text-xs font-normal text-muted-foreground">({t.common.optional})</span>
                </Label>
                <Textarea
                  value={operatorComment}
                  onChange={(e) => setOperatorComment(e.target.value)}
                  placeholder={t.documents.reasonPlaceholder}
                  maxLength={500}
                  rows={3}
                  className="mt-1 resize-none text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">{operatorComment.length}/500</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t.action.cancel}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? t.msg.loading : t.action.upload}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Safety Data Card ────────────────────────────────────────────────────────
function SafetyDataCard({ productId, safety, role, t, onSuccess }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    safetyText: safety?.safetyText ?? "",
    warningText: safety?.warningText ?? "",
    ageGrading: safety?.ageGrading ?? "",
    materialInformation: safety?.materialInformation ?? "",
    usageRestrictions: safety?.usageRestrictions ?? "",
    safetyNotes: safety?.safetyNotes ?? "",
  });

  const upsertMutation = trpc.safety.upsert.useMutation({
    onSuccess: () => {
      toast.success(t.msg.saveSuccess);
      setEditing(false);
      onSuccess?.();
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

   const isOperator = ["administrator", "compliance_manager", "internal_employee", "super_admin"].includes(role);
  const canEdit = role === "supplier" || isOperator;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{t.product.safetyData}</CardTitle>
          {isOperator && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
              <Shield className="h-3 w-3" />
              {t.documents.operatorAccess}
            </span>
          )}
        </div>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t.action.edit}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            {Object.entries(form).map(([key, value]) => (
              <div key={key}>
                <Label>{(t.safety as any)[key] ?? key}</Label>
                <Textarea
                  value={value}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  rows={2}
                  className="mt-1"
                />
              </div>
            ))}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(false)}>
                {t.action.cancel}
              </Button>
              <Button
                onClick={() => upsertMutation.mutate({ productId, ...form })}
                disabled={upsertMutation.isPending}
              >
                {t.action.save}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {Object.entries({
              safetyText: safety?.safetyText,
              warningText: safety?.warningText,
              ageGrading: safety?.ageGrading,
              materialInformation: safety?.materialInformation,
              usageRestrictions: safety?.usageRestrictions,
              safetyNotes: safety?.safetyNotes,
            }).map(([key, value]) => (
              <div key={key}>
                <p className="text-xs text-muted-foreground">{(t.safety as any)[key] ?? key}</p>
                <p className="mt-0.5">{(value as string) || "–"}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Timeline Card ────────────────────────────────────────────────────────────
type TimelineFilter = "all" | "supplier" | "operator" | "system";

function TimelineCard({ productId, t }: any) {
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all");
  const timelineQuery = trpc.products.getTimeline.useQuery({ productId });
  const timelineData = timelineQuery.data as any;
  const approvalHistory: any[] = timelineData?.history ?? [];
  const auditEntries: any[] = timelineData?.auditEntries ?? [];

  // Merge and sort all events by createdAt descending
  const allEvents = [
    ...approvalHistory.map((e: any) => ({ ...e, _type: "approval" as const })),
    ...auditEntries.map((e: any) => ({ ...e, _type: "audit" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Count per category for badges
  const counts = {
    all: allEvents.length,
    supplier: allEvents.filter(e => e._type === "audit" && e.actorRole === "supplier").length,
    operator: allEvents.filter(e => e._type === "audit" && e.actorRole === "operator").length,
    system: allEvents.filter(e => e._type === "approval").length,
  };

  // Apply filter
  const visibleEvents = allEvents.filter(e => {
    if (activeFilter === "all") return true;
    if (activeFilter === "supplier") return e._type === "audit" && e.actorRole === "supplier";
    if (activeFilter === "operator") return e._type === "audit" && e.actorRole === "operator";
    if (activeFilter === "system") return e._type === "approval";
    return true;
  });

  const getApprovalIcon = (action: string) => {
    if (action.includes("approved") || action.includes("completed")) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (action.includes("rejected")) return <XCircle className="h-4 w-4 text-red-500" />;
    if (action.includes("submitted")) return <Send className="h-4 w-4 text-blue-500" />;
    if (action.includes("clarification")) return <AlertCircle className="h-4 w-4 text-amber-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getAuditIcon = (action: string, actorRole: string) => {
    const isOperator = actorRole === "operator";
    if (action.includes("upload") || action.includes("document")) return <FileText className={`h-4 w-4 ${isOperator ? "text-blue-500" : "text-violet-500"}`} />;
    if (action.includes("safety")) return <Shield className={`h-4 w-4 ${isOperator ? "text-blue-500" : "text-violet-500"}`} />;
    return <Package className={`h-4 w-4 ${isOperator ? "text-blue-500" : "text-violet-500"}`} />;
  };

  const getAuditActionLabel = (action: string) => {
    const map: Record<string, string> = {
      uploaded: t.auditLog.actionUploaded,
      operator_document_uploaded: t.auditLog.actionUploaded,
      deleted: t.auditLog.actionDeleted,
      operator_document_deleted: t.auditLog.actionDeleted,
      document_uploaded: t.auditLog.actionUploaded,
      document_deleted: t.auditLog.actionDeleted,
      document_reviewed: t.auditLog.actionReviewed,
      safety_upserted: t.auditLog.actionSafetyUpdated,
      safety_updated: t.auditLog.actionSafetyUpdated,
      supplier_confirmation_reset: t.auditLog.actionConfirmReset,
    };
    return map[action] ?? action;
  };

  const getApprovalActionLabel = (action: string) => {
    const map: Record<string, string> = {
      submitted: t.auditLog.approvalSubmitted,
      approved: t.auditLog.approvalApproved,
      rejected: t.auditLog.approvalRejected,
      clarification_requested: t.auditLog.approvalClarification,
      completed: t.auditLog.approvalCompleted,
      reopened: t.auditLog.approvalReopened,
      updated: t.auditLog.approvalUpdated,
    };
    return map[action] ?? action;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{t.auditLog.activityLog}</CardTitle>
            <span className="text-xs text-muted-foreground">{allEvents.length} {t.auditLog.entries}</span>
          </div>
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "all",      label: t.common.filterAll,   color: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",    active: "bg-slate-700 text-white border-slate-700" },
              { key: "supplier", label: t.auditLog.filterSupplier, color: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100", active: "bg-violet-600 text-white border-violet-600" },
              { key: "operator", label: t.auditLog.filterOperator, color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",         active: "bg-blue-600 text-white border-blue-600" },
              { key: "system",   label: t.auditLog.filterSystem,  color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100", active: "bg-emerald-600 text-white border-emerald-600" },
            ] as const).map(({ key, label, color, active }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key as TimelineFilter)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  activeFilter === key ? active : color
                }`}
              >
                {label}
                <span className={`rounded-full px-1 py-px text-[10px] font-semibold ${
                  activeFilter === key ? "bg-white/25 text-inherit" : "bg-white/60 text-inherit"
                }`}>
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {allEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t.auditLog.noActivity}</p>
        ) : visibleEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t.auditLog.noEntriesForFilter}</p>
        ) : (
          <div className="space-y-1">
            {visibleEvents.map((e: any, i: number) => {
              const isAudit = e._type === "audit";
              const isOperator = isAudit && e.actorRole === "operator";
              const isSupplier = isAudit && e.actorRole === "supplier";
              const isSystem = !isAudit;

              // Color scheme per actor
              const dotColor = isOperator
                ? "bg-blue-100 border-blue-300"
                : isSupplier
                ? "bg-violet-100 border-violet-300"
                : "bg-slate-100 border-slate-300";
              const rowBg = isOperator
                ? "bg-blue-50/40 border-l-2 border-l-blue-300"
                : isSupplier
                ? "bg-violet-50/40 border-l-2 border-l-violet-300"
                : "";

              return (
                <div key={`${e._type}-${e.id}`} className={`flex gap-3 rounded-md px-2 py-2 ${rowBg}`}>
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${dotColor}`}>
                      {isAudit
                        ? getAuditIcon(e.action, e.actorRole ?? "")
                        : getApprovalIcon(e.action)}
                    </div>
                    {i < visibleEvents.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1 min-h-[12px]" />
                    )}
                  </div>
                  <div className="pb-3 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                          {isAudit ? getAuditActionLabel(e.action) : getApprovalActionLabel(e.action)}
                        </p>
                        {isOperator && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                            <Shield className="h-2.5 w-2.5" />
                            {t.auditLog.filterOperator}
                          </span>
                        )}
                        {isSupplier && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 border border-violet-200 px-1.5 py-0.5 text-xs font-medium text-violet-700">
                            <Package className="h-2.5 w-2.5" />
                            Supplier
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(e.createdAt).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    {/* Actor name */}
                    {(e.actorName || e.performedByName) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.actorName ?? e.performedByName}
                      </p>
                    )}
                    {/* Payload details: filename / documentType */}
                    {isAudit && e.payloadSnapshot && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {typeof e.payloadSnapshot === "object" && e.payloadSnapshot !== null
                          ? ((e.payloadSnapshot as any).fileName ?? (e.payloadSnapshot as any).documentType ?? "")
                          : ""}
                      </p>
                    )}
                    {/* Version diff badge: v(prev) → v(new) for upload events */}
                    {isAudit && e.payloadSnapshot?.previousVersion != null && e.payloadSnapshot?.version != null && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          <History className="h-3 w-3" />
                          v{e.payloadSnapshot.previousVersion}
                          <span className="mx-0.5 text-amber-400">→</span>
                          v{e.payloadSnapshot.version}
                        </span>
                        {e.payloadSnapshot.previousFileUrl && (
                          <a
                            href={e.payloadSnapshot.previousFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                            title={`${t.auditLog.downloadPrevious}: ${e.payloadSnapshot.previousFileName ?? ""}`}
                          >
                            <Download className="h-3 w-3" />
                            {e.payloadSnapshot.previousFileName
                              ? e.payloadSnapshot.previousFileName.length > 28
                                ? e.payloadSnapshot.previousFileName.slice(0, 25) + "…"
                                : e.payloadSnapshot.previousFileName
                              : `v${e.payloadSnapshot.previousVersion}`}
                          </a>
                        )}
                      </div>
                    )}
                    {/* Version badge for delete events */}
                    {isAudit && (e.action === "deleted" || e.action === "operator_document_deleted") && e.payloadSnapshot?.documentVersion != null && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700">
                          <Trash2 className="h-3 w-3" />
                          v{e.payloadSnapshot.documentVersion} {t.auditLog.versionDeletedBadge}
                        </span>
                        {e.payloadSnapshot.fileUrl && (
                          <a
                            href={e.payloadSnapshot.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                            title={t.auditLog.downloadDeleted}
                          >
                            <Download className="h-3 w-3" />
                            {e.payloadSnapshot.fileName
                              ? e.payloadSnapshot.fileName.length > 28
                                ? e.payloadSnapshot.fileName.slice(0, 25) + "…"
                                : e.payloadSnapshot.fileName
                              : t.auditLog.fileLabel}
                          </a>
                        )}
                      </div>
                    )}
                    {/* Operator comment */}
                    {isAudit && isOperator && e.payloadSnapshot?.operatorComment && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-blue-50 border border-blue-100 px-2 py-1.5">
                        <MessageSquare className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-800 italic break-words">{e.payloadSnapshot.operatorComment}</p>
                      </div>
                    )}
                    {/* Note for approval history */}
                    {!isAudit && e.note && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{e.note}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Batch Tab ───────────────────────────────────────────────────────────────
function BatchTab({
  productId,
  canEdit,
}: {
  productId: number;
  canEdit: boolean;
}) {
  const { t } = useLang();
  const batchQuery = trpc.products.getBatchInfo.useQuery({ productId });
  const updateMutation = trpc.products.updateBatchInfo.useMutation({
    onSuccess: () => {
      toast.success(t.batch.saveBatch);
      batchQuery.refetch();
      setEditing(false);
    },
    onError: (e) => toast.error(translateError(e.message, t)),
  });

  const [editing, setEditing] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [importerName, setImporterName] = useState("");

  // Populate form when data loads
  const batch = batchQuery.data;
  const initialized = useRef(false);
  if (batch && !initialized.current) {
    initialized.current = true;
    setBatchNumber(batch.batchNumber ?? "");
    setProductionDate(batch.productionDate ?? "");
    setExpiryDate(batch.expiryDate ?? "");
    setImporterName(batch.importerName ?? "");
  }

  function handleSave() {
    updateMutation.mutate({
      productId,
      batchNumber: batchNumber || undefined,
      productionDate: productionDate || undefined,
      expiryDate: expiryDate || undefined,
      importerName: importerName || undefined,
    });
  }

  function handleEdit() {
    // Re-sync form with latest data
    if (batch) {
      setBatchNumber(batch.batchNumber ?? "");
      setProductionDate(batch.productionDate ?? "");
      setExpiryDate(batch.expiryDate ?? "");
      setImporterName(batch.importerName ?? "");
    }
    setEditing(true);
  }

  if (batchQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-5 w-5 text-[#C8102E]" />
            {t.batch.fullTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t.batch.publicDesc}
          </p>
        </div>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            {t.action.edit}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {editing ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="batchNumber">{t.batch.batchNumber}</Label>
                <Input
                  id="batchNumber"
                  placeholder={t.batch.batchNumberPlaceholder}
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.batch.batchNumberHint}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="importerName">{t.batch.importerNameLabel}</Label>
                <Input
                  id="importerName"
                  placeholder={t.batch.importerPlaceholder}
                  value={importerName}
                  onChange={(e) => setImporterName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.batch.importerNameHint}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="productionDate">{t.batch.productionDate}</Label>
                <Input
                  id="productionDate"
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiryDate">{t.batch.expiryBatchLabel}</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-[#C8102E] hover:bg-[#a00d25] text-white"
              >
                {updateMutation.isPending ? t.batch.saving : t.action.save}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                {t.action.cancel}
              </Button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoField
              label={t.batch.batchNumber}
              value={batch?.batchNumber}
              empty={t.batch.notSpecified}
            />
            <InfoField
              label={t.batch.importerNameLabel}
              value={batch?.importerName}
              empty={t.batch.defaultFromTenant}
            />
            <InfoField
              label={t.batch.productionDate}
              value={batch?.productionDate ? new Date(batch.productionDate).toLocaleDateString("de-CH") : null}
              empty={t.batch.notSpecified}
            />
            <InfoField
              label={t.batch.expiryBatchLabel}
              value={batch?.expiryDate ? new Date(batch.expiryDate).toLocaleDateString("de-CH") : null}
              empty={t.batch.notSpecified}
              expiredLabel={t.batch.expired}
              expiringSoonLabel={t.batch.expiringSoon}
              highlight={
                batch?.expiryDate
                  ? new Date(batch.expiryDate) < new Date()
                    ? "expired"
                    : new Date(batch.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                    ? "warning"
                    : undefined
                  : undefined
              }
            />
          </div>
        )}

        {!editing && !batch?.batchNumber && !batch?.productionDate && !batch?.expiryDate && (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t.batch.noBatchData}</p>
            {canEdit && (
              <Button variant="outline" size="sm" className="mt-3" onClick={handleEdit}>
                {t.batch.addNow}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoField({
  label,
  value,
  empty,
  highlight,
  expiredLabel,
  expiringSoonLabel,
}: {
  label: string;
  value: string | null | undefined;
  empty: string;
  highlight?: "expired" | "warning";
  expiredLabel?: string;
  expiringSoonLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {value ? (
        <p
          className={`text-sm font-medium ${
            highlight === "expired"
              ? "text-red-600"
              : highlight === "warning"
              ? "text-amber-600"
              : "text-foreground"
          }`}
        >
          {value}
          {highlight === "expired" && expiredLabel && (
            <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{expiredLabel}</span>
          )}
          {highlight === "warning" && expiringSoonLabel && (
            <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{expiringSoonLabel}</span>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">{empty}</p>
      )}
    </div>
  );
}
