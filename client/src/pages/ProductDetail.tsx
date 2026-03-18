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
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { AiAnalysisCard } from "@/components/AiAnalysisCard";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Package,
  Send,
  Shield,
  Upload,
  XCircle,
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
  const [, setLocation] = useLocation();
  const role = (user as any)?.complianceRole ?? "internal_employee";

  const productQuery = trpc.products.getById.useQuery({ id: productId });
  const product = productQuery.data as any;

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
    onError: (e) => toast.error(e.message),
  });

  // Comment mutation
  const [commentText, setCommentText] = useState("");
  const [internalOnly, setInternalOnly] = useState(false);
  const commentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      utils.comments.listByProduct.invalidate({ productId });
    },
    onError: (e) => toast.error(e.message),
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
        <p className="text-muted-foreground">Produkt nicht gefunden.</p>
        <Button variant="ghost" onClick={() => setLocation("/products")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> {t.common.back}
        </Button>
      </div>
    );
  }

  const canSubmit =
    role === "supplier" &&
    ["open", "in_progress", "clarification_needed"].includes(product.status);

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
          <div className="flex items-center gap-2">
            {canSubmit && (
              <Button
                onClick={() => submitMutation.mutate({ productId, note: undefined })}
                disabled={submitMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                {t.action.submit}
              </Button>
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
                <p className="text-xs font-medium text-blue-700 mb-1">Anmerkung</p>
                <p className="text-xs text-blue-600">{product.reviewNote}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents">
        <TabsList>
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
            KI-Analyse
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Clock className="h-4 w-4" />
            {t.product.timeline}
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4 space-y-4">
          {(role === "supplier" || role === "internal_employee") && (
            <UploadDocumentCard
              productId={productId}
              t={t}
              onSuccess={() => documentsQuery.refetch()}
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
                      <th>{t.common.version === "Version" ? "Typ" : "Type"}</th>
                      <th>Dateiname</th>
                      <th>{t.common.version}</th>
                      <th>Status</th>
                      <th>{t.common.uploadedAt}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc: any) => (
                      <tr key={doc.id}>
                        <td>
                          <Badge variant="outline" className="text-xs">
                            {(t.docType as any)[doc.documentType] ?? doc.documentType}
                          </Badge>
                        </td>
                        <td className="font-medium text-sm">{doc.fileName}</td>
                        <td className="text-muted-foreground text-xs">v{doc.version}</td>
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
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </td>
                        <td>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
      </Tabs>
    </div>
  );
}

// ─── Upload Document Card ────────────────────────────────────────────────────
function UploadDocumentCard({ productId, t, onSuccess }: any) {
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<string>("test_report");
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => {
      toast.success(t.msg.uploadSuccess);
      setOpen(false);
      setFile(null);
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
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
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        <Upload className="mr-2 h-4 w-4" />
        {t.action.upload}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.action.upload}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.common.version === "Version" ? "Dokumenttyp" : "Document Type"}</Label>
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
              <Label>Datei</Label>
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
    onError: (e) => toast.error(e.message),
  });

  const canEdit = ["supplier", "internal_employee"].includes(role);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{t.product.safetyData}</CardTitle>
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
function TimelineCard({ productId, t }: any) {
  const timelineQuery = trpc.products.getTimeline.useQuery({ productId });
  const timelineData = timelineQuery.data as any;
  const events = timelineData?.history ?? [];

  const getIcon = (action: string) => {
    if (action.includes("approved")) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (action.includes("rejected")) return <XCircle className="h-4 w-4 text-red-500" />;
    if (action.includes("submitted")) return <Send className="h-4 w-4 text-blue-500" />;
    if (action.includes("clarification")) return <AlertCircle className="h-4 w-4 text-amber-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardContent className="p-5">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Noch keine Aktivitäten</p>
        ) : (
          <div className="space-y-4">
            {events.map((e: any, i: number) => (
              <div key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {getIcon(e.action)}
                  </div>
                  {i < events.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{e.action}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {e.performedByName && (
                    <p className="text-xs text-muted-foreground mt-0.5">{e.performedByName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
