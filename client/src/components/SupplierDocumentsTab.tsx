import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Trash2,
  Download,
  ExternalLink,
  Lock,
  FileCheck,
  FileWarning,
  FileBadge,
  FileSpreadsheet,
} from "lucide-react";

const DOCUMENT_TYPES = [
  "test_report",
  "certificate",
  "declaration",
  "safety_datasheet",
  "technical_doc",
  "compliance_note",
  "audit_report",
  "product_datasheet",
  "other",
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

function docTypeIcon(type: DocumentType) {
  switch (type) {
    case "test_report": return <FileCheck className="h-4 w-4 text-blue-500" />;
    case "certificate": return <FileBadge className="h-4 w-4 text-green-500" />;
    case "declaration": return <FileText className="h-4 w-4 text-purple-500" />;
    case "safety_datasheet": return <FileWarning className="h-4 w-4 text-orange-500" />;
    case "audit_report": return <FileSpreadsheet className="h-4 w-4 text-red-500" />;
    case "compliance_note": return <FileText className="h-4 w-4 text-amber-500" />;
    default: return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function docTypeBadgeColor(type: DocumentType): string {
  switch (type) {
    case "test_report": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "certificate": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "declaration": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "safety_datasheet": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "audit_report": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "compliance_note": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  supplierId: number;
  productId?: number;
  readOnly?: boolean;
}

export function SupplierDocumentsTab({ supplierId, productId, readOnly = false }: Props) {
  const { t } = useLang();
  const sd = (t as any).supplierDocs;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    documentType: "other" as DocumentType,
    title: "",
    description: "",
    regulationRef: "",
    isConfidential: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const utils = trpc.useUtils();

  const { data: docs = [], isLoading } = trpc.supplierDocuments.list.useQuery({
    supplierId,
    productId,
  });

  const uploadMutation = trpc.supplierDocuments.upload.useMutation({
    onSuccess: () => {
      toast.success(sd?.uploaded ?? "Document uploaded");
      setUploadOpen(false);
      setSelectedFile(null);
      setForm({ documentType: "other", title: "", description: "", regulationRef: "", isConfidential: false });
      utils.supplierDocuments.list.invalidate({ supplierId, productId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.supplierDocuments.delete.useMutation({
    onSuccess: () => {
      toast.success(sd?.deleted ?? "Document deleted");
      utils.supplierDocuments.list.invalidate({ supplierId, productId });
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      await uploadMutation.mutateAsync({
        supplierId,
        productId,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        fileSizeBytes: selectedFile.size,
        fileBase64: base64,
        documentType: form.documentType,
        title: form.title || selectedFile.name,
        description: form.description || undefined,
        regulationRef: form.regulationRef || undefined,
        isConfidential: form.isConfidential,
      });
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!form.title) setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, "") }));
    }
  }

  const docTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      test_report: sd?.test_report ?? "Test Report",
      certificate: sd?.certificate ?? "Certificate",
      declaration: sd?.declaration ?? "Declaration of Conformity",
      safety_datasheet: sd?.safety_datasheet ?? "Safety Data Sheet",
      technical_doc: sd?.technical_doc ?? "Technical Documentation",
      compliance_note: sd?.compliance_note ?? "Compliance Note",
      audit_report: sd?.audit_report ?? "Audit Report",
      product_datasheet: sd?.product_datasheet ?? "Product Data Sheet",
      other: sd?.other ?? "Other",
    };
    return map[type] ?? type;
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{sd?.tab_title ?? "Documents"}</h3>
        {!readOnly && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {sd?.upload_document ?? "Upload Document"}
          </Button>
        )}
      </div>

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>{sd?.no_documents ?? "No documents stored yet."}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{docTypeIcon(doc.documentType as DocumentType)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{doc.title ?? doc.fileName}</span>
                      {doc.isConfidential && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          {sd?.confidential ?? "Confidential"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${docTypeBadgeColor(doc.documentType as DocumentType)}`}>
                        {docTypeLabel(doc.documentType)}
                      </span>
                      {doc.regulationRef && (
                        <span className="text-xs text-muted-foreground">{doc.regulationRef}</span>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {doc.fileSizeBytes && <span>{formatFileSize(doc.fileSizeBytes)}</span>}
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(doc.fileUrl, "_blank")}
                      title={sd?.download ?? "Download"}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(sd?.delete_confirm ?? "Really delete this document?")) {
                            deleteMutation.mutate({ id: doc.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{sd?.upload_document ?? "Upload Document"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* File picker */}
            <div>
              <Label>{sd?.upload ?? "File"}</Label>
              <div
                className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select file</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
              />
            </div>

            {/* Document type */}
            <div>
              <Label>{sd?.document_type ?? "Document Type"}</Label>
              <Select
                value={form.documentType}
                onValueChange={(v) => setForm(f => ({ ...f, documentType: v as DocumentType }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {docTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div>
              <Label>{sd?.title ?? "Title"}</Label>
              <Input
                className="mt-1"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. DVGW W270 Test Report 2024"
              />
            </div>

            {/* Regulation ref */}
            <div>
              <Label>{sd?.regulation_ref ?? "Legal Basis"}</Label>
              <Input
                className="mt-1"
                value={form.regulationRef}
                onChange={(e) => setForm(f => ({ ...f, regulationRef: e.target.value }))}
                placeholder="e.g. TrinkwV 2023, DVGW W291"
              />
            </div>

            {/* Description */}
            <div>
              <Label>{sd?.description ?? "Description"}</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Confidential */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isConfidential}
                onCheckedChange={(v) => setForm(f => ({ ...f, isConfidential: v }))}
              />
              <Label>{sd?.confidential ?? "Confidential"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? (sd?.uploading ?? "Uploading…") : (sd?.upload ?? "Upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
