import { useState } from "react";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  Loader2,
  FolderOpen,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import {
  useListTemplates,
  useDeleteTemplate,
  useGetProduct,
  getListTemplatesQueryKey,
  getGetProductQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { WizardModal } from "@/components/wizard/WizardModal";

type Template = {
  id: string;
  name: string;
  type: string;
  optionType: string;
  prompt: string;
  imageUrls: unknown;
  sessionConfig: unknown;
  createdAt: string;
  productId: string;
};

type QAAnswer = { question: string; answer: string };

function TemplateThumb({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <FolderOpen className="w-8 h-8 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
    />
  );
}

function resolveThumbUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `/api/storage${url}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function TemplateDetailModal({
  template,
  onClose,
  onUse,
}: {
  template: Template;
  onClose: () => void;
  onUse: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);

  const imageUrls = (template.imageUrls as string[]) ?? [];
  const config = (template.sessionConfig as { qaAnswers?: QAAnswer[] }) ?? {};
  const qaAnswers = config.qaAnswers ?? [];
  const activeImg = selectedImg ?? imageUrls[0];

  const copyPrompt = () => {
    navigator.clipboard.writeText(template.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row max-h-[85vh]">
          {/* Left: image gallery */}
          <div className="sm:w-[44%] bg-muted flex flex-col shrink-0">
            {imageUrls.length > 0 ? (
              <>
                <div className="flex-1 overflow-hidden" style={{ maxHeight: "340px" }}>
                  <TemplateThumb
                    src={resolveThumbUrl(activeImg)}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {imageUrls.length > 1 && (
                  <div className="flex gap-1.5 p-2 overflow-x-auto bg-muted/80 shrink-0">
                    {imageUrls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImg(url)}
                        className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                          activeImg === url ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <TemplateThumb src={resolveThumbUrl(url)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center min-h-[200px]">
                <FolderOpen className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Right: details */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg leading-snug">{template.name}</DialogTitle>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="secondary" className="text-xs">{template.type}</Badge>
                <Badge variant="outline" className="text-xs">Option {template.optionType}</Badge>
                {imageUrls.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {imageUrls.length} image{imageUrls.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs">
                Created {timeAgo(template.createdAt)}
              </DialogDescription>
            </DialogHeader>

            {/* Prompt */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Prompt</p>
              <div className="bg-muted/30 rounded-xl p-3 max-h-[140px] overflow-y-auto">
                <p className="text-xs font-mono text-foreground leading-relaxed">{template.prompt}</p>
              </div>
              <Button variant="outline" size="sm" onClick={copyPrompt} className="h-7 text-xs">
                {copied ? (
                  <Check className="w-3 h-3 mr-1.5 text-green-600" />
                ) : (
                  <Copy className="w-3 h-3 mr-1.5" />
                )}
                {copied ? "Copied!" : "Copy Prompt"}
              </Button>
            </div>

            {/* Q&A summary */}
            {qaAnswers.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Q&A Summary</p>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {qaAnswers.map((qa, i) => (
                    <div key={i} className="rounded-lg border border-border/40 bg-card p-2.5">
                      <p className="text-[10px] text-muted-foreground line-clamp-1 leading-relaxed">{qa.question}</p>
                      <p className="text-xs font-medium mt-0.5 line-clamp-2">{qa.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full" onClick={onUse}>
              Use This Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TemplatesPage() {
  const { productId } = useParams<{ productId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<"all" | "M1" | "M2">("all");
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [detailTemplate, setDetailTemplate] = useState<Template | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTemplateId, setWizardTemplateId] = useState<string | undefined>(undefined);

  const { data: product } = useGetProduct(productId!, {
    query: {
      enabled: !!productId,
      queryKey: getGetProductQueryKey(productId!),
    },
  });

  const { data: rawTemplates, isLoading } = useListTemplates(
    { productId: productId! },
    {
      query: {
        enabled: !!productId,
        queryKey: getListTemplatesQueryKey({ productId: productId! }),
      },
    }
  );

  const deleteTemplate = useDeleteTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({ productId: productId! }) });
        setDeleteTarget(null);
        toast({ title: "Template deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete template", variant: "destructive" });
      },
    },
  });

  const handleUse = (template: Template) => {
    setDetailTemplate(null);
    setWizardTemplateId(template.id);
    setWizardOpen(true);
  };

  const allTemplates = (rawTemplates as Template[]) ?? [];
  const filtered = filter === "all" ? allTemplates : allTemplates.filter((t) => t.type === filter);
  const m1Count = allTemplates.filter((t) => t.type === "M1").length;
  const m2Count = allTemplates.filter((t) => t.type === "M2").length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Templates</h1>
            {product?.name && (
              <p className="text-sm text-muted-foreground truncate">{product.name}</p>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All ({allTemplates.length})
          </Button>
          <Button
            variant={filter === "M1" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("M1")}
          >
            M1 ({m1Count})
          </Button>
          <Button
            variant={filter === "M2" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("M2")}
          >
            M2 ({m2Count})
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-16 text-center space-y-4">
            <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold">No templates yet</p>
              <p className="text-sm text-muted-foreground">
                Complete a mockup session and save it as a template to see it here.
              </p>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm">Create New Mockup</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((tpl) => {
              const imageUrls = (tpl.imageUrls as string[]) ?? [];
              const thumb = imageUrls[0] ? resolveThumbUrl(imageUrls[0]) : null;
              return (
                <div
                  key={tpl.id}
                  className="rounded-xl border border-border/50 bg-card overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <button
                    className="w-full aspect-square bg-muted block overflow-hidden"
                    onClick={() => setDetailTemplate(tpl)}
                  >
                    {thumb ? (
                      <TemplateThumb
                        src={thumb}
                        alt={tpl.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </button>

                  <div className="p-3 space-y-2.5">
                    <div>
                      <p className="text-sm font-semibold leading-snug line-clamp-1">{tpl.name}</p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{tpl.type}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Option {tpl.optionType}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(tpl.createdAt)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleUse(tpl)}
                      >
                        Use
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setDeleteTarget(tpl)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detail modal */}
        {detailTemplate && (
          <TemplateDetailModal
            template={detailTemplate}
            onClose={() => setDetailTemplate(null)}
            onUse={() => handleUse(detailTemplate)}
          />
        )}

        {/* Delete confirm */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Template?</DialogTitle>
              <DialogDescription>
                "{deleteTarget?.name}" will be permanently deleted. This can't be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteTemplate.isPending}
                onClick={() => deleteTarget && deleteTemplate.mutate({ id: deleteTarget.id })}
              >
                {deleteTemplate.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Wizard triggered from "Use" */}
        {wizardOpen && productId && (
          <WizardModal
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            productId={productId}
            initialTemplateId={wizardTemplateId}
          />
        )}
      </div>
    </AppLayout>
  );
}

